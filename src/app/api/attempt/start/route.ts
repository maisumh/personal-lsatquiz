import { NextResponse } from "next/server";
import { getQuiz, saveAttempt } from "@/lib/blob";
import { generateId } from "@/lib/utils";
import { sampleQuestions, pickQuestionsByIds } from "@/lib/sampling";
import type { Attempt, AttemptSourceKind, QuizQuestion } from "@/lib/types";

/**
 * Start a new attempt. Samples a fresh set of questions unless the caller
 * asks for a wrong-only replay or explicit question list.
 *
 * Request body:
 *   { quizId: string,
 *     sourceAttemptId?: string,
 *     sourceKind?: "retake" | "wrong-only" | "drill",
 *     questionIds?: string[]   // override: use these exact questions }
 */
export async function POST(request: Request) {
  const body = await request.json();
  const {
    quizId,
    sourceAttemptId,
    sourceKind,
    questionIds,
  } = body as {
    quizId: string;
    sourceAttemptId?: string;
    sourceKind?: AttemptSourceKind;
    questionIds?: string[];
  };

  const quiz = await getQuiz(quizId);
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  let questions: QuizQuestion[];
  if (questionIds && questionIds.length > 0) {
    questions = pickQuestionsByIds(questionIds);
  } else {
    const count = quiz.questionCount ?? quiz.questions?.length ?? 10;
    questions = sampleQuestions(quiz.questionTypes, count);
  }

  if (questions.length === 0) {
    return NextResponse.json(
      { error: "Could not sample any questions for this quiz" },
      { status: 400 }
    );
  }

  const timeLimitSeconds =
    quiz.type === "exam" ? quiz.timeLimitMinutes * 60 : null;

  const attempt: Attempt = {
    id: generateId(),
    quizId,
    quizTitle: quiz.title,
    mode: quiz.type,
    timeLimitSeconds,
    startedAt: new Date().toISOString(),
    completedAt: null,
    timeSpentSeconds: null,
    score: null,
    totalQuestions: questions.length,
    status: "in_progress",
    answers: [],
    questions,
    flaggedQuestionIds: [],
    notesByQuestionId: {},
    sourceAttemptId,
    sourceKind: sourceKind ?? "fresh",
  };

  await saveAttempt(attempt);

  return NextResponse.json({
    attemptId: attempt.id,
    quizId: attempt.quizId,
    startedAt: attempt.startedAt,
    timeLimitSeconds,
  });
}
