import { NextResponse } from "next/server";
import { getAttempt, getAttemptQuestions, updateAttempt } from "@/lib/blob";
import type { Answer } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  const body = await request.json();
  const {
    answers: submittedAnswers,
    flaggedQuestionIds = [],
    timedOut = false,
  } = body as {
    answers: Record<
      string,
      { selectedAnswer: string | null; timeSpentSeconds: number }
    >;
    flaggedQuestionIds?: string[];
    timedOut?: boolean;
  };

  const attempt = await getAttempt(attemptId);
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  if (attempt.status !== "in_progress") {
    return NextResponse.json(
      { error: "Attempt already submitted" },
      { status: 400 }
    );
  }

  const questions = await getAttemptQuestions(attempt);
  if (questions.length === 0) {
    return NextResponse.json(
      { error: "Attempt has no questions to grade" },
      { status: 500 }
    );
  }

  // Server-side timeout enforcement for exam mode: if the wall-clock has
  // exceeded the limit, force the status to timed_out regardless of the
  // client flag. Prevents a hung/offline client from stealing extra time.
  const startedMs = new Date(attempt.startedAt).getTime();
  const elapsedSeconds = Math.round((Date.now() - startedMs) / 1000);
  const serverTimedOut =
    (attempt.timeLimitSeconds ?? 0) > 0 &&
    elapsedSeconds > (attempt.timeLimitSeconds ?? 0) + 2; // 2s grace

  // Grade answers against the attempt's own question snapshot
  const gradedAnswers: Answer[] = questions.map((q) => {
    const submitted = submittedAnswers?.[q.id];
    const selectedAnswer =
      (submitted?.selectedAnswer as Answer["selectedAnswer"]) ?? null;
    return {
      questionId: q.id,
      questionType: q.questionType,
      selectedAnswer,
      isCorrect: selectedAnswer === q.correctAnswer,
      timeSpentSeconds: submitted?.timeSpentSeconds ?? 0,
    };
  });

  const score = gradedAnswers.filter((a) => a.isCorrect).length;
  const now = new Date().toISOString();

  const updatedAttempt = {
    ...attempt,
    completedAt: now,
    timeSpentSeconds: elapsedSeconds,
    score,
    status:
      timedOut || serverTimedOut
        ? ("timed_out" as const)
        : ("completed" as const),
    answers: gradedAnswers,
    flaggedQuestionIds: Array.from(new Set(flaggedQuestionIds)),
  };

  await updateAttempt(updatedAttempt);

  // Return the full results payload so the client renders from response
  // and avoids a read-after-write consistency window on Blob.
  const flagged = new Set(updatedAttempt.flaggedQuestionIds ?? []);
  const questionsWithAnswers = questions.map((q) => {
    const answer = gradedAnswers.find((a) => a.questionId === q.id);
    return {
      ...q,
      selectedAnswer: answer?.selectedAnswer ?? null,
      isCorrect: answer?.isCorrect ?? false,
      answerTimeSpent: answer?.timeSpentSeconds ?? 0,
      flagged: flagged.has(q.id),
      note: attempt.notesByQuestionId?.[q.id] ?? "",
    };
  });

  return NextResponse.json({
    attempt: {
      id: updatedAttempt.id,
      quizId: updatedAttempt.quizId,
      mode: updatedAttempt.mode ?? "quiz",
      startedAt: updatedAttempt.startedAt,
      completedAt: updatedAttempt.completedAt,
      timeSpentSeconds: elapsedSeconds,
      score,
      totalQuestions: questions.length,
      status: updatedAttempt.status,
      flaggedQuestionIds: updatedAttempt.flaggedQuestionIds,
    },
    quiz: {
      title: attempt.quizTitle ?? "Quiz",
      type: attempt.mode ?? "quiz",
      questionTypes: [],
      timeLimitMinutes: attempt.timeLimitSeconds
        ? Math.round(attempt.timeLimitSeconds / 60)
        : null,
    },
    questions: questionsWithAnswers,
  });
}
