"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ScoreChartProps {
  data: { date: string; score: number; quizTitle: string }[];
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

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={formatted}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          stroke="oklch(0.5 0.03 340)"
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11 }}
          stroke="oklch(0.5 0.03 340)"
          width={35}
        />
        <Tooltip
          contentStyle={{
            background: "oklch(0.98 0.01 340 / 80%)",
            border: "1px solid oklch(0.88 0.05 340 / 50%)",
            borderRadius: "12px",
            backdropFilter: "blur(12px)",
            fontSize: "13px",
          }}
          formatter={(value) => [`${value}%`, "Score"]}
          labelFormatter={(label) => String(label)}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="oklch(0.65 0.18 340)"
          strokeWidth={2.5}
          dot={{
            fill: "oklch(0.65 0.18 340)",
            strokeWidth: 2,
            r: 4,
            stroke: "white",
          }}
          activeDot={{
            r: 6,
            stroke: "oklch(0.65 0.18 340)",
            strokeWidth: 2,
            fill: "white",
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
