import { NextResponse } from "next/server";
import { getAttempt, getQuiz } from "@/lib/blob";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const { attemptId } = await params;
  const attempt = await getAttempt(attemptId);

  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  const quiz = await getQuiz(attempt.quizId);
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  // Include full question data with correct answers for results review
  const questionsWithAnswers = quiz.questions.map((q) => {
    const answer = attempt.answers.find((a) => a.questionId === q.id);
    return {
      ...q,
      selectedAnswer: answer?.selectedAnswer ?? null,
      isCorrect: answer?.isCorrect ?? false,
      answerTimeSpent: answer?.timeSpentSeconds ?? 0,
    };
  });

  return NextResponse.json({
    attempt: {
      id: attempt.id,
      quizId: attempt.quizId,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      timeSpentSeconds: attempt.timeSpentSeconds,
      score: attempt.score,
      totalQuestions: attempt.totalQuestions,
      status: attempt.status,
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
