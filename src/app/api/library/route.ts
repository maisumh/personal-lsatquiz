import { NextResponse } from "next/server";
import { listAttempts } from "@/lib/blob";
import { QUESTION_BANK } from "@/lib/data/question-bank";
import { QUESTION_TYPES } from "@/lib/constants/question-types";

export const dynamic = "force-dynamic";

/**
 * Cross-attempt library of flagged + missed questions. Shows the user
 * what they've marked or gotten wrong so they can replay / study.
 *
 * For each question ID we aggregate:
 *   - total times seen, total times correct
 *   - latest attempt where it was flagged/missed (for a "recent" feel)
 *   - ever-flagged across attempts
 */
export async function GET() {
  const attempts = await listAttempts();
  const completed = attempts.filter(
    (a) => a.status === "completed" || a.status === "timed_out"
  );

  // question id -> aggregated stats
  type Entry = {
    questionId: string;
    questionType: string;
    chapter: number;
    questionStem: string;
    timesSeen: number;
    timesCorrect: number;
    everFlagged: boolean;
    lastSeenAt: string | null;
    lastAttemptId: string | null;
    lastSelectedAnswer: string | null;
    lastWasCorrect: boolean;
  };

  const byQuestion = new Map<string, Entry>();

  // Build a question-id → bank lookup for stems/types
  const bankIndex = new Map<
    string,
    { questionStem: string; questionType: string }
  >();
  for (const slug of Object.keys(QUESTION_BANK)) {
    for (const q of QUESTION_BANK[slug]) {
      bankIndex.set(q.id, {
        questionStem: q.questionStem,
        questionType: q.questionType,
      });
    }
  }

  for (const a of completed) {
    const flagged = new Set(a.flaggedQuestionIds ?? []);
    for (const ans of a.answers) {
      const ref = bankIndex.get(ans.questionId);
      const type = ans.questionType ?? ref?.questionType ?? "unknown";
      const chapter = QUESTION_TYPES[type]?.chapter ?? 0;
      const existing = byQuestion.get(ans.questionId) ?? {
        questionId: ans.questionId,
        questionType: type,
        chapter,
        questionStem: ref?.questionStem ?? "",
        timesSeen: 0,
        timesCorrect: 0,
        everFlagged: false,
        lastSeenAt: null,
        lastAttemptId: null,
        lastSelectedAnswer: null,
        lastWasCorrect: false,
      };
      existing.timesSeen++;
      if (ans.isCorrect) existing.timesCorrect++;
      if (flagged.has(ans.questionId)) existing.everFlagged = true;

      const attemptDate = a.completedAt ?? a.startedAt;
      if (
        !existing.lastSeenAt ||
        new Date(attemptDate).getTime() > new Date(existing.lastSeenAt).getTime()
      ) {
        existing.lastSeenAt = attemptDate;
        existing.lastAttemptId = a.id;
        existing.lastSelectedAnswer = ans.selectedAnswer;
        existing.lastWasCorrect = ans.isCorrect;
      }
      byQuestion.set(ans.questionId, existing);
    }
  }

  const entries = Array.from(byQuestion.values());

  const flagged = entries
    .filter((e) => e.everFlagged)
    .sort(
      (a, b) =>
        new Date(b.lastSeenAt ?? 0).getTime() -
        new Date(a.lastSeenAt ?? 0).getTime()
    );

  // "Missed" = last attempt got it wrong, and user has seen it at least once
  const missed = entries
    .filter((e) => !e.lastWasCorrect && e.timesSeen > 0)
    .sort(
      (a, b) =>
        new Date(b.lastSeenAt ?? 0).getTime() -
        new Date(a.lastSeenAt ?? 0).getTime()
    );

  return NextResponse.json({
    flagged,
    missed,
    totals: {
      flagged: flagged.length,
      missed: missed.length,
    },
  });
}
