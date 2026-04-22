import { NextResponse } from "next/server";
import { saveQuiz } from "@/lib/blob";
import { generateId } from "@/lib/utils";
import { countAvailableQuestions } from "@/lib/sampling";
import type { Quiz } from "@/lib/types";
import { QUESTION_TYPES } from "@/lib/constants/question-types";

const DEFAULTS = {
  quiz: { count: 10, minutes: 15 },
  exam: { count: 25, minutes: 35 }, // LSAT-authentic
};

export async function POST(request: Request) {
  const body = await request.json();
  const {
    title,
    type = "quiz",
    questionTypes,
    questionCount,
    timeLimitMinutes,
  } = body as {
    title?: string;
    type: "quiz" | "exam";
    questionTypes: string[];
    questionCount?: number;
    timeLimitMinutes?: number;
  };

  if (!questionTypes || questionTypes.length === 0) {
    return NextResponse.json(
      { error: "At least one chapter is required" },
      { status: 400 }
    );
  }

  const defaults = DEFAULTS[type] ?? DEFAULTS.quiz;
  const available = countAvailableQuestions(questionTypes);
  if (available === 0) {
    return NextResponse.json(
      { error: "No questions available in the selected chapters" },
      { status: 400 }
    );
  }

  const count = Math.max(
    1,
    Math.min(questionCount ?? defaults.count, available)
  );
  const minutes = Math.max(1, timeLimitMinutes ?? defaults.minutes);

  const derivedTitle =
    title?.trim() ||
    (questionTypes.length === 1
      ? `Ch. ${QUESTION_TYPES[questionTypes[0]]?.chapter ?? ""}: ${
          QUESTION_TYPES[questionTypes[0]]?.name ?? questionTypes[0]
        }`
      : `${questionTypes.length} chapters · mixed`);

  const quiz: Quiz = {
    id: generateId(),
    title: derivedTitle,
    type,
    questionTypes,
    questionCount: count,
    timeLimitMinutes: minutes,
    createdAt: new Date().toISOString(),
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
    type: quiz.type,
    questionCount: quiz.questionCount,
    timeLimitMinutes: quiz.timeLimitMinutes,
  });
}
