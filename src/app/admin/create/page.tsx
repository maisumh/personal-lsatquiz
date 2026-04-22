"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Mode = "quiz" | "exam";

interface Chapter {
  slug: string;
  name: string;
  chapter: number;
  description: string;
  count: number;
}

const PRESET_TIMES = [15, 25, 35, 45];

export default function CreateQuiz() {
  const router = useRouter();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(true);

  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("quiz");
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [timeMinutes, setTimeMinutes] = useState<number>(35);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [orphanedQuizId, setOrphanedQuizId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/chapters")
      .then((r) => r.json())
      .then((data: { chapters: Chapter[] }) => setChapters(data.chapters))
      .finally(() => setLoadingChapters(false));
  }, []);

  const totalAvailable = Array.from(selectedSlugs).reduce(
    (sum, slug) => sum + (chapters.find((c) => c.slug === slug)?.count ?? 0),
    0
  );

  // Keep count in-bounds when selection changes
  useEffect(() => {
    if (questionCount > totalAvailable && totalAvailable > 0) {
      setQuestionCount(totalAvailable);
    }
    if (questionCount < 1 && totalAvailable > 0) {
      setQuestionCount(Math.min(10, totalAvailable));
    }
  }, [totalAvailable, questionCount]);

  // When switching to exam mode, nudge question count toward 25 if possible
  useEffect(() => {
    if (mode === "exam" && totalAvailable >= 25 && questionCount < 20) {
      setQuestionCount(Math.min(25, totalAvailable));
      setTimeMinutes(35);
    }
    if (mode === "quiz" && questionCount > 15) {
      setQuestionCount(Math.min(10, totalAvailable || 10));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const toggleChapter = (slug: string) => {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedSlugs(new Set(chapters.map((c) => c.slug)));
  };

  const clearAll = () => {
    setSelectedSlugs(new Set());
  };

  const startAttemptFor = async (quizId: string) => {
    const startRes = await fetch("/api/attempt/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId }),
    });
    if (!startRes.ok) throw new Error("Could not start attempt");
    const { attemptId, startedAt, timeLimitSeconds } = await startRes.json();
    sessionStorage.setItem(
      `attempt-${quizId}`,
      JSON.stringify({ attemptId, startedAt, timeLimitSeconds })
    );
    router.push(`/quiz/${quizId}/take`);
  };

  const handleCreate = async () => {
    if (selectedSlugs.size === 0) return;
    setCreating(true);
    setError("");
    setOrphanedQuizId(null);

    // If we have a partially-created quiz from a prior failed attempt, just
    // retry the start leg instead of creating a new quiz.
    if (orphanedQuizId) {
      try {
        await startAttemptFor(orphanedQuizId);
        return;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not start attempt"
        );
        setCreating(false);
        return;
      }
    }

    try {
      const createRes = await fetch("/api/quiz/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: mode,
          questionTypes: Array.from(selectedSlugs),
          questionCount,
          timeLimitMinutes: mode === "exam" ? timeMinutes : 15,
        }),
      });

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}));
        throw new Error(errData.error || `Server error (${createRes.status})`);
      }

      const quiz = await createRes.json();

      try {
        await startAttemptFor(quiz.id);
      } catch (startErr) {
        // The quiz exists in blob storage but the attempt didn't start.
        // Hold its id so the user can retry the start leg without losing
        // the config they just built.
        setOrphanedQuizId(quiz.id);
        throw startErr;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quiz");
      setCreating(false);
    }
  };

  // ─── Build step ─────────────────────────────────────────────────
  return (
    <div className="flex-1 max-w-3xl mx-auto w-full p-4 md:p-6 pb-28 page-enter">
      <div className="mb-5">
        <a
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors serif-italic"
        >
          ← Back to Dashboard
        </a>
      </div>

      <header className="mb-7">
        <p className="small-caps text-[11px] text-muted-foreground mb-2">
          Compose
        </p>
        <h1 className="font-display text-4xl md:text-5xl leading-[1.05] tracking-tight">
          New study set.
        </h1>
      </header>

      {/* Mode ─────────────────────────────────────────────────── */}
      <Section label="Mode">
        <div className="grid grid-cols-2 gap-3">
          <ModeTile
            active={mode === "quiz"}
            onClick={() => setMode("quiz")}
            title="Practice"
            subtitle="Untimed. Review anytime."
          />
          <ModeTile
            active={mode === "exam"}
            onClick={() => setMode("exam")}
            title="Exam"
            subtitle="Timed. Auto-submits."
          />
        </div>
      </Section>

      {/* Chapters ───────────────────────────────────────────────── */}
      <Section
        label="Chapters"
        hint={
          selectedSlugs.size === 0
            ? "tap to pick"
            : `${selectedSlugs.size} selected · ${totalAvailable} questions in pool`
        }
      >
        <button
          onClick={() => setChapterPickerOpen(true)}
          disabled={loadingChapters}
          className="tap-target w-full p-4 rounded-2xl border border-border bg-secondary/40 hover:bg-secondary/60 transition-colors flex items-center justify-between gap-3 text-left disabled:opacity-50"
        >
          <span className="flex-1 min-w-0">
            {loadingChapters ? (
              <span className="serif-italic text-muted-foreground">
                Loading chapters…
              </span>
            ) : selectedSlugs.size === 0 ? (
              <span className="serif-italic text-muted-foreground">
                Select one or more chapters
              </span>
            ) : (
              <span className="text-sm font-medium truncate block">
                {Array.from(selectedSlugs)
                  .map(
                    (slug) =>
                      chapters.find((c) => c.slug === slug)?.name ?? slug
                  )
                  .join(" · ")}
              </span>
            )}
          </span>
          <svg
            className="w-4 h-4 text-muted-foreground shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </Section>

      <Dialog open={chapterPickerOpen} onOpenChange={setChapterPickerOpen}>
        <DialogContent className="glass-strong border-primary/20 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Chapters
            </DialogTitle>
            <DialogDescription>
              <span className="flex items-center justify-between">
                <span>
                  {selectedSlugs.size === 0
                    ? "none selected"
                    : `${selectedSlugs.size} selected · ${totalAvailable} questions`}
                </span>
                <span className="flex gap-3 text-xs">
                  <button
                    onClick={selectAll}
                    className="text-muted-foreground hover:text-foreground transition-colors serif-italic"
                  >
                    all
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    onClick={clearAll}
                    className="text-muted-foreground hover:text-foreground transition-colors serif-italic"
                  >
                    clear
                  </button>
                </span>
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 mt-2">
            {chapters.map((c) => {
              const selected = selectedSlugs.has(c.slug);
              return (
                <button
                  key={c.slug}
                  onClick={() => toggleChapter(c.slug)}
                  className={`tap-target w-full p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                    selected
                      ? "bg-primary/8 border-primary/50"
                      : "bg-transparent border-transparent hover:border-border"
                  }`}
                >
                  <span
                    className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-all ${
                      selected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {selected && (
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold font-display leading-tight truncate">
                      {c.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground serif-italic">
                      Ch. {c.chapter} · {c.count} questions
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          <Button
            onClick={() => setChapterPickerOpen(false)}
            className="w-full h-12 mt-4 bg-primary text-primary-foreground tap-target"
          >
            {selectedSlugs.size === 0
              ? "Close"
              : `Done · ${selectedSlugs.size}`}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Question count ────────────────────────────────────────── */}
      <Section
        label="Questions"
        hint={
          totalAvailable > 0
            ? `max ${totalAvailable}`
            : "select chapters first"
        }
      >
        <div className="flex items-center gap-4">
          <span className="numeral text-5xl text-primary w-20">
            {questionCount}
          </span>
          <input
            type="range"
            min={1}
            max={Math.max(1, totalAvailable)}
            step={1}
            value={questionCount}
            onChange={(e) => setQuestionCount(parseInt(e.target.value, 10))}
            disabled={totalAvailable === 0}
            className="flex-1 accent-[color:var(--primary)]"
            aria-label="Question count"
          />
        </div>
        <div className="flex gap-2 mt-3">
          {[5, 10, 25, 50].map((n) => (
            <button
              key={n}
              type="button"
              disabled={n > totalAvailable}
              onClick={() => setQuestionCount(Math.min(n, totalAvailable))}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                questionCount === n
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/60 text-muted-foreground border-transparent hover:border-border"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </Section>

      {/* Time limit (exam only) ───────────────────────────────── */}
      {mode === "exam" && (
        <Section label="Time limit" hint="auto-submits at zero">
          <div className="flex items-center gap-4">
            <span className="numeral text-5xl text-primary w-20">
              {timeMinutes}
            </span>
            <span className="serif-italic text-muted-foreground">minutes</span>
          </div>
          <div className="flex gap-2 mt-3">
            {PRESET_TIMES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTimeMinutes(n)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  timeMinutes === n
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/60 text-muted-foreground border-transparent hover:border-border"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 serif-italic">
            LSAT section is 35 min / 25 questions.
          </p>
        </Section>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm mb-4">
          {error}
          {orphanedQuizId && (
            <span className="block mt-1 text-foreground/70 serif-italic">
              Your set was saved. Tap Begin again to retry.
            </span>
          )}
        </div>
      )}

      {/* Sticky create bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 safe-bottom bg-gradient-to-t from-background via-background/95 to-transparent z-20">
        <div className="max-w-3xl mx-auto">
          <Button
            onClick={handleCreate}
            disabled={creating || selectedSlugs.size === 0}
            className="w-full h-14 text-base font-semibold rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 border-0 disabled:opacity-40 tap-target"
          >
            {creating
              ? "Starting…"
              : selectedSlugs.size === 0
                ? "Pick at least one chapter"
                : `Begin ${mode === "exam" ? "exam" : "practice"} · ${questionCount}q`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Primitives ─────────────────────────────────────────────────

function Section({
  label,
  hint,
  action,
  children,
}: {
  label: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <div className="flex items-end justify-between mb-2.5">
        <div className="flex items-baseline gap-3">
          <h2 className="small-caps text-[11px] text-foreground">{label}</h2>
          {hint && (
            <span className="serif-italic text-xs text-muted-foreground">
              {hint}
            </span>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ModeTile({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`tap-target p-4 rounded-2xl border text-left transition-all ${
        active
          ? "bg-primary/8 border-primary/60 shadow-[0_2px_16px_-8px_var(--primary)]"
          : "glass border-transparent hover:border-primary/25"
      }`}
    >
      <p className="font-display text-lg leading-tight">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5 serif-italic">
        {subtitle}
      </p>
    </button>
  );
}
