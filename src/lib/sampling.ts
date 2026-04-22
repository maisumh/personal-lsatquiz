import { QUESTION_BANK } from "@/lib/data/question-bank";
import { distributeCount, pickQuestions } from "@/lib/utils";
import type { QuizQuestion } from "@/lib/types";

/**
 * Sample a fresh set of questions from the bank given chapters and a count.
 * Distributes the count across chapters, shuffles the final order, and
 * assigns sequential questionNumber values.
 */
export function sampleQuestions(
  chapters: string[],
  count: number
): QuizQuestion[] {
  if (chapters.length === 0) return [];

  const distribution = distributeCount(chapters, count);
  const selected: QuizQuestion[] = [];

  for (const [slug, targetCount] of Object.entries(distribution)) {
    const bank = QUESTION_BANK[slug];
    if (!bank || bank.length === 0) continue;
    const picked = pickQuestions(bank, Math.min(targetCount, bank.length));
    for (const q of picked) {
      selected.push({ ...q, questionNumber: 0 });
    }
  }

  // Final shuffle + sequential numbering
  selected.sort(() => Math.random() - 0.5);
  selected.forEach((q, i) => (q.questionNumber = i + 1));

  return selected;
}

/**
 * Return how many questions are available across the given chapter slugs.
 */
export function countAvailableQuestions(chapters: string[]): number {
  return chapters.reduce(
    (sum, slug) => sum + (QUESTION_BANK[slug]?.length ?? 0),
    0
  );
}

/**
 * Resample only specific question IDs from the bank — used for "review
 * wrong only" and spaced-repetition style replays. Returns questions that
 * were found, with fresh questionNumber values.
 */
export function pickQuestionsByIds(ids: string[]): QuizQuestion[] {
  const found: QuizQuestion[] = [];
  for (const slug of Object.keys(QUESTION_BANK)) {
    for (const q of QUESTION_BANK[slug]) {
      if (ids.includes(q.id)) {
        found.push({ ...q, questionNumber: 0 });
      }
    }
  }
  // Preserve caller's order
  found.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  found.forEach((q, i) => (q.questionNumber = i + 1));
  return found;
}
