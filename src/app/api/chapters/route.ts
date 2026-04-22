import { NextResponse } from "next/server";
import { QUESTION_TYPES } from "@/lib/constants/question-types";
import { QUESTION_BANK } from "@/lib/data/question-bank";

export const dynamic = "force-static";

/**
 * Return the list of chapters with available question counts.
 * Keeps the full QUESTION_BANK off the client bundle.
 */
export function GET() {
  const chapters = Object.entries(QUESTION_TYPES).map(([slug, info]) => ({
    slug,
    name: info.name,
    chapter: info.chapter,
    description: info.description,
    count: QUESTION_BANK[slug]?.length ?? 0,
  }));
  chapters.sort((a, b) => a.chapter - b.chapter);
  return NextResponse.json({ chapters });
}
