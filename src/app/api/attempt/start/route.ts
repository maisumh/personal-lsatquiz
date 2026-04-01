import { NextResponse } from "next/server";
import { getQuiz, saveAttempt } from "@/lib/blob";
import { generateId } from "@/lib/utils";
import type { Attempt } from "@/lib/types";

export async function POST(request: Request) {
  const { quizId } = (await request.json()) as { quizId: string };

  const quiz = await getQuiz(quizId);
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const attempt: Attempt = {
    id: generateId(),
    quizId,
    startedAt: new Date().toISOString(),
    completedAt: null,
    timeSpentSeconds: null,
    score: null,
    totalQuestions: quiz.questions.length,
    status: "in_progress",
    answers: [],
  };

  await saveAttempt(attempt, quiz.title);

  return NextResponse.json({
    attemptId: attempt.id,
    startedAt: attempt.startedAt,
  });
}
