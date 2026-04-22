import { NextResponse } from "next/server";
import {
  getAttempt,
  getAttemptQuestions,
  getQuiz,
  updateAttempt,
} from "@/lib/blob";

export const dynamic = "force-dynamic";

/**
 * GET an attempt. Two response shapes:
 *   - default: full results (includes correct answers, explanations, notes)
 *   - ?view=take: safe shape for the quiz-taker (no correct answers, no explanations)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  const url = new URL(request.url);
  const view = url.searchParams.get("view");

  const attempt = await getAttempt(attemptId);
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  const questions = await getAttemptQuestions(attempt);
  if (questions.length === 0) {
    return NextResponse.json(
      { error: "Attempt has no questions" },
      { status: 500 }
    );
  }

  if (view === "take") {
    const safe = questions.map((q) => ({
      id: q.id,
      questionNumber: q.questionNumber,
      questionType: q.questionType,
      stimulus: q.stimulus,
      questionStem: q.questionStem,
      choices: q.choices,
    }));

    return NextResponse.json({
      id: attempt.id,
      quizId: attempt.quizId,
      quizTitle: attempt.quizTitle ?? null,
      mode: attempt.mode ?? "quiz",
      startedAt: attempt.startedAt,
      timeLimitSeconds: attempt.timeLimitSeconds ?? null,
      status: attempt.status,
      totalQuestions: safe.length,
      questions: safe,
      flaggedQuestionIds: attempt.flaggedQuestionIds ?? [],
    });
  }

  // Full results view: include correct answers and explanations
  const quiz = await getQuiz(attempt.quizId);
  const notes = attempt.notesByQuestionId ?? {};
  const flagged = new Set(attempt.flaggedQuestionIds ?? []);

  const questionsWithAnswers = questions.map((q) => {
    const answer = attempt.answers.find((a) => a.questionId === q.id);
    return {
      ...q,
      selectedAnswer: answer?.selectedAnswer ?? null,
      isCorrect: answer?.isCorrect ?? false,
      answerTimeSpent: answer?.timeSpentSeconds ?? 0,
      flagged: flagged.has(q.id),
      note: notes[q.id] ?? "",
    };
  });

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      quizId: attempt.quizId,
      mode: attempt.mode ?? quiz?.type ?? "quiz",
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      timeSpentSeconds: attempt.timeSpentSeconds,
      score: attempt.score,
      totalQuestions: attempt.totalQuestions,
      status: attempt.status,
      sourceKind: attempt.sourceKind ?? "fresh",
      sourceAttemptId: attempt.sourceAttemptId ?? null,
      flaggedQuestionIds: attempt.flaggedQuestionIds ?? [],
    },
    quiz: {
      title: attempt.quizTitle ?? quiz?.title ?? "Quiz",
      type: attempt.mode ?? quiz?.type ?? "quiz",
      questionTypes: quiz?.questionTypes ?? [],
      timeLimitMinutes: quiz?.timeLimitMinutes ?? null,
    },
    questions: questionsWithAnswers,
  });
}

/**
 * PATCH to update per-question notes after completion.
 * Body: { notes: Record<questionId, noteText> }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  const body = await request.json();
  const { notes } = body as { notes?: Record<string, string> };

  if (!notes || typeof notes !== "object") {
    return NextResponse.json(
      { error: "Body must include `notes` object" },
      { status: 400 }
    );
  }

  const attempt = await getAttempt(attemptId);
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  const merged: Record<string, string> = {
    ...(attempt.notesByQuestionId ?? {}),
  };
  for (const [qId, text] of Object.entries(notes)) {
    const trimmed = (text ?? "").trim();
    if (trimmed.length === 0) {
      delete merged[qId];
    } else {
      merged[qId] = trimmed.slice(0, 2000);
    }
  }

  const updated = { ...attempt, notesByQuestionId: merged };
  await updateAttempt(updated);

  return NextResponse.json({ ok: true, notesByQuestionId: merged });
}
