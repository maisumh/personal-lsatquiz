"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { QUESTION_TYPES } from "@/lib/constants/question-types";

interface Entry {
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
}

type Tab = "flagged" | "missed";

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="glass rounded-2xl p-8 shimmer">
            <p className="text-muted-foreground serif-italic">Loading…</p>
          </div>
        </div>
      }
    >
      <LibraryContent />
    </Suspense>
  );
}

function LibraryContent() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("filter") === "missed" ? "missed" : "flagged";
  const [tab, setTab] = useState<Tab>(initial as Tab);
  const [flagged, setFlagged] = useState<Entry[]>([]);
  const [missed, setMissed] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetch("/api/library", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setFlagged(data.flagged ?? []);
        setMissed(data.missed ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const list = tab === "flagged" ? flagged : missed;

  // Reset selection when switching tabs
  useEffect(() => {
    setSelected(new Set());
  }, [tab]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(list.map((e) => e.questionId)));
  };

  const groupedByChapter = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of list) {
      const key = e.questionType;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort(
      (a, b) =>
        (QUESTION_TYPES[a[0]]?.chapter ?? 0) -
        (QUESTION_TYPES[b[0]]?.chapter ?? 0)
    );
  }, [list]);

  const startDrill = async (ids: string[]) => {
    if (ids.length === 0) return;
    setStarting(true);
    try {
      const res = await fetch("/api/drill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "questions",
          questionIds: ids,
          title:
            tab === "flagged"
              ? `Flagged review · ${ids.length}`
              : `Missed review · ${ids.length}`,
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
      setStarting(false);
    }
  };

  const drillSelected = () => startDrill(Array.from(selected));
  const drillAll = () => startDrill(list.map((e) => e.questionId));

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full p-4 md:p-6 pb-32 page-enter">
      <div className="mb-4">
        <a
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors serif-italic"
        >
          ← Dashboard
        </a>
      </div>

      <header className="mb-7">
        <p className="small-caps text-[11px] text-muted-foreground mb-2">
          Study library
        </p>
        <h1 className="font-display text-4xl md:text-5xl leading-[1.05] tracking-tight">
          <span className="serif-italic text-foreground/70">Things to</span>{" "}
          revisit.
        </h1>
      </header>

      <div className="flex items-center gap-2 mb-5">
        <TabChip
          active={tab === "flagged"}
          onClick={() => setTab("flagged")}
          label="Flagged"
          count={flagged.length}
        />
        <TabChip
          active={tab === "missed"}
          onClick={() => setTab("missed")}
          label="Missed"
          count={missed.length}
        />
        <span className="ml-auto text-xs text-muted-foreground serif-italic">
          {selected.size > 0
            ? `${selected.size} selected`
            : `${list.length} total`}
        </span>
      </div>

      {loading ? (
        <div className="glass rounded-2xl p-12 text-center shimmer">
          <p className="serif-italic text-muted-foreground">Loading…</p>
        </div>
      ) : list.length === 0 ? (
        <div className="paper-card p-12 text-center">
          <p className="serif-italic text-muted-foreground">
            {tab === "flagged"
              ? "Nothing flagged yet. Tap the flag icon during a quiz to save questions here."
              : "Nothing missed yet. Take a quiz to see what shows up."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByChapter.map(([slug, entries]) => (
            <section key={slug}>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="small-caps text-[10px] text-muted-foreground">
                  Ch. {QUESTION_TYPES[slug]?.chapter ?? ""}
                </span>
                <h2 className="font-display text-lg">
                  {QUESTION_TYPES[slug]?.name ?? slug}
                </h2>
                <span className="serif-italic text-xs text-muted-foreground ml-auto">
                  {entries.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {entries.map((e) => {
                  const accuracy = Math.round(
                    (e.timesCorrect / Math.max(1, e.timesSeen)) * 100
                  );
                  const isSelected = selected.has(e.questionId);
                  return (
                    <button
                      key={e.questionId}
                      onClick={() => toggleSelect(e.questionId)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                        isSelected
                          ? "bg-primary/8 border-primary/50"
                          : "glass border-transparent hover:border-primary/20"
                      }`}
                    >
                      <span
                        className={`shrink-0 w-5 h-5 rounded border transition-all flex items-center justify-center mt-0.5 ${
                          isSelected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border"
                        }`}
                      >
                        {isSelected && (
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
                        <p className="text-sm leading-snug line-clamp-2">
                          {e.questionStem || "(question)"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1 serif-italic">
                          seen {e.timesSeen}× · {accuracy}% correct
                          {e.lastSeenAt &&
                            ` · ${new Date(e.lastSeenAt).toLocaleDateString(
                              "en-US",
                              {
                                timeZone: "America/Chicago",
                                month: "short",
                                day: "numeric",
                              }
                            )}`}
                        </p>
                      </div>
                      {e.everFlagged && (
                        <span className="text-[color:var(--gold)] text-xs shrink-0">
                          ◆
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Sticky drill bar */}
      {list.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 safe-bottom bg-gradient-to-t from-background via-background/95 to-transparent z-20">
          <div className="max-w-3xl mx-auto flex gap-3">
            <Button
              variant="outline"
              onClick={selectAll}
              className="tap-target glass flex-1"
              disabled={selected.size === list.length}
            >
              Select all
            </Button>
            <Button
              onClick={selected.size > 0 ? drillSelected : drillAll}
              disabled={starting}
              className="tap-target bg-primary text-primary-foreground flex-[2] font-semibold"
            >
              {starting
                ? "Starting…"
                : selected.size > 0
                  ? `Drill ${selected.size} selected`
                  : `Drill all ${list.length}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TabChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`tap-target px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-secondary/60 text-secondary-foreground border-transparent hover:border-border"
      }`}
    >
      {label}{" "}
      <span className={`ml-1 opacity-70 ${active ? "" : "font-normal"}`}>
        {count}
      </span>
    </button>
  );
}
