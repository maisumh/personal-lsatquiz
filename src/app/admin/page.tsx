"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScoreChart } from "@/components/admin/score-chart";
import { TypeBreakdown } from "@/components/admin/type-breakdown";

interface DashboardData {
  summary: {
    totalQuizzes: number;
    totalAttempts: number;
    averageScore: number;
    mostRecentScore: number | null;
    mostRecentDate: string | null;
    flaggedCount: number;
    missedCount: number;
  };
  scoreOverTime: {
    date: string;
    score: number;
    quizTitle: string;
    mode?: string;
  }[];
  typeBreakdown: {
    type: string;
    name: string;
    chapter: number;
    accuracy: number;
    correct: number;
    total: number;
  }[];
  weakestChapters: {
    type: string;
    name: string;
    chapter: number;
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
    lastTakenAt: string | null;
  }[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [drillingSlug, setDrillingSlug] = useState<string | null>(null);
  const [startingQuizId, setStartingQuizId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const startQuizAttempt = async (quizId: string) => {
    setStartingQuizId(quizId);
    setActionError(null);
    try {
      const res = await fetch("/api/attempt/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId }),
      });
      if (!res.ok) throw new Error(`Could not start attempt (${res.status})`);
      const { attemptId, startedAt, timeLimitSeconds } = await res.json();
      sessionStorage.setItem(
        `attempt-${quizId}`,
        JSON.stringify({ attemptId, startedAt, timeLimitSeconds })
      );
      router.push(`/quiz/${quizId}/take`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not start attempt"
      );
      setStartingQuizId(null);
    }
  };

  const startDrill = async (slug: string) => {
    setDrillingSlug(slug);
    setActionError(null);
    try {
      const res = await fetch("/api/drill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "drill",
          chapters: [slug],
          count: 10,
          mode: "quiz",
        }),
      });
      if (!res.ok) throw new Error(`Could not start drill (${res.status})`);
      const { attemptId, quizId, startedAt, timeLimitSeconds } = await res.json();
      sessionStorage.setItem(
        `attempt-${quizId}`,
        JSON.stringify({ attemptId, startedAt, timeLimitSeconds })
      );
      router.push(`/quiz/${quizId}/take`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not start drill"
      );
      setDrillingSlug(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="glass rounded-2xl p-8 shimmer">
          <p className="text-muted-foreground serif-italic">
            Loading…
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const {
    summary,
    scoreOverTime,
    typeBreakdown,
    weakestChapters,
    recentQuizzes,
  } = data;

  const weakest = weakestChapters[0];

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-6 page-enter">
      {/* ─── Header ─────────────────────────────────────────── */}
      <header className="flex items-end justify-between mb-8">
        <div>
          <p className="small-caps text-[11px] text-muted-foreground mb-2">
            Logical Reasoning
          </p>
          <h1 className="font-display text-4xl md:text-5xl leading-[1.05] tracking-tight">
            <span className="gradient-text-animated">Study</span>{" "}
            <span className="serif-italic text-foreground/70">room</span>
          </h1>
        </div>
        <a href="/admin/create">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl glow-hover border-0 tap-target">
            + New set
          </Button>
        </a>
      </header>

      {actionError && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm mb-6 flex items-start justify-between gap-3">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-destructive/70 hover:text-destructive shrink-0"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* ─── Summary ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard
          label="Quizzes"
          value={summary.totalQuizzes}
          hint="created"
        />
        <StatCard
          label="Attempts"
          value={summary.totalAttempts}
          hint="finished"
        />
        <StatCard
          label="Avg"
          value={summary.totalAttempts > 0 ? `${summary.averageScore}%` : "—"}
          hint="across all"
        />
        <StatCard
          label="Latest"
          value={
            summary.mostRecentScore != null
              ? `${summary.mostRecentScore}%`
              : "—"
          }
          hint={
            summary.mostRecentDate
              ? new Date(summary.mostRecentDate).toLocaleDateString("en-US", {
                  timeZone: "America/Chicago",
                  month: "short",
                  day: "numeric",
                })
              : " "
          }
        />
      </div>

      {/* ─── Study panel — recommendation + library ────────── */}
      <div className="grid md:grid-cols-2 gap-3 mb-8">
        {weakest ? (
          <div className="paper-card p-5 md:p-6">
            <p className="small-caps text-[10px] text-muted-foreground mb-2">
              Next up
            </p>
            <h3 className="font-display text-2xl leading-tight mb-1">
              Drill {weakest.name}
            </h3>
            <p className="serif-italic text-sm text-muted-foreground mb-4">
              Accuracy {weakest.accuracy}% ({weakest.correct}/{weakest.total}
              ) — your weakest type.
            </p>
            <Button
              onClick={() => startDrill(weakest.type)}
              disabled={drillingSlug === weakest.type}
              className="h-10 px-4 bg-primary text-primary-foreground tap-target"
            >
              {drillingSlug === weakest.type
                ? "Starting…"
                : `Drill 10 questions`}
            </Button>
          </div>
        ) : (
          <div className="paper-card p-5 md:p-6">
            <p className="small-caps text-[10px] text-muted-foreground mb-2">
              Next up
            </p>
            <p className="serif-italic text-muted-foreground text-sm">
              Take a few quizzes and I&apos;ll suggest a weak area to drill.
            </p>
          </div>
        )}

        <div className="paper-card p-5 md:p-6">
          <p className="small-caps text-[10px] text-muted-foreground mb-2">
            Library
          </p>
          <div className="grid grid-cols-2 gap-3">
            <a href="/library?filter=flagged" className="block group">
              <p className="numeral text-3xl text-[color:var(--gold)]">
                {summary.flaggedCount}
              </p>
              <p className="text-xs text-muted-foreground serif-italic group-hover:text-foreground transition-colors">
                flagged →
              </p>
            </a>
            <a href="/library?filter=missed" className="block group">
              <p className="numeral text-3xl text-primary">
                {summary.missedCount}
              </p>
              <p className="text-xs text-muted-foreground serif-italic group-hover:text-foreground transition-colors">
                missed →
              </p>
            </a>
          </div>
        </div>
      </div>

      {/* ─── Charts ────────────────────────────────────────── */}
      {scoreOverTime.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-3 mb-8">
          <div className="paper-card p-5 md:p-6">
            <h2 className="small-caps text-[11px] mb-3">Score over time</h2>
            <ScoreChart data={scoreOverTime} />
          </div>
          <div className="paper-card p-5 md:p-6">
            <h2 className="small-caps text-[11px] mb-3">
              Accuracy by chapter
              <span className="serif-italic text-muted-foreground ml-2 normal-case">
                · tap to drill
              </span>
            </h2>
            <TypeBreakdown
              data={typeBreakdown}
              onDrill={startDrill}
              drillingSlug={drillingSlug}
            />
          </div>
        </div>
      ) : (
        <div className="paper-card p-12 mb-8 text-center">
          <p className="serif-italic text-muted-foreground mb-4">
            No attempts yet. Create a practice set and begin.
          </p>
          <a href="/admin/create">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 border-0 rounded-xl glow-hover tap-target">
              Create first set
            </Button>
          </a>
        </div>
      )}

      {/* ─── Recent sets ───────────────────────────────────── */}
      {recentQuizzes.length > 0 && (
        <div className="paper-card p-5 md:p-6">
          <h2 className="small-caps text-[11px] mb-3">Recent sets</h2>
          <div className="space-y-1.5">
            {recentQuizzes.slice(0, 10).map((quiz) => (
              <div
                key={quiz.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-baseline gap-3 min-w-0">
                  <span className="small-caps text-[10px] text-muted-foreground shrink-0">
                    {quiz.type}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {quiz.title}
                    </p>
                    <p className="text-xs text-muted-foreground serif-italic">
                      {quiz.lastTakenAt
                        ? `taken ${new Date(quiz.lastTakenAt).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                        : `created ${new Date(quiz.createdAt).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" })}`}
                      {" · "}
                      {quiz.questionCount} q
                      {quiz.attempts > 0 && (
                        <>
                          {" · "}best {quiz.bestScore}%
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {quiz.latestAttemptId && (
                    <a
                      href={`/quiz/${quiz.id}/results/${quiz.latestAttemptId}`}
                      className="p-2 rounded-lg hover:bg-accent transition-colors tap-target flex items-center justify-center"
                      title="View latest results"
                    >
                      <EyeIcon />
                    </a>
                  )}
                  <button
                    onClick={() => startQuizAttempt(quiz.id)}
                    disabled={startingQuizId === quiz.id}
                    className="h-10 px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors tap-target text-xs font-semibold disabled:opacity-60"
                    title="Take this set again"
                  >
                    {startingQuizId === quiz.id ? "…" : "Take"}
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

// ─── Primitives ─────────────────────────────────────────────

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="paper-card p-4 md:p-5">
      <p className="small-caps text-[10px] text-muted-foreground mb-1">
        {label}
      </p>
      <p className="numeral text-3xl md:text-4xl leading-none text-foreground">
        {value}
      </p>
      {hint && (
        <p className="text-[11px] text-muted-foreground mt-1.5 serif-italic">
          {hint}
        </p>
      )}
    </div>
  );
}

function EyeIcon() {
  return (
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
  );
}


