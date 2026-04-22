"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { QUESTION_TYPES } from "@/lib/constants/question-types";

interface QuizInfo {
  id: string;
  title: string;
  type: "quiz" | "exam";
  questionTypes: string[];
  questionCount: number;
  timeLimitMinutes: number;
}

export default function QuizLanding() {
  const params = useParams();
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuizInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/quiz/${params.quizId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setQuiz)
      .catch(() => setError("Quiz not found"))
      .finally(() => setLoading(false));
  }, [params.quizId]);

  const handleStart = async () => {
    setStarting(true);
    const res = await fetch("/api/attempt/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId: params.quizId }),
    });
    if (!res.ok) {
      setError("Could not start attempt");
      setStarting(false);
      return;
    }
    const { attemptId, startedAt, timeLimitSeconds } = await res.json();
    sessionStorage.setItem(
      `attempt-${params.quizId}`,
      JSON.stringify({ attemptId, startedAt, timeLimitSeconds })
    );
    router.push(`/quiz/${params.quizId}/take`);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="glass rounded-3xl p-8 shimmer">
          <p className="text-muted-foreground serif-italic">Loading…</p>
        </div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="glass rounded-3xl p-8">
          <p className="text-destructive">{error ?? "Quiz not found"}</p>
        </div>
      </div>
    );
  }

  const isExam = quiz.type === "exam";

  return (
    <div className="flex-1 flex items-center justify-center p-4 md:p-8">
      <div className="paper-card p-8 md:p-12 max-w-xl w-full page-enter relative overflow-hidden">
        {/* Ornamental corner mark */}
        <div
          className="absolute top-6 right-6 text-[color:var(--gold)] opacity-70 serif-italic text-sm"
          aria-hidden="true"
        >
          {isExam ? "— timed —" : "— untimed —"}
        </div>

        <p className="small-caps text-muted-foreground mb-4 text-xs">
          {isExam ? "Logical Reasoning · Exam" : "Logical Reasoning · Practice"}
        </p>

        <h1
          className="font-display text-4xl md:text-5xl leading-[1.05] tracking-tight mb-6"
          style={{ fontVariationSettings: '"opsz" 144, "SOFT" 10' }}
        >
          {quiz.title}
        </h1>

        <div className="rule-ornament mb-6 text-xs">
          <span>§</span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <Stat
            label="Questions"
            value={String(quiz.questionCount)}
            hint={isExam ? "LSAT-authentic set" : "sampled fresh each take"}
          />
          <Stat
            label={isExam ? "Time limit" : "Time"}
            value={isExam ? `${quiz.timeLimitMinutes}:00` : "∞"}
            hint={isExam ? "auto-submits at 0:00" : "take your time"}
          />
        </div>

        <div className="flex flex-wrap gap-1.5 mb-8">
          {quiz.questionTypes.map((type) => (
            <span
              key={type}
              className="text-xs px-2.5 py-1 rounded-full border border-border bg-secondary/60 text-secondary-foreground serif-italic"
            >
              {QUESTION_TYPES[type]?.name ?? type}
            </span>
          ))}
        </div>

        {isExam && (
          <div className="mb-6 p-4 rounded-xl border border-[color:var(--gold)]/40 bg-[color:var(--gold)]/5">
            <p className="text-sm leading-relaxed">
              <span className="serif-italic text-[color:var(--gold-foreground)] font-semibold">
                Exam mode.
              </span>{" "}
              You&apos;ll see a live countdown. Flag questions to return to them,
              but the section auto-submits at zero — just like the real thing.
            </p>
          </div>
        )}

        <Button
          onClick={handleStart}
          disabled={starting}
          className={`w-full h-14 text-base font-semibold rounded-2xl tap-target glow-hover border-0 transition-all ${
            isExam
              ? "bg-foreground text-background hover:opacity-90"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {starting
            ? "Starting…"
            : isExam
              ? "Begin Exam"
              : "Begin Practice"}
        </Button>

        <p className="text-xs text-muted-foreground mt-4 text-center serif-italic">
          Good luck.
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="small-caps text-[10px] text-muted-foreground mb-1">
        {label}
      </p>
      <p className="numeral text-4xl leading-none text-foreground">{value}</p>
      {hint && (
        <p className="text-[11px] text-muted-foreground mt-1.5 serif-italic">
          {hint}
        </p>
      )}
    </div>
  );
}
