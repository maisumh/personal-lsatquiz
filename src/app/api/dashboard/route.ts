import { NextResponse } from "next/server";
import { getIndex, listAttempts } from "@/lib/blob";
import { QUESTION_TYPES } from "@/lib/constants/question-types";

export const dynamic = "force-dynamic";

export async function GET() {
  const [index, allAttempts] = await Promise.all([
    getIndex(),
    listAttempts(),
  ]);

  const completed = allAttempts.filter(
    (a) => a.status === "completed" || a.status === "timed_out"
  );

  const totalQuizzes = index.quizzes.length;
  const totalAttempts = completed.length;

  const averageScore =
    totalAttempts > 0
      ? Math.round(
          (completed.reduce(
            (sum, a) => sum + ((a.score ?? 0) / a.totalQuestions) * 100,
            0
          ) /
            totalAttempts) *
            10
        ) / 10
      : 0;

  const mostRecent =
    completed.length > 0
      ? [...completed].sort(
          (a, b) =>
            new Date(b.completedAt!).getTime() -
            new Date(a.completedAt!).getTime()
        )[0]
      : null;

  const scoreOverTime = [...completed]
    .sort(
      (a, b) =>
        new Date(a.completedAt!).getTime() -
        new Date(b.completedAt!).getTime()
    )
    .map((a) => ({
      date: a.completedAt,
      score: Math.round(((a.score ?? 0) / a.totalQuestions) * 100),
      quizTitle: a.quizTitle ?? "",
      mode: a.mode ?? "quiz",
    }));

  // Per-question-type accuracy aggregated across all attempts
  const typeStats: Record<string, { correct: number; total: number }> = {};
  for (const a of completed) {
    for (const ans of a.answers) {
      if (!typeStats[ans.questionType]) {
        typeStats[ans.questionType] = { correct: 0, total: 0 };
      }
      typeStats[ans.questionType].total++;
      if (ans.isCorrect) typeStats[ans.questionType].correct++;
    }
  }

  const typeBreakdown = Object.entries(typeStats)
    .map(([type, { correct, total }]) => ({
      type,
      name: QUESTION_TYPES[type]?.name ?? type,
      chapter: QUESTION_TYPES[type]?.chapter ?? 0,
      accuracy: Math.round((correct / total) * 100),
      correct,
      total,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  // Flagged + missed aggregated counts (for the "Study" panel)
  const flaggedCount = completed.reduce(
    (sum, a) => sum + (a.flaggedQuestionIds?.length ?? 0),
    0
  );
  const missedCount = completed.reduce(
    (sum, a) => sum + a.answers.filter((ans) => !ans.isCorrect).length,
    0
  );

  // Weakest 3 chapters (lowest accuracy, min 3 attempts)
  const weakestChapters = typeBreakdown
    .filter((t) => t.total >= 3)
    .slice(0, 3);

  return NextResponse.json({
    summary: {
      totalQuizzes,
      totalAttempts,
      averageScore,
      mostRecentScore: mostRecent
        ? Math.round(
            ((mostRecent.score ?? 0) / mostRecent.totalQuestions) * 100
          )
        : null,
      mostRecentDate: mostRecent?.completedAt ?? null,
      flaggedCount,
      missedCount,
    },
    scoreOverTime,
    typeBreakdown,
    weakestChapters,
    recentQuizzes: index.quizzes
      .map((q) => {
        const quizAttempts = allAttempts.filter((a) => a.quizId === q.id);
        const completedForQuiz = quizAttempts.filter(
          (a) =>
            a.score !== null &&
            (a.status === "completed" || a.status === "timed_out")
        );
        const latestAttempt = [...completedForQuiz].sort(
          (a, b) =>
            new Date(b.completedAt ?? 0).getTime() -
            new Date(a.completedAt ?? 0).getTime()
        )[0];
        return {
          ...q,
          attempts: quizAttempts.length,
          bestScore:
            completedForQuiz.length > 0
              ? Math.max(
                  ...completedForQuiz.map((a) =>
                    Math.round(((a.score ?? 0) / a.totalQuestions) * 100)
                  )
                )
              : 0,
          latestAttemptId: latestAttempt?.id ?? null,
          lastTakenAt: latestAttempt?.completedAt ?? null,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.lastTakenAt ?? 0).getTime() -
          new Date(a.lastTakenAt ?? 0).getTime()
      ),
  });
}
