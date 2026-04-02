import { NextResponse } from "next/server";
import { QUESTION_BANK } from "@/lib/data/question-bank";
import { saveQuiz } from "@/lib/blob";
import { generateId, pickQuestions, distributeCount } from "@/lib/utils";
import type { Quiz, QuizQuestion } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json();
  const {
    title,
    type = "quiz",
    questionTypes,
    timeLimitMinutes,
  } = body as {
    title?: string;
    type: "quiz" | "exam";
    questionTypes: string[];
    timeLimitMinutes?: number;
  };

  if (!questionTypes || questionTypes.length === 0) {
    return NextResponse.json(
      { error: "At least one question type is required" },
      { status: 400 }
    );
  }

  const totalQuestions = type === "quiz" ? 10 : 30;
  const timeLimit = timeLimitMinutes ?? (type === "quiz" ? 15 : 45);

  // Distribute questions across selected types
  const distribution = distributeCount(questionTypes, totalQuestions);

  const selectedQuestions: QuizQuestion[] = [];
  let questionNumber = 1;

  for (const [qType, count] of Object.entries(distribution)) {
    const bank = QUESTION_BANK[qType];
    if (!bank || bank.length === 0) continue;

    const picked = pickQuestions(bank, Math.min(count, bank.length));
    for (const q of picked) {
      selectedQuestions.push({
        ...q,
        questionNumber: questionNumber++,
      });
    }
  }

  // Shuffle final question order
  selectedQuestions.sort(() => Math.random() - 0.5);
  selectedQuestions.forEach((q, i) => (q.questionNumber = i + 1));

  const quiz: Quiz = {
    id: generateId(),
    title:
      title ||
      questionTypes
        .map((t) => t.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()))
        .join(" + "),
    type,
    questionTypes,
    timeLimitMinutes: timeLimit,
    createdAt: new Date().toISOString(),
    questions: selectedQuestions,
  };

  try {
    await saveQuiz(quiz);
  } catch (err) {
    console.error("Failed to save quiz:", err);
    return NextResponse.json(
      { error: "Failed to save quiz. Check that Blob storage is connected." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: quiz.id,
    title: quiz.title,
    questionCount: quiz.questions.length,
    timeLimitMinutes: quiz.timeLimitMinutes,
  });
}
