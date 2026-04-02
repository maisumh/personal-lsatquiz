"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatTime } from "@/lib/utils";
import { QUESTION_TYPES } from "@/lib/constants/question-types";

interface QuizQuestion {
  id: string;
  questionNumber: number;
  questionType: string;
  stimulus: string;
  questionStem: string;
  choices: { A: string; B: string; C: string; D: string; E: string };
}

interface QuizData {
  id: string;
  title: string;
  type: string;
  timeLimitMinutes: number;
  questions: QuizQuestion[];
}

type AnswerMap = Record<
  string,
  { selectedAnswer: string | null; timeSpentSeconds: number }
>;

export default function QuizTake() {
  const params = useParams();
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [timeElapsed, setTimeElapsed] = useState<number>(0);
  const [attemptId, setAttemptId] = useState<string>("");
  const [startedAt, setStartedAt] = useState<string>("");
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const questionStartTime = useRef<number>(Date.now());
  const answersRef = useRef<AnswerMap>({});

  // Load quiz and attempt data
  useEffect(() => {
    const stored = sessionStorage.getItem(`attempt-${params.quizId}`);
    if (!stored) {
      router.push(`/quiz/${params.quizId}`);
      return;
    }
    const { attemptId: aid, startedAt: sa } = JSON.parse(stored);
    setAttemptId(aid);
    setStartedAt(sa);

    fetch(`/api/quiz/${params.quizId}`)
      .then((r) => r.json())
      .then((data: QuizData) => {
        setQuiz(data);
        // Restore answers from localStorage
        const savedAnswers = localStorage.getItem(`answers-${aid}`);
        if (savedAnswers) {
          setAnswers(JSON.parse(savedAnswers));
        }
        // Restore current question index
        const savedIndex = localStorage.getItem(`index-${aid}`);
        if (savedIndex) {
          setCurrentIndex(parseInt(savedIndex, 10));
        }
        setLoading(false);
      });
  }, [params.quizId, router]);

  // Timer (count up)
  useEffect(() => {
    if (!startedAt) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - new Date(startedAt).getTime()) / 1000
      );
      setTimeElapsed(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  // Keep ref in sync and save to localStorage on change
  useEffect(() => {
    answersRef.current = answers;
    if (attemptId && Object.keys(answers).length > 0) {
      localStorage.setItem(`answers-${attemptId}`, JSON.stringify(answers));
    }
  }, [answers, attemptId]);

  const trackQuestionTime = useCallback(() => {
    if (!quiz) return;
    const q = quiz.questions[currentIndex];
    const timeSpent = Math.round((Date.now() - questionStartTime.current) / 1000);
    setAnswers((prev) => ({
      ...prev,
      [q.id]: {
        ...prev[q.id],
        selectedAnswer: prev[q.id]?.selectedAnswer ?? null,
        timeSpentSeconds: (prev[q.id]?.timeSpentSeconds ?? 0) + timeSpent,
      },
    }));
  }, [quiz, currentIndex]);

  const selectAnswer = (questionId: string, letter: string) => {
    // Update ref immediately (no waiting for React batch)
    answersRef.current = {
      ...answersRef.current,
      [questionId]: {
        ...answersRef.current[questionId],
        selectedAnswer: letter,
        timeSpentSeconds: answersRef.current[questionId]?.timeSpentSeconds ?? 0,
      },
    };
    // Also update state for UI re-render
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        selectedAnswer: letter,
        timeSpentSeconds: prev[questionId]?.timeSpentSeconds ?? 0,
      },
    }));
  };

  const goToQuestion = (index: number) => {
    trackQuestionTime();
    setCurrentIndex(index);
    questionStartTime.current = Date.now();
    if (attemptId) {
      localStorage.setItem(`index-${attemptId}`, String(index));
    }
  };

  const [submitError, setSubmitError] = useState("");
  const submittingRef = useRef(false);

  const handleSubmit = async (timedOut = false) => {
    if (submittingRef.current) return; // prevent double-submission
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError("");

    try {
      // Read from ref (always up-to-date) and merge with localStorage as safety net
      const finalAnswers: AnswerMap = { ...answersRef.current };

      // Also check localStorage in case ref is stale
      const saved = localStorage.getItem(`answers-${attemptId}`);
      if (saved) {
        const savedAnswers: AnswerMap = JSON.parse(saved);
        for (const [qId, ans] of Object.entries(savedAnswers)) {
          if (!finalAnswers[qId] || finalAnswers[qId].selectedAnswer === null) {
            finalAnswers[qId] = ans;
          }
        }
      }

      // Ensure all questions have entries
      if (quiz) {
        for (const q of quiz.questions) {
          if (!finalAnswers[q.id]) {
            finalAnswers[q.id] = { selectedAnswer: null, timeSpentSeconds: 0 };
          }
        }
      }

      const res = await fetch(`/api/attempt/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: finalAnswers, timedOut }),
      });

      if (res.ok) {
        const resultData = await res.json();
        sessionStorage.setItem("latest-quiz-results", JSON.stringify(resultData));

        localStorage.removeItem(`answers-${attemptId}`);
        localStorage.removeItem(`index-${attemptId}`);
        sessionStorage.removeItem(`attempt-${params.quizId}`);
        router.push(`/quiz/${params.quizId}/results/${resultData.attempt.id}`);
      } else {
        throw new Error(`Server error (${res.status})`);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit. Try again.");
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  if (loading || !quiz) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="glass rounded-2xl p-8 shimmer">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const question = quiz.questions[currentIndex];
  const answeredCount = Object.values(answers).filter(
    (a) => a.selectedAnswer !== null
  ).length;
  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4">
      {/* Timer Bar */}
      <div className="glass-strong rounded-2xl px-6 py-3 mb-4 flex items-center justify-between sticky top-4 z-20">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-muted-foreground hidden sm:block">
            {quiz.title}
          </h2>
          <Badge variant="secondary" className="text-xs">
            {answeredCount}/{quiz.questions.length} answered
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-2xl font-mono font-bold tabular-nums text-foreground">
            {formatTime(timeElapsed)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSubmitDialog(true)}
            className="glass text-xs font-semibold"
          >
            Submit
          </Button>
        </div>
      </div>

      {/* Question Card */}
      <div className="glass-strong rounded-3xl p-6 md:p-8 mb-4 flex-1 page-enter" key={question.id}>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-bold text-primary">
            Question {question.questionNumber}
          </span>
          <Badge variant="outline" className="text-xs glass">
            {QUESTION_TYPES[question.questionType]?.name ?? question.questionType}
          </Badge>
        </div>

        <div className="mb-6">
          <p className="text-base md:text-lg leading-relaxed text-foreground/90 whitespace-pre-line">
            {question.stimulus}
          </p>
        </div>

        <p className="text-sm font-semibold text-foreground mb-4 italic">
          {question.questionStem}
        </p>

        <div className="space-y-3">
          {(["A", "B", "C", "D", "E"] as const).map((letter) => {
            const isSelected =
              answers[question.id]?.selectedAnswer === letter;
            return (
              <button
                key={letter}
                onClick={() => selectAnswer(question.id, letter)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-start gap-3 ${
                  isSelected
                    ? "glass-strong border-primary/50 shadow-[0_0_15px_oklch(0.7_0.15_340/20%)]"
                    : "glass border-transparent hover:border-primary/30 glow-hover"
                }`}
              >
                <span
                  className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    isSelected
                      ? "bg-gradient-to-br from-pink-500 to-rose-500 text-white"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {letter}
                </span>
                <span className="text-sm md:text-base leading-relaxed pt-1">
                  {question.choices[letter]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="glass-strong rounded-2xl px-4 py-3 flex items-center justify-between sticky bottom-4">
        <Button
          variant="ghost"
          onClick={() => goToQuestion(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="text-sm"
        >
          Previous
        </Button>

        <div className="flex gap-1.5 flex-wrap justify-center max-w-[60%]">
          {quiz.questions.map((q, i) => {
            const isAnswered = answers[q.id]?.selectedAnswer !== null;
            const isCurrent = i === currentIndex;
            return (
              <button
                key={q.id}
                onClick={() => goToQuestion(i)}
                className={`w-7 h-7 rounded-full text-xs font-semibold transition-all ${
                  isCurrent
                    ? "bg-gradient-to-br from-pink-500 to-rose-500 text-white scale-110 shadow-lg"
                    : isAnswered
                    ? "bg-primary/20 text-primary"
                    : "bg-secondary/50 text-muted-foreground"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <Button
          variant="ghost"
          onClick={() => goToQuestion(currentIndex + 1)}
          disabled={currentIndex === quiz.questions.length - 1}
          className="text-sm"
        >
          Next
        </Button>
      </div>

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="glass-strong border-primary/20">
          <DialogHeader>
            <DialogTitle>Submit Quiz?</DialogTitle>
            <DialogDescription>
              You have answered {answeredCount} of {quiz.questions.length}{" "}
              questions.
              {answeredCount < quiz.questions.length && (
                <span className="block mt-1 text-destructive">
                  {quiz.questions.length - answeredCount} question
                  {quiz.questions.length - answeredCount > 1 ? "s are" : " is"}{" "}
                  unanswered.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {submitError && (
            <div className="mt-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              {submitError}
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowSubmitDialog(false)}
              className="flex-1"
            >
              Keep Working
            </Button>
            <Button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white border-0"
            >
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
