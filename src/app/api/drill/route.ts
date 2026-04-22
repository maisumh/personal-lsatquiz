import { NextResponse } from "next/server";
import {
  getAttempt,
  getAttemptQuestions,
  saveAttempt,
  saveQuiz,
} from "@/lib/blob";
import { generateId } from "@/lib/utils";
import { sampleQuestions, pickQuestionsByIds } from "@/lib/sampling";
import { QUESTION_TYPES } from "@/lib/constants/question-types";
import type { Attempt, Quiz, QuizQuestion } from "@/lib/types";

/**
 * Spawn a practice attempt in one of three shapes:
 *   1. { kind: "wrong-only", sourceAttemptId }
 *      → new attempt with only the missed questions from the source attempt,
 *        on the same quiz config.
 *   2. { kind: "drill", chapters: string[], count?: number, mode?: "quiz"|"exam" }
 *      → synthesize a new Quiz + Attempt pulling from the chapter bank.
 *   3. { kind: "questions", questionIds: string[], title?: string }
 *      → practice attempt over a specific set of question IDs (used for
 *        flagged/missed library replays).
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { kind } = body as { kind: "wrong-only" | "drill" | "questions" };

  if (kind === "wrong-only") {
    return spawnWrongOnly(body);
  }
  if (kind === "drill") {
    return spawnChapterDrill(body);
  }
  if (kind === "questions") {
    return spawnFromQuestionIds(body);
  }

  return NextResponse.json({ error: "Unknown drill kind" }, { status: 400 });
}

async function spawnWrongOnly(body: {
  sourceAttemptId?: unknown;
}) {
  const sourceAttemptId =
    typeof body.sourceAttemptId === "string"
      ? body.sourceAttemptId
      : undefined;
  if (!sourceAttemptId) {
    return NextResponse.json(
      { error: "sourceAttemptId is required for wrong-only replay" },
      { status: 400 }
    );
  }

  const source = await getAttempt(sourceAttemptId);
  if (!source) {
    return NextResponse.json(
      { error: "Source attempt not found" },
      { status: 404 }
    );
  }

  const wrongIds = source.answers
    .filter((a) => !a.isCorrect)
    .map((a) => a.questionId);

  if (wrongIds.length === 0) {
    return NextResponse.json(
      { error: "Nothing to review — every answer was correct" },
      { status: 400 }
    );
  }

  const questions = pickQuestionsByIds(wrongIds);
  return createAttempt({
    quizId: source.quizId,
    quizTitle: `${source.quizTitle ?? "Quiz"} — review wrong`,
    mode: "quiz",
    timeLimitSeconds: null,
    questions,
    sourceAttemptId,
    sourceKind: "wrong-only",
  });
}

async function spawnChapterDrill(body: {
  chapters?: unknown;
  count?: unknown;
  mode?: unknown;
  timeLimitMinutes?: unknown;
}) {
  const chapters = Array.isArray(body.chapters)
    ? body.chapters.filter((c): c is string => typeof c === "string")
    : [];
  if (chapters.length === 0) {
    return NextResponse.json(
      { error: "chapters is required (string[])" },
      { status: 400 }
    );
  }

  const rawCount = Number(body.count ?? 10);
  const count = Number.isFinite(rawCount)
    ? Math.min(100, Math.max(1, Math.trunc(rawCount)))
    : 10;

  const mode = body.mode === "exam" ? "exam" : "quiz";

  const rawMinutes = Number(body.timeLimitMinutes);
  const timeLimitMinutes = Number.isFinite(rawMinutes)
    ? Math.min(180, Math.max(1, Math.trunc(rawMinutes)))
    : undefined;

  const questions = sampleQuestions(chapters, count);
  if (questions.length === 0) {
    return NextResponse.json(
      { error: "No questions available in selected chapters" },
      { status: 400 }
    );
  }

  const names = chapters.map(
    (slug) => QUESTION_TYPES[slug]?.name ?? slug
  );
  const title =
    chapters.length === 1
      ? `Drill: ${names[0]}`
      : `Drill: ${chapters.length} chapters`;

  // Synthesize a Quiz config for provenance (so dashboard can show it)
  const quiz: Quiz = {
    id: generateId(),
    title,
    type: mode,
    questionTypes: chapters,
    questionCount: questions.length,
    timeLimitMinutes:
      timeLimitMinutes ?? (mode === "exam" ? 35 : 15),
    createdAt: new Date().toISOString(),
  };
  await saveQuiz(quiz);

  return createAttempt({
    quizId: quiz.id,
    quizTitle: quiz.title,
    mode: quiz.type,
    timeLimitSeconds:
      quiz.type === "exam" ? quiz.timeLimitMinutes * 60 : null,
    questions,
    sourceKind: "drill",
  });
}

async function spawnFromQuestionIds(body: {
  questionIds?: unknown;
  title?: unknown;
  sourceAttemptId?: unknown;
}) {
  const questionIds = Array.isArray(body.questionIds)
    ? body.questionIds
        .filter((id): id is string => typeof id === "string")
        .slice(0, 200) // cap
    : [];
  const title = typeof body.title === "string" ? body.title.slice(0, 120) : undefined;
  const sourceAttemptId =
    typeof body.sourceAttemptId === "string"
      ? body.sourceAttemptId
      : undefined;

  if (questionIds.length === 0) {
    return NextResponse.json(
      { error: "questionIds is required (non-empty string[])" },
      { status: 400 }
    );
  }

  const questions = pickQuestionsByIds(questionIds);
  if (questions.length === 0) {
    return NextResponse.json(
      { error: "No matching questions found" },
      { status: 404 }
    );
  }

  // Synthesize a Quiz so the attempt has a stable parent
  const quiz: Quiz = {
    id: generateId(),
    title: title ?? "Custom practice",
    type: "quiz",
    questionTypes: Array.from(
      new Set(questions.map((q) => q.questionType))
    ),
    questionCount: questions.length,
    timeLimitMinutes: 15,
    createdAt: new Date().toISOString(),
  };
  await saveQuiz(quiz);

  // If the source attempt is known, thread it
  let sourceKind: Attempt["sourceKind"] = "drill";
  if (sourceAttemptId) {
    const src = await getAttempt(sourceAttemptId);
    if (src) sourceKind = "drill";
  }

  return createAttempt({
    quizId: quiz.id,
    quizTitle: quiz.title,
    mode: "quiz",
    timeLimitSeconds: null,
    questions,
    sourceAttemptId,
    sourceKind,
  });
}

async function createAttempt(args: {
  quizId: string;
  quizTitle: string;
  mode: "quiz" | "exam";
  timeLimitSeconds: number | null;
  questions: QuizQuestion[];
  sourceAttemptId?: string;
  sourceKind: Attempt["sourceKind"];
}) {
  const attempt: Attempt = {
    id: generateId(),
    quizId: args.quizId,
    quizTitle: args.quizTitle,
    mode: args.mode,
    timeLimitSeconds: args.timeLimitSeconds,
    startedAt: new Date().toISOString(),
    completedAt: null,
    timeSpentSeconds: null,
    score: null,
    totalQuestions: args.questions.length,
    status: "in_progress",
    answers: [],
    questions: args.questions,
    flaggedQuestionIds: [],
    notesByQuestionId: {},
    sourceAttemptId: args.sourceAttemptId,
    sourceKind: args.sourceKind,
  };

  await saveAttempt(attempt);

  // Prevent use of the internal helper's `getAttemptQuestions` — we already
  // have them inline. Still, validate non-empty.
  await getAttemptQuestions(attempt);

  return NextResponse.json({
    attemptId: attempt.id,
    quizId: attempt.quizId,
    startedAt: attempt.startedAt,
    timeLimitSeconds: attempt.timeLimitSeconds,
  });
}
