"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface ScoreChartProps {
  data: { date: string; score: number; quizTitle: string; mode?: string }[];
}

export function ScoreChart({ data }: ScoreChartProps) {
  const formatted = data.map((d, i) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    index: i + 1,
  }));

  const avg =
    formatted.length > 0
      ? Math.round(
          formatted.reduce((s, d) => s + d.score, 0) / formatted.length
        )
      : 0;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart
        data={formatted}
        margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
      >
        <defs>
          <linearGradient id="scoreStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.52 0.20 355)" />
            <stop offset="50%" stopColor="oklch(0.60 0.18 20)" />
            <stop offset="100%" stopColor="oklch(0.72 0.14 70)" />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "oklch(0.48 0.015 340)" }}
          stroke="oklch(0.85 0.01 340)"
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "oklch(0.48 0.015 340)" }}
          stroke="oklch(0.85 0.01 340)"
          tickLine={false}
          axisLine={false}
          width={30}
        />
        {avg > 0 && (
          <ReferenceLine
            y={avg}
            stroke="oklch(0.72 0.14 70 / 40%)"
            strokeDasharray="3 4"
            label={{
              value: `avg ${avg}%`,
              fill: "oklch(0.55 0.08 60)",
              fontSize: 10,
              fontStyle: "italic",
              position: "right",
            }}
          />
        )}
        <Tooltip
          contentStyle={{
            background: "oklch(1 0 0 / 94%)",
            border: "1px solid oklch(0.88 0.01 340)",
            borderRadius: "10px",
            backdropFilter: "blur(12px)",
            fontSize: "12px",
            padding: "6px 10px",
          }}
          formatter={(value) => [`${value}%`, "Score"]}
          labelFormatter={(label) => String(label)}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="url(#scoreStroke)"
          strokeWidth={2.5}
          dot={{
            fill: "oklch(0.52 0.20 355)",
            strokeWidth: 2,
            r: 3.5,
            stroke: "white",
          }}
          activeDot={{
            r: 6,
            stroke: "oklch(0.52 0.20 355)",
            strokeWidth: 2,
            fill: "white",
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
