import { NextResponse } from "next/server";
import { getQuiz, getAttempt, updateAttempt } from "@/lib/blob";
import type { Answer } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  const body = await request.json();
  const { answers: submittedAnswers, timedOut = false } = body as {
    answers: Record<string, { selectedAnswer: string | null; timeSpentSeconds: number }>;
    timedOut?: boolean;
  };

  // Debug: log what we received
  const answeredCount = Object.values(submittedAnswers || {}).filter(
    (a) => a?.selectedAnswer !== null
  ).length;
  console.log(`[SUBMIT] attemptId=${attemptId}, answeredCount=${answeredCount}, keys=${Object.keys(submittedAnswers || {}).length}`);

  const attempt = await getAttempt(attemptId);
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  if (attempt.status !== "in_progress") {
    return NextResponse.json({ error: "Attempt already submitted" }, { status: 400 });
  }

  const quiz = await getQuiz(attempt.quizId);
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  // Grade answers
  const gradedAnswers: Answer[] = quiz.questions.map((q) => {
    const submitted = submittedAnswers[q.id];
    const selectedAnswer = (submitted?.selectedAnswer as Answer["selectedAnswer"]) ?? null;
    console.log(`[GRADE] q.id=${q.id}, submitted=${JSON.stringify(submitted)}, selectedAnswer=${selectedAnswer}, correctAnswer=${q.correctAnswer}, match=${selectedAnswer === q.correctAnswer}`);
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
  const startedAt = new Date(attempt.startedAt).getTime();
  const timeSpentSeconds = Math.round((Date.now() - startedAt) / 1000);

  const updatedAttempt = {
    ...attempt,
    completedAt: now,
    timeSpentSeconds,
    score,
    status: timedOut ? ("timed_out" as const) : ("completed" as const),
    answers: gradedAnswers,
  };

  await updateAttempt(updatedAttempt, quiz.title);

  // Return full results data so the client doesn't need a separate read
  const questionsWithAnswers = quiz.questions.map((q) => {
    const answer = gradedAnswers.find((a) => a.questionId === q.id);
    return {
      ...q,
      selectedAnswer: answer?.selectedAnswer ?? null,
      isCorrect: answer?.isCorrect ?? false,
      answerTimeSpent: answer?.timeSpentSeconds ?? 0,
    };
  });

  return NextResponse.json({
    attempt: {
      id: updatedAttempt.id,
      quizId: updatedAttempt.quizId,
      startedAt: updatedAttempt.startedAt,
      completedAt: updatedAttempt.completedAt,
      timeSpentSeconds,
      score,
      totalQuestions: quiz.questions.length,
      status: updatedAttempt.status,
    },
    quiz: {
      title: quiz.title,
      type: quiz.type,
      questionTypes: quiz.questionTypes,
      timeLimitMinutes: quiz.timeLimitMinutes,
    },
    questions: questionsWithAnswers,
  });
}
