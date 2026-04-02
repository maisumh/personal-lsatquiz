"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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
}

interface ResultData {
  attempt: {
    id: string;
    score: number;
    totalQuestions: number;
    timeSpentSeconds: number;
    status: string;
  };
  quiz: {
    title: string;
    type: string;
    timeLimitMinutes: number;
  };
  questions: ResultQuestion[];
}

export default function ResultsPage() {
  const params = useParams();

  // Check sessionStorage BEFORE first render (immune to Strict Mode double-runs)
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
      } catch { /* fall through to API */ }
    }
    return null;
  });
  const [loading, setLoading] = useState(!data);

  useEffect(() => {
    // Only fetch from API if we don't already have data from sessionStorage
    if (data) return;

    fetch(`/api/attempt/${params.attemptId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [params.attemptId, data]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="glass rounded-2xl p-8 shimmer">
          <p className="text-muted-foreground">Loading results...</p>
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
  const percentage = Math.round(((attempt.score ?? 0) / attempt.totalQuestions) * 100);
  const isGreat = percentage >= 80;
  const isOkay = percentage >= 60 && percentage < 80;

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full p-4 page-enter">
      {/* Score Header */}
      <div className="glass-strong rounded-3xl p-8 mb-6 text-center">
        <p className="text-sm text-muted-foreground mb-1">{quiz.title}</p>
        <div
          className={`text-6xl md:text-7xl font-bold mb-2 bg-clip-text text-transparent ${
            isGreat
              ? "bg-gradient-to-r from-emerald-500 to-teal-400"
              : isOkay
              ? "bg-gradient-to-r from-amber-500 to-orange-400"
              : "bg-gradient-to-r from-pink-500 to-rose-500"
          }`}
        >
          {percentage}%
        </div>
        <p className="text-lg font-medium mb-1">
          {attempt.score} / {attempt.totalQuestions} correct
        </p>
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <span>
            Time: {formatTime(attempt.timeSpentSeconds)}
          </span>
          {attempt.status === "timed_out" && (
            <Badge variant="destructive" className="text-xs">
              Time ran out
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          {isGreat
            ? "Excellent work! Keep it up!"
            : isOkay
            ? "Good effort! Review the explanations below."
            : "Keep practicing! Study the explanations carefully."}
        </p>
      </div>

      {/* Question Review */}
      <div className="space-y-4">
        {questions.map((q) => (
          <div
            key={q.id}
            className={`glass rounded-2xl p-5 md:p-6 border-l-4 ${
              q.isCorrect
                ? "border-l-emerald-400"
                : "border-l-rose-400"
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-bold">
                Q{q.questionNumber}
              </span>
              <Badge variant="outline" className="text-xs">
                {QUESTION_TYPES[q.questionType]?.name ?? q.questionType}
              </Badge>
              {q.isCorrect ? (
                <Badge className="bg-emerald-500/20 text-emerald-700 text-xs border-0">
                  Correct
                </Badge>
              ) : (
                <Badge className="bg-rose-500/20 text-rose-700 text-xs border-0">
                  Incorrect
                </Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {formatTime(q.answerTimeSpent)}
              </span>
            </div>

            <p className="text-sm leading-relaxed text-foreground/80 mb-3 whitespace-pre-line">
              {q.stimulus}
            </p>
            <p className="text-sm font-medium italic mb-3">
              {q.questionStem}
            </p>

            <div className="space-y-2 mb-4">
              {(["A", "B", "C", "D", "E"] as const).map((letter) => {
                const isCorrectAnswer = letter === q.correctAnswer;
                const isSelected = letter === q.selectedAnswer;
                const showGreen = isCorrectAnswer;
                const showRed = isSelected && !isCorrectAnswer;

                return (
                  <div
                    key={letter}
                    className={`flex items-start gap-2 p-2.5 rounded-lg text-sm ${
                      showGreen
                        ? "bg-emerald-50 border border-emerald-200"
                        : showRed
                        ? "bg-rose-50 border border-rose-200"
                        : ""
                    }`}
                  >
                    <span
                      className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        showGreen
                          ? "bg-emerald-500 text-white"
                          : showRed
                          ? "bg-rose-500 text-white"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {letter}
                    </span>
                    <span
                      className={`pt-0.5 ${
                        showGreen
                          ? "text-emerald-800 font-medium"
                          : showRed
                          ? "text-rose-800"
                          : "text-foreground/70"
                      }`}
                    >
                      {q.choices[letter]}
                    </span>
                  </div>
                );
              })}
            </div>

            <details className="group">
              <summary className="text-sm font-semibold text-primary cursor-pointer hover:underline">
                View Explanation
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-foreground/80 pl-2 border-l-2 border-primary/30">
                {q.explanation}
              </p>
            </details>
          </div>
        ))}
      </div>

      <div className="my-8 text-center">
        <a
          href={`/quiz/${params.quizId}`}
          className="inline-flex items-center justify-center h-12 px-8 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold glow-hover transition-all"
        >
          Take Again
        </a>
      </div>
    </div>
  );
}
