import { NextResponse } from "next/server";
import { getIndex, getAttempt } from "@/lib/blob";

export async function GET() {
  const index = await getIndex();

  // Fetch all completed attempts with their answer data
  const attemptDetails = await Promise.all(
    index.attempts
      .filter((a) => a.status === "completed" || a.status === "timed_out")
      .map((a) => getAttempt(a.id))
  );

  const completedAttempts = attemptDetails.filter(Boolean);

  // Calculate overall stats
  const totalQuizzes = index.quizzes.length;
  const totalAttempts = completedAttempts.length;
  const averageScore =
    totalAttempts > 0
      ? Math.round(
          (completedAttempts.reduce(
            (sum, a) => sum + ((a!.score ?? 0) / a!.totalQuestions) * 100,
            0
          ) /
            totalAttempts) *
            10
        ) / 10
      : 0;

  const mostRecent =
    completedAttempts.length > 0
      ? completedAttempts.sort(
          (a, b) =>
            new Date(b!.completedAt!).getTime() -
            new Date(a!.completedAt!).getTime()
        )[0]
      : null;

  // Score over time data
  const scoreOverTime = completedAttempts
    .sort(
      (a, b) =>
        new Date(a!.completedAt!).getTime() -
        new Date(b!.completedAt!).getTime()
    )
    .map((a) => ({
      date: a!.completedAt,
      score: Math.round(((a!.score ?? 0) / a!.totalQuestions) * 100),
      quizTitle: index.attempts.find((ia) => ia.id === a!.id)?.quizTitle ?? "",
    }));

  // Question type breakdown
  const typeStats: Record<string, { correct: number; total: number }> = {};
  for (const attempt of completedAttempts) {
    if (!attempt) continue;
    for (const answer of attempt.answers) {
      if (!typeStats[answer.questionType]) {
        typeStats[answer.questionType] = { correct: 0, total: 0 };
      }
      typeStats[answer.questionType].total++;
      if (answer.isCorrect) {
        typeStats[answer.questionType].correct++;
      }
    }
  }

  const typeBreakdown = Object.entries(typeStats).map(
    ([type, { correct, total }]) => ({
      type,
      accuracy: Math.round((correct / total) * 100),
      correct,
      total,
    })
  );

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
    },
    scoreOverTime,
    typeBreakdown,
    recentQuizzes: index.quizzes
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .map((q) => {
        const quizAttempts = index.attempts.filter((a) => a.quizId === q.id);
        const completedAttempts = quizAttempts.filter(
          (a) => a.score !== null && (a.status === "completed" || a.status === "timed_out")
        );
        const latestAttempt = completedAttempts.sort(
          (a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime()
        )[0];
        return {
          ...q,
          attempts: quizAttempts.length,
          bestScore: completedAttempts.length > 0
            ? Math.max(...completedAttempts.map((a) => Math.round(((a.score ?? 0) / a.totalQuestions) * 100)))
            : 0,
          latestAttemptId: latestAttempt?.id ?? null,
        };
      }),
  });
}
