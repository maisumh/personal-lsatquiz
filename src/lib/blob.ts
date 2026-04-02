import { put, list, del } from "@vercel/blob";
import type { Quiz, Attempt, IndexEntry } from "./types";

const BLOB_PREFIX = "lsat/";

// Cache blob URLs in memory to avoid list() calls on read-after-write
const urlCache = new Map<string, string>();

async function readBlob<T>(path: string): Promise<T | null> {
  try {
    const fullPath = BLOB_PREFIX + path;

    // Check in-memory cache first (for read-after-write consistency)
    let url = urlCache.get(fullPath);

    if (!url) {
      const { blobs } = await list({ prefix: fullPath });
      // Find exact match to avoid prefix collisions
      const exact = blobs.find((b) => b.pathname === fullPath);
      if (!exact) return null;
      url = exact.url;
    }

    // Always bypass fetch cache to get fresh data
    const response = await fetch(url + "?t=" + Date.now(), {
      cache: "no-store",
    });
    if (!response.ok) return null;
    return response.json() as Promise<T>;
  } catch {
    return null;
  }
}

async function writeBlob(path: string, data: unknown): Promise<string> {
  const fullPath = BLOB_PREFIX + path;

  const blob = await put(fullPath, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  // Cache the URL for immediate read-after-write consistency
  urlCache.set(fullPath, blob.url);

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
  // Upsert the index entry (add if not found, update if found)
  const index = await getIndex();
  const entry = {
    id: attempt.id,
    quizId: attempt.quizId,
    quizTitle,
    score: attempt.score,
    totalQuestions: attempt.totalQuestions,
    completedAt: attempt.completedAt,
    status: attempt.status,
  };
  const idx = index.attempts.findIndex((a) => a.id === attempt.id);
  if (idx !== -1) {
    index.attempts[idx] = entry;
  } else {
    // Attempt wasn't in index (stale read) — add it
    index.attempts.push(entry);
  }
  await writeBlob("index.json", index);
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
