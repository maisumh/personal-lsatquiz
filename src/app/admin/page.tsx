"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QUESTION_TYPES } from "@/lib/constants/question-types";
import { ScoreChart } from "@/components/admin/score-chart";
import { TypeBreakdown } from "@/components/admin/type-breakdown";

interface DashboardData {
  summary: {
    totalQuizzes: number;
    totalAttempts: number;
    averageScore: number;
    mostRecentScore: number | null;
    mostRecentDate: string | null;
  };
  scoreOverTime: {
    date: string;
    score: number;
    quizTitle: string;
  }[];
  typeBreakdown: {
    type: string;
    accuracy: number;
    correct: number;
    total: number;
  }[];
  recentQuizzes: {
    id: string;
    title: string;
    type: string;
    createdAt: string;
    questionCount: number;
    attempts: number;
    bestScore: number;
    latestAttemptId: string | null;
  }[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="glass rounded-2xl p-8 shimmer">
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, scoreOverTime, typeBreakdown, recentQuizzes } = data;

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full p-4 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 via-rose-500 to-pink-400 bg-clip-text text-transparent">
            LSAT Prep Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track progress and identify areas to improve
          </p>
        </div>
        <a href="/admin/create">
          <Button className="bg-gradient-to-r from-pink-500 to-rose-500 text-white border-0 rounded-xl glow-hover">
            + Create Quiz
          </Button>
        </a>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="glass rounded-2xl p-5 shimmer">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Quizzes
          </p>
          <p className="text-3xl font-bold">{summary.totalQuizzes}</p>
        </div>
        <div className="glass rounded-2xl p-5 shimmer">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Attempts
          </p>
          <p className="text-3xl font-bold">{summary.totalAttempts}</p>
        </div>
        <div className="glass rounded-2xl p-5 shimmer">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Avg Score
          </p>
          <p className="text-3xl font-bold">
            {summary.totalAttempts > 0 ? `${summary.averageScore}%` : "—"}
          </p>
        </div>
        <div className="glass rounded-2xl p-5 shimmer">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Latest
          </p>
          <p className="text-3xl font-bold">
            {summary.mostRecentScore !== null
              ? `${summary.mostRecentScore}%`
              : "—"}
          </p>
        </div>
      </div>

      {/* Charts Row */}
      {scoreOverTime.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="glass-strong rounded-2xl p-5">
            <h2 className="text-sm font-semibold mb-4">Score Over Time</h2>
            <ScoreChart data={scoreOverTime} />
          </div>
          <div className="glass-strong rounded-2xl p-5">
            <h2 className="text-sm font-semibold mb-4">
              Accuracy by Question Type
            </h2>
            <TypeBreakdown data={typeBreakdown} />
          </div>
        </div>
      )}

      {/* Empty State */}
      {scoreOverTime.length === 0 && (
        <div className="glass-strong rounded-2xl p-12 mb-8 text-center">
          <p className="text-muted-foreground mb-4">
            No quiz attempts yet. Create a quiz and send the link to get
            started!
          </p>
          <a href="/admin/create">
            <Button className="bg-gradient-to-r from-pink-500 to-rose-500 text-white border-0 rounded-xl glow-hover">
              Create First Quiz
            </Button>
          </a>
        </div>
      )}

      {/* Recent Quizzes */}
      {recentQuizzes.length > 0 && (
        <div className="glass-strong rounded-2xl p-5">
          <h2 className="text-sm font-semibold mb-4">Recent Quizzes</h2>
          <div className="space-y-2">
            {recentQuizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="flex items-center justify-between p-3 rounded-xl glass hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Badge
                    variant="outline"
                    className="text-xs shrink-0 uppercase"
                  >
                    {quiz.type}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {quiz.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(quiz.createdAt).toLocaleDateString()} &middot;{" "}
                      {quiz.questionCount} questions
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {quiz.attempts > 0 ? `${quiz.bestScore}%` : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {quiz.attempts} attempt{quiz.attempts !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {/* View results if there's a completed attempt */}
                  {quiz.latestAttemptId && (
                    <a
                      href={`/quiz/${quiz.id}/results/${quiz.latestAttemptId}`}
                      className="p-2 rounded-lg hover:bg-accent transition-colors"
                      title="View latest results"
                    >
                      <svg
                        className="w-4 h-4 text-muted-foreground"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </a>
                  )}
                  {/* Copy quiz link */}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/quiz/${quiz.id}`
                      );
                    }}
                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                    title="Copy quiz link"
                  >
                    <svg
                      className="w-4 h-4 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.455a4.5 4.5 0 00-6.364-6.364L4.5 6.775a4.5 4.5 0 001.242 7.244"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
