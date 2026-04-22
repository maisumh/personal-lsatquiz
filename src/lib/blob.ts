import { put, list } from "@vercel/blob";
import type { Quiz, Attempt, IndexEntry } from "./types";

const BLOB_PREFIX = "lsat/";

// Cache blob URLs in memory to avoid list() calls on read-after-write
const urlCache = new Map<string, string>();

async function readBlob<T>(path: string): Promise<T | null> {
  try {
    const fullPath = BLOB_PREFIX + path;

    let url = urlCache.get(fullPath);

    if (!url) {
      const { blobs } = await list({ prefix: fullPath });
      const exact = blobs.find((b) => b.pathname === fullPath);
      if (!exact) return null;
      url = exact.url;
    }

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

  urlCache.set(fullPath, blob.url);

  return blob.url;
}

// Quiz operations
export async function saveQuiz(quiz: Quiz): Promise<void> {
  await writeBlob(`quizzes/${quiz.id}.json`, quiz);
}

export async function getQuiz(quizId: string): Promise<Quiz | null> {
  return readBlob<Quiz>(`quizzes/${quizId}.json`);
}

// Attempt operations
export async function saveAttempt(attempt: Attempt): Promise<void> {
  await writeBlob(`attempts/${attempt.id}.json`, attempt);
}

export async function getAttempt(attemptId: string): Promise<Attempt | null> {
  return readBlob<Attempt>(`attempts/${attemptId}.json`);
}

export async function updateAttempt(attempt: Attempt): Promise<void> {
  await writeBlob(`attempts/${attempt.id}.json`, attempt);
}

/**
 * Returns the graded questions for an attempt. Works for both the new model
 * (questions stored on the attempt) and legacy (questions stored on the quiz).
 *
 * For a legacy attempt whose parent quiz has since been migrated (no
 * `questions[]` on the quiz), we cannot reconstruct the exact original
 * selection — the random seed is lost. The caller should treat an empty
 * return as "this attempt is unrecoverable" and surface a clear error rather
 * than silently grading zero questions.
 */
export async function getAttemptQuestions(attempt: Attempt) {
  if (attempt.questions && attempt.questions.length > 0) {
    return attempt.questions;
  }
  const quiz = await getQuiz(attempt.quizId);
  if (quiz?.questions && quiz.questions.length > 0) {
    return quiz.questions;
  }
  return [];
}

// Index — rebuilt on every call to avoid read-modify-write races
export async function getIndex(): Promise<IndexEntry> {
  const [quizList, attemptList] = await Promise.all([
    list({ prefix: BLOB_PREFIX + "quizzes/" }),
    list({ prefix: BLOB_PREFIX + "attempts/" }),
  ]);

  const quizzes = (
    await Promise.all(
      quizList.blobs.map(async (blob) => {
        try {
          const res = await fetch(blob.url + "?t=" + Date.now(), {
            cache: "no-store",
          });
          if (!res.ok) return null;
          return (await res.json()) as Quiz;
        } catch {
          return null;
        }
      })
    )
  ).filter(Boolean) as Quiz[];

  const attempts = (
    await Promise.all(
      attemptList.blobs.map(async (blob) => {
        try {
          const res = await fetch(blob.url + "?t=" + Date.now(), {
            cache: "no-store",
          });
          if (!res.ok) return null;
          return (await res.json()) as Attempt;
        } catch {
          return null;
        }
      })
    )
  ).filter(Boolean) as Attempt[];

  const quizTitleMap = new Map(quizzes.map((q) => [q.id, q.title]));

  return {
    quizzes: quizzes.map((q) => ({
      id: q.id,
      title: q.title,
      type: q.type,
      questionTypes: q.questionTypes,
      createdAt: q.createdAt,
      questionCount: q.questionCount ?? q.questions?.length ?? 0,
    })),
    attempts: attempts.map((a) => ({
      id: a.id,
      quizId: a.quizId,
      quizTitle: a.quizTitle ?? quizTitleMap.get(a.quizId) ?? "Unknown Quiz",
      score: a.score,
      totalQuestions: a.totalQuestions,
      completedAt: a.completedAt,
      status: a.status,
      mode: a.mode,
    })),
  };
}

/**
 * Raw attempt list — used when dashboard needs full answer + flag data.
 */
export async function listAttempts(): Promise<Attempt[]> {
  const { blobs } = await list({ prefix: BLOB_PREFIX + "attempts/" });
  const attempts = await Promise.all(
    blobs.map(async (blob) => {
      try {
        const res = await fetch(blob.url + "?t=" + Date.now(), {
          cache: "no-store",
        });
        if (!res.ok) return null;
        return (await res.json()) as Attempt;
      } catch {
        return null;
      }
    })
  );
  return attempts.filter(Boolean) as Attempt[];
}
