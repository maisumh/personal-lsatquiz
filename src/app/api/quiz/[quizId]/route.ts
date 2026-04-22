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

  return NextResponse.json({
    id: quiz.id,
    title: quiz.title,
    type: quiz.type,
    questionTypes: quiz.questionTypes,
    questionCount: quiz.questionCount ?? quiz.questions?.length ?? 10,
    timeLimitMinutes: quiz.timeLimitMinutes,
    createdAt: quiz.createdAt,
  });
}
