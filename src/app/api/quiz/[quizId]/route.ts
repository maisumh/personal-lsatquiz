import { NextResponse } from "next/server";
import { getQuiz } from "@/lib/blob";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const { quizId } = await params;
  const quiz = await getQuiz(quizId);

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  // Strip correct answers and explanations for quiz-takers
  const safeQuestions = quiz.questions.map((q) => ({
    id: q.id,
    questionNumber: q.questionNumber,
    questionType: q.questionType,
    stimulus: q.stimulus,
    questionStem: q.questionStem,
    choices: q.choices,
  }));

  return NextResponse.json({
    id: quiz.id,
    title: quiz.title,
    type: quiz.type,
    questionTypes: quiz.questionTypes,
    timeLimitMinutes: quiz.timeLimitMinutes,
    createdAt: quiz.createdAt,
    questions: safeQuestions,
  });
}
