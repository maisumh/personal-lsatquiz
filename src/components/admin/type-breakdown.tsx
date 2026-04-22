"use client";

import { QUESTION_TYPES } from "@/lib/constants/question-types";

interface TypeBreakdownProps {
  data: {
    type: string;
    name?: string;
    chapter?: number;
    accuracy: number;
    correct: number;
    total: number;
  }[];
  onDrill?: (slug: string) => void;
  drillingSlug?: string | null;
}

export function TypeBreakdown({
  data,
  onDrill,
  drillingSlug,
}: TypeBreakdownProps) {
  const sorted = [...data].sort((a, b) => a.accuracy - b.accuracy);

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8 serif-italic">
        No data yet — take a quiz to see breakdown.
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-hide">
      {sorted.map((item) => {
        const tone =
          item.accuracy >= 75
            ? { bar: "bg-[color:var(--sage)]", text: "text-[color:var(--sage)]" }
            : item.accuracy >= 55
              ? { bar: "bg-[color:var(--gold)]", text: "text-[color:var(--gold-foreground)]" }
              : { bar: "bg-primary", text: "text-primary" };

        const name =
          item.name ?? QUESTION_TYPES[item.type]?.name ?? item.type;
        const isBusy = drillingSlug === item.type;

        return (
          <button
            key={item.type}
            onClick={() => onDrill?.(item.type)}
            disabled={!onDrill || isBusy}
            className="w-full text-left p-2 rounded-lg hover:bg-accent/40 transition-colors group disabled:opacity-60"
            title={onDrill ? "Drill this chapter" : undefined}
          >
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className="text-xs font-medium truncate flex-1">
                {name}
              </span>
              <span className={`text-xs font-bold numeral ${tone.text}`}>
                {item.accuracy}%
              </span>
              {onDrill && (
                <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 serif-italic">
                  {isBusy ? "…" : "drill →"}
                </span>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
              <div
                className={`h-full rounded-full ${tone.bar} transition-all duration-700`}
                style={{ width: `${item.accuracy}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 serif-italic">
              {item.correct}/{item.total} correct
            </p>
          </button>
        );
      })}
    </div>
  );
}
