"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "quiz" | "exam";
type Step = "build" | "done";

interface Chapter {
  slug: string;
  name: string;
  chapter: number;
  description: string;
  count: number;
}

const PRESET_TIMES = [15, 25, 35, 45];

export default function CreateQuiz() {
  const [step, setStep] = useState<Step>("build");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(true);

  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("quiz");
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [timeMinutes, setTimeMinutes] = useState<number>(35);
  const [customTitle, setCustomTitle] = useState<string>("");

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [quizLink, setQuizLink] = useState("");
  const [copied, setCopied] = useState(false);

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

  const handleCreate = async () => {
    if (selectedSlugs.size === 0) return;
    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/quiz/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: customTitle.trim() || undefined,
          type: mode,
          questionTypes: Array.from(selectedSlugs),
          questionCount,
          timeLimitMinutes: mode === "exam" ? timeMinutes : 15,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error (${res.status})`);
      }

      const data = await res.json();
      setQuizLink(`${window.location.origin}/quiz/${data.id}`);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quiz");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(quizLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Done step ──────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="paper-card p-8 md:p-12 max-w-lg w-full text-center page-enter">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-[color:var(--sage)] flex items-center justify-center">
            <svg
              className="w-8 h-8 text-[color:var(--sage-foreground)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="font-display text-3xl mb-2">Ready to share.</h1>
          <p className="text-muted-foreground mb-6 serif-italic">
            Send the link below when you&apos;re ready to begin.
          </p>
          <div className="flex gap-2 mb-6">
            <Input
              readOnly
              value={quizLink}
              className="glass text-sm font-mono"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              onClick={copyLink}
              className={`shrink-0 min-w-[88px] border-0 transition-all tap-target ${
                copied
                  ? "bg-[color:var(--sage)] text-[color:var(--sage-foreground)]"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="flex gap-3">
            <a
              href="/admin"
              className="flex-1 inline-flex items-center justify-center h-10 rounded-xl border border-border hover:bg-accent transition-colors text-sm font-medium tap-target"
            >
              Dashboard
            </a>
            <Button
              onClick={() => {
                setQuizLink("");
                setSelectedSlugs(new Set());
                setCustomTitle("");
                setCopied(false);
                setStep("build");
              }}
              variant="outline"
              className="flex-1 h-10 rounded-xl tap-target"
            >
              Create Another
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
            ? "Pick one or more"
            : `${selectedSlugs.size} selected · ${totalAvailable} questions in pool`
        }
        action={
          <div className="flex gap-3 text-xs">
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
          </div>
        }
      >
        {loadingChapters ? (
          <div className="glass rounded-2xl p-6 shimmer">
            <p className="text-muted-foreground">Loading chapters…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {chapters.map((c) => {
              const selected = selectedSlugs.has(c.slug);
              return (
                <button
                  key={c.slug}
                  onClick={() => toggleChapter(c.slug)}
                  className={`tap-target p-4 rounded-xl border text-left transition-all ${
                    selected
                      ? "bg-primary/8 border-primary/50 shadow-[0_2px_16px_-8px_var(--primary)]"
                      : "glass border-transparent hover:border-primary/25"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="small-caps text-[10px] text-muted-foreground">
                      Ch. {c.chapter}
                    </span>
                    {selected && (
                      <span className="text-primary text-xs">✓</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold font-display leading-tight">
                    {c.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 serif-italic">
                    {c.count} questions
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </Section>

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

      {/* Optional title ───────────────────────────────────────── */}
      <Section label="Title" hint="optional">
        <Input
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          placeholder="Auto-generated from chapters"
          className="glass"
        />
      </Section>

      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm mb-4">
          {error}
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
              ? "Creating…"
              : selectedSlugs.size === 0
                ? "Pick at least one chapter"
                : `Create ${mode === "exam" ? "exam" : "practice set"} · ${questionCount}q`}
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
