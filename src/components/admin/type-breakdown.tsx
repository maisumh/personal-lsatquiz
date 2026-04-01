"use client";

import { QUESTION_TYPES } from "@/lib/constants/question-types";

interface TypeBreakdownProps {
  data: { type: string; accuracy: number; correct: number; total: number }[];
}

export function TypeBreakdown({ data }: TypeBreakdownProps) {
  const sorted = [...data].sort((a, b) => a.accuracy - b.accuracy);

  return (
    <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
      {sorted.map((item) => {
        const color =
          item.accuracy >= 70
            ? "bg-emerald-400"
            : item.accuracy >= 50
            ? "bg-amber-400"
            : "bg-rose-400";

        const textColor =
          item.accuracy >= 70
            ? "text-emerald-700"
            : item.accuracy >= 50
            ? "text-amber-700"
            : "text-rose-700";

        return (
          <div key={item.type}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium truncate mr-2">
                {QUESTION_TYPES[item.type]?.name ?? item.type}
              </span>
              <span className={`text-xs font-bold ${textColor}`}>
                {item.accuracy}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-secondary/50 overflow-hidden">
              <div
                className={`h-full rounded-full ${color} transition-all duration-500`}
                style={{ width: `${item.accuracy}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {item.correct}/{item.total} correct
            </p>
          </div>
        );
      })}
      {data.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No data yet
        </p>
      )}
    </div>
  );
}
