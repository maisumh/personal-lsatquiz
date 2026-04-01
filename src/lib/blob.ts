import { put, list, del } from "@vercel/blob";
import type { Quiz, Attempt, IndexEntry } from "./types";

const BLOB_PREFIX = "lsat/";

async function readBlob<T>(path: string): Promise<T | null> {
  try {
    const { blobs } = await list({ prefix: BLOB_PREFIX + path });
    if (blobs.length === 0) return null;
    const response = await fetch(blobs[0].url);
    return response.json() as Promise<T>;
  } catch {
    return null;
  }
}

async function writeBlob(path: string, data: unknown): Promise<string> {
  // Delete existing blob at this path first
  const { blobs } = await list({ prefix: BLOB_PREFIX + path });
  for (const blob of blobs) {
    await del(blob.url);
  }
  const blob = await put(BLOB_PREFIX + path, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
  return blob.url;
}

// Quiz operations
export async function saveQuiz(quiz: Quiz): Promise<void> {
  await writeBlob(`quizzes/${quiz.id}.json`, quiz);
  await addToIndex("quiz", {
    id: quiz.id,
    title: quiz.title,
    type: quiz.type,
    questionTypes: quiz.questionTypes,
    createdAt: quiz.createdAt,
    questionCount: quiz.questions.length,
  });
}

export async function getQuiz(quizId: string): Promise<Quiz | null> {
  return readBlob<Quiz>(`quizzes/${quizId}.json`);
}

// Attempt operations
export async function saveAttempt(attempt: Attempt, quizTitle: string): Promise<void> {
  await writeBlob(`attempts/${attempt.id}.json`, attempt);
  await addToIndex("attempt", {
    id: attempt.id,
    quizId: attempt.quizId,
    quizTitle,
    score: attempt.score,
    totalQuestions: attempt.totalQuestions,
    completedAt: attempt.completedAt,
    status: attempt.status,
  });
}

export async function getAttempt(attemptId: string): Promise<Attempt | null> {
  return readBlob<Attempt>(`attempts/${attemptId}.json`);
}

export async function updateAttempt(attempt: Attempt, quizTitle: string): Promise<void> {
  await writeBlob(`attempts/${attempt.id}.json`, attempt);
  // Update the index entry
  const index = await getIndex();
  const idx = index.attempts.findIndex((a) => a.id === attempt.id);
  if (idx !== -1) {
    index.attempts[idx] = {
      id: attempt.id,
      quizId: attempt.quizId,
      quizTitle,
      score: attempt.score,
      totalQuestions: attempt.totalQuestions,
      completedAt: attempt.completedAt,
      status: attempt.status,
    };
    await writeBlob("index.json", index);
  }
}

// Index operations
export async function getIndex(): Promise<IndexEntry> {
  const index = await readBlob<IndexEntry>("index.json");
  return index || { quizzes: [], attempts: [] };
}

async function addToIndex(
  type: "quiz" | "attempt",
  entry: IndexEntry["quizzes"][0] | IndexEntry["attempts"][0]
): Promise<void> {
  const index = await getIndex();
  if (type === "quiz") {
    index.quizzes.push(entry as IndexEntry["quizzes"][0]);
  } else {
    index.attempts.push(entry as IndexEntry["attempts"][0]);
  }
  await writeBlob("index.json", index);
}
