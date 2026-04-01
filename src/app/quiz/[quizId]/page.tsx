"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QUESTION_TYPES } from "@/lib/constants/question-types";

interface QuizInfo {
  id: string;
  title: string;
  type: "quiz" | "exam";
  questionTypes: string[];
  timeLimitMinutes: number;
  questions: { id: string }[];
}

export default function QuizLanding() {
  const params = useParams();
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuizInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetch(`/api/quiz/${params.quizId}`)
      .then((r) => r.json())
      .then(setQuiz)
      .finally(() => setLoading(false));
  }, [params.quizId]);

  const handleStart = async () => {
    setStarting(true);
    const res = await fetch("/api/attempt/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId: params.quizId }),
    });
    const { attemptId, startedAt } = await res.json();
    // Store attempt info for the quiz-taking page
    sessionStorage.setItem(
      `attempt-${params.quizId}`,
      JSON.stringify({ attemptId, startedAt })
    );
    router.push(`/quiz/${params.quizId}/take`);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="glass rounded-2xl p-8 shimmer">
          <p className="text-muted-foreground">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="glass rounded-2xl p-8">
          <p className="text-destructive">Quiz not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="glass-strong rounded-3xl p-8 md:p-12 max-w-lg w-full page-enter text-center">
        <div className="mb-2">
          <Badge
            variant="secondary"
            className="text-xs uppercase tracking-wider"
          >
            {quiz.type}
          </Badge>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 bg-gradient-to-r from-pink-600 via-rose-500 to-pink-400 bg-clip-text text-transparent">
          {quiz.title}
        </h1>

        <div className="space-y-3 mb-8 text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <span>{quiz.questions.length} questions</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Untimed — take your time</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {quiz.questionTypes.map((type) => (
            <Badge key={type} variant="outline" className="glass text-xs">
              {QUESTION_TYPES[type]?.name ?? type}
            </Badge>
          ))}
        </div>

        <Button
          onClick={handleStart}
          disabled={starting}
          className="w-full h-14 text-lg font-semibold rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white border-0 glow-hover transition-all"
        >
          {starting ? "Starting..." : "Start Quiz"}
        </Button>

        <p className="text-xs text-muted-foreground mt-4">
          A timer will track your time. Good luck!
        </p>
      </div>
    </div>
  );
}
