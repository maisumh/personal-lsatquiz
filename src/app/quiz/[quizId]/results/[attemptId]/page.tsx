"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/utils";
import { QUESTION_TYPES } from "@/lib/constants/question-types";

interface ResultQuestion {
  id: string;
  questionNumber: number;
  questionType: string;
  stimulus: string;
  questionStem: string;
  choices: { A: string; B: string; C: string; D: string; E: string };
  correctAnswer: string;
  explanation: string;
  selectedAnswer: string | null;
  isCorrect: boolean;
  answerTimeSpent: number;
  flagged?: boolean;
  note?: string;
}

interface ResultData {
  attempt: {
    id: string;
    quizId: string;
    mode?: "quiz" | "exam";
    score: number;
    totalQuestions: number;
    timeSpentSeconds: number;
    status: string;
    sourceKind?: string;
    flaggedQuestionIds?: string[];
  };
  quiz: {
    title: string;
    type: string;
    timeLimitMinutes: number | null;
  };
  questions: ResultQuestion[];
}

type Filter = "all" | "wrong" | "flagged";

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();

  const [data, setData] = useState<ResultData | null>(() => {
    if (typeof window === "undefined") return null;
    const cached = sessionStorage.getItem("latest-quiz-results");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.attempt?.id === params.attemptId) {
          sessionStorage.removeItem("latest-quiz-results");
          return parsed;
        }
      } catch {
        /* fall through */
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(!data);
  const [filter, setFilter] = useState<Filter>("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [starting, setStarting] = useState<null | "retake" | "wrong-only">(
    null
  );
  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingNotesRef = useRef<Record<string, string> | null>(null);

  // Flush any pending debounced notes save on unmount / route change.
  useEffect(() => {
    return () => {
      if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
      const pending = pendingNotesRef.current;
      if (pending) {
        // Fire-and-forget; use keepalive so the browser completes the request
        // after unload/navigation.
        fetch(`/api/attempt/${params.attemptId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: pending }),
          keepalive: true,
        }).catch(() => {});
        pendingNotesRef.current = null;
      }
    };
  }, [params.attemptId]);

  useEffect(() => {
    if (data) {
      const initial: Record<string, string> = {};
      for (const q of data.questions) {
        if (q.note) initial[q.id] = q.note;
      }
      setNotes(initial);
      return;
    }

    fetch(`/api/attempt/${params.attemptId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: ResultData) => {
        setData(d);
        const initial: Record<string, string> = {};
        for (const q of d.questions) {
          if (q.note) initial[q.id] = q.note;
        }
        setNotes(initial);
      })
      .finally(() => setLoading(false));
  }, [params.attemptId, data]);

  // Debounced autosave of notes. `pendingNotesRef` carries the latest
  // payload so the unmount cleanup can flush if the timer hasn't fired yet.
  const queueNotesSave = useCallback(
    (next: Record<string, string>) => {
      pendingNotesRef.current = next;
      if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
      notesSaveTimer.current = setTimeout(async () => {
        setNotesSaving(true);
        try {
          await fetch(`/api/attempt/${params.attemptId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes: next }),
          });
          pendingNotesRef.current = null;
          setNotesSaved(true);
          setTimeout(() => setNotesSaved(false), 1500);
        } catch {
          /* swallow — unmount cleanup will retry with keepalive */
        } finally {
          setNotesSaving(false);
        }
      }, 700);
    },
    [params.attemptId]
  );

  const updateNote = (qId: string, text: string) => {
    setNotes((prev) => {
      const next = { ...prev, [qId]: text };
      queueNotesSave(next);
      return next;
    });
  };

  const startRetake = async () => {
    if (!data) return;
    setStarting("retake");
    try {
      const res = await fetch("/api/attempt/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: data.attempt.quizId }),
      });
      const { attemptId, startedAt, timeLimitSeconds } = await res.json();
      sessionStorage.setItem(
        `attempt-${data.attempt.quizId}`,
        JSON.stringify({ attemptId, startedAt, timeLimitSeconds })
      );
      router.push(`/quiz/${data.attempt.quizId}/take`);
    } catch {
      setStarting(null);
    }
  };

  const startWrongOnly = async () => {
    if (!data) return;
    setStarting("wrong-only");
    try {
      const res = await fetch("/api/drill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "wrong-only",
          sourceAttemptId: data.attempt.id,
        }),
      });
      if (!res.ok) throw new Error("spawn failed");
      const { attemptId, quizId, startedAt, timeLimitSeconds } = await res.json();
      sessionStorage.setItem(
        `attempt-${quizId}`,
        JSON.stringify({ attemptId, startedAt, timeLimitSeconds })
      );
      router.push(`/quiz/${quizId}/take`);
    } catch {
      setStarting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="glass rounded-2xl p-8 shimmer">
          <p className="text-muted-foreground serif-italic">
            Loading results…
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="glass rounded-2xl p-8">
          <p className="text-destructive">Results not found</p>
        </div>
      </div>
    );
  }

  const { attempt, quiz, questions } = data;
  const percentage = Math.round(
    ((attempt.score ?? 0) / attempt.totalQuestions) * 100
  );
  const isGreat = percentage >= 80;
  const isOkay = percentage >= 60 && percentage < 80;

  const wrongCount = questions.filter((q) => !q.isCorrect).length;
  const flaggedCount = questions.filter((q) => q.flagged).length;

  const filtered = questions.filter((q) => {
    if (filter === "wrong") return !q.isCorrect;
    if (filter === "flagged") return q.flagged;
    return true;
  });

  const showLabel =
    attempt.sourceKind === "wrong-only"
      ? "Review of missed questions"
      : attempt.sourceKind === "drill"
        ? "Drill"
        : quiz.type === "exam"
          ? "Exam"
          : "Practice";

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full p-4 md:p-6 page-enter">
      <div className="mb-4">
        <a
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors serif-italic"
        >
          ← Dashboard
        </a>
      </div>

      {/* ─── Score ─────────────────────────────────────────── */}
      <div className="paper-card p-7 md:p-10 mb-6 text-center relative overflow-hidden">
        <p className="small-caps text-[11px] text-muted-foreground mb-2">
          {showLabel}
        </p>
        <p className="serif-italic text-base text-muted-foreground mb-5 truncate">
          {quiz.title}
        </p>

        <div
          className={`numeral text-[120px] md:text-[160px] leading-none mb-2 ${
            isGreat
              ? "text-[color:var(--sage)]"
              : isOkay
                ? "text-[color:var(--gold)]"
                : "text-primary"
          }`}
        >
          {percentage}
          <span className="text-5xl md:text-6xl align-top serif-italic opacity-60 ml-1">
            %
          </span>
        </div>

        <p className="font-display text-xl md:text-2xl mb-3">
          {attempt.score} of {attempt.totalQuestions} correct
        </p>

        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <span className="serif-italic">
            {formatTime(attempt.timeSpentSeconds ?? 0)}
          </span>
          {attempt.status === "timed_out" && (
            <span className="text-destructive serif-italic">
              · time ran out
            </span>
          )}
        </div>

        <div className="rule-ornament mt-6 mb-4 text-xs">
          <span aria-hidden="true">§</span>
        </div>

        <p className="serif-italic text-sm text-muted-foreground">
          {isGreat
            ? "A strong showing. Keep the rhythm."
            : isOkay
              ? "Solid. Work through the explanations below."
              : "The work is in the review — read every explanation."}
        </p>
      </div>

      {/* ─── Quick actions ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <Button
          onClick={startRetake}
          disabled={!!starting}
          className="h-12 text-sm font-semibold rounded-2xl bg-primary text-primary-foreground tap-target"
        >
          {starting === "retake" ? "Starting…" : "Take a fresh set"}
        </Button>
        <Button
          onClick={startWrongOnly}
          disabled={!!starting || wrongCount === 0}
          variant="outline"
          className="h-12 text-sm font-semibold rounded-2xl tap-target glass"
        >
          {starting === "wrong-only"
            ? "Starting…"
            : wrongCount === 0
              ? "Nothing to redo"
              : `Redo ${wrongCount} missed`}
        </Button>
      </div>

      {/* ─── Filter ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="All"
          count={questions.length}
        />
        <FilterChip
          active={filter === "wrong"}
          onClick={() => setFilter("wrong")}
          label="Wrong"
          count={wrongCount}
          tone="destructive"
        />
        <FilterChip
          active={filter === "flagged"}
          onClick={() => setFilter("flagged")}
          label="Flagged"
          count={flaggedCount}
          tone="gold"
        />
        <span className="ml-auto text-[11px] text-muted-foreground serif-italic">
          {notesSaving
            ? "saving notes…"
            : notesSaved
              ? "saved"
              : null}
        </span>
      </div>

      {/* ─── Question review ─────────────────────────────── */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center text-muted-foreground serif-italic">
            No questions match this filter.
          </div>
        )}

        {filtered.map((q) => (
          <ReviewCard
            key={q.id}
            question={q}
            note={notes[q.id] ?? ""}
            onNoteChange={(text) => updateNote(q.id, text)}
          />
        ))}
      </div>

      <div className="h-20" />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  tone = "neutral",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone?: "neutral" | "destructive" | "gold";
}) {
  const activeClass =
    tone === "destructive"
      ? "bg-destructive text-background border-destructive"
      : tone === "gold"
        ? "bg-[color:var(--gold)] text-[color:var(--gold-foreground)] border-[color:var(--gold)]"
        : "bg-foreground text-background border-foreground";

  return (
    <button
      onClick={onClick}
      className={`tap-target px-4 py-2 rounded-full text-xs font-semibold border transition-all shrink-0 ${
        active
          ? activeClass
          : "bg-secondary/60 text-secondary-foreground border-transparent hover:border-border"
      }`}
    >
      {label} <span className="opacity-70 ml-1">{count}</span>
    </button>
  );
}

function ReviewCard({
  question,
  note,
  onNoteChange,
}: {
  question: {
    id: string;
    questionNumber: number;
    questionType: string;
    stimulus: string;
    questionStem: string;
    choices: { A: string; B: string; C: string; D: string; E: string };
    correctAnswer: string;
    explanation: string;
    selectedAnswer: string | null;
    isCorrect: boolean;
    answerTimeSpent: number;
    flagged?: boolean;
  };
  note: string;
  onNoteChange: (text: string) => void;
}) {
  const [expanded, setExpanded] = useState(!question.isCorrect);
  const accent = question.isCorrect
    ? "border-l-[color:var(--sage)]"
    : "border-l-destructive";

  return (
    <article
      className={`paper-card border-l-4 ${accent} p-5 md:p-6 overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-baseline gap-3 mb-3">
        <span className="numeral text-3xl text-foreground/70 leading-none">
          {String(question.questionNumber).padStart(2, "0")}
        </span>
        <div className="flex-1 min-w-0">
          <p className="serif-italic text-xs text-muted-foreground truncate">
            {QUESTION_TYPES[question.questionType]?.name ??
              question.questionType}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {question.isCorrect ? (
              <span className="text-[11px] text-[color:var(--sage)] small-caps">
                correct
              </span>
            ) : (
              <span className="text-[11px] text-destructive small-caps">
                incorrect
              </span>
            )}
            {question.flagged && (
              <span className="text-[11px] text-[color:var(--gold)] small-caps">
                · flagged
              </span>
            )}
            <span className="text-[11px] text-muted-foreground ml-auto serif-italic">
              {formatTime(question.answerTimeSpent)}
            </span>
          </div>
        </div>
      </div>

      <p className="text-[15px] leading-relaxed text-foreground/90 mb-3 whitespace-pre-line">
        {question.stimulus}
      </p>
      <p className="serif-italic text-[14px] mb-4 text-foreground">
        {question.questionStem}
      </p>

      <div className="space-y-2 mb-4">
        {(["A", "B", "C", "D", "E"] as const).map((letter) => {
          const isCorrect = letter === question.correctAnswer;
          const isSelected = letter === question.selectedAnswer;
          const showSage = isCorrect;
          const showWrong = isSelected && !isCorrect;

          return (
            <div
              key={letter}
              className={`flex items-start gap-3 p-2.5 md:p-3 rounded-xl border transition-colors ${
                showSage
                  ? "bg-[color:var(--sage)]/10 border-[color:var(--sage)]/40"
                  : showWrong
                    ? "bg-destructive/10 border-destructive/40"
                    : "bg-transparent border-transparent"
              }`}
            >
              <span
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-display ${
                  showSage
                    ? "bg-[color:var(--sage)] text-[color:var(--sage-foreground)]"
                    : showWrong
                      ? "bg-destructive text-background"
                      : "bg-secondary text-secondary-foreground"
                }`}
              >
                {letter}
              </span>
              <span
                className={`pt-1 text-sm leading-relaxed ${
                  showSage
                    ? "text-foreground"
                    : showWrong
                      ? "text-foreground"
                      : "text-foreground/70"
                }`}
              >
                {question.choices[letter]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Explanation — inline for wrong, tucked for right */}
      {!question.isCorrect ? (
        <div className="mt-4 p-4 rounded-xl bg-secondary/60 border border-border">
          <p className="small-caps text-[10px] text-muted-foreground mb-2">
            Why {question.correctAnswer} is correct
          </p>
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
            {question.explanation}
          </p>
        </div>
      ) : (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors serif-italic"
        >
          {expanded ? "hide explanation" : "show explanation"}
        </button>
      )}
      {question.isCorrect && expanded && (
        <p className="mt-2 text-sm leading-relaxed text-foreground/80 whitespace-pre-line border-l-2 border-border pl-3">
          {question.explanation}
        </p>
      )}

      {/* Notes */}
      <div className="mt-4 pt-4 border-t border-border/60">
        <label className="small-caps text-[10px] text-muted-foreground mb-1 block">
          Your note
        </label>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="What tripped you up here? What will you remember?"
          className="w-full min-h-[60px] bg-transparent text-sm serif-italic placeholder:text-muted-foreground/60 focus:outline-none resize-y"
          maxLength={2000}
        />
      </div>
    </article>
  );
}
