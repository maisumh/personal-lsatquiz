"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatTime } from "@/lib/utils";
import { QUESTION_TYPES } from "@/lib/constants/question-types";
import { useSwipe } from "@/lib/hooks/use-swipe";

interface QuizQuestion {
  id: string;
  questionNumber: number;
  questionType: string;
  stimulus: string;
  questionStem: string;
  choices: { A: string; B: string; C: string; D: string; E: string };
}

interface AttemptView {
  id: string;
  quizId: string;
  quizTitle: string | null;
  mode: "quiz" | "exam";
  startedAt: string;
  timeLimitSeconds: number | null;
  totalQuestions: number;
  questions: QuizQuestion[];
  flaggedQuestionIds: string[];
}

type AnswerMap = Record<
  string,
  { selectedAnswer: string | null; timeSpentSeconds: number }
>;

export default function QuizTake() {
  const params = useParams();
  const router = useRouter();

  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const [attemptId, setAttemptId] = useState<string>("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [elapsed, setElapsed] = useState(0);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState("");
  const [direction, setDirection] = useState<1 | -1>(1);

  const questionStartTime = useRef<number>(Date.now());
  const answersRef = useRef<AnswerMap>({});
  const flaggedRef = useRef<Set<string>>(new Set());
  const submittingRef = useRef(false);
  const autoSubmitFired = useRef(false);

  // ─── Load attempt ─────────────────────────────────────────────────
  useEffect(() => {
    const stored = sessionStorage.getItem(`attempt-${params.quizId}`);
    if (!stored) {
      router.replace(`/quiz/${params.quizId}`);
      return;
    }
    const { attemptId: aid } = JSON.parse(stored) as { attemptId: string };
    setAttemptId(aid);

    fetch(`/api/attempt/${aid}?view=take`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: AttemptView) => {
        setAttempt(data);
        const savedAnswers = localStorage.getItem(`answers-${aid}`);
        if (savedAnswers) {
          const parsed = JSON.parse(savedAnswers);
          setAnswers(parsed);
          answersRef.current = parsed;
        }
        const savedFlags = localStorage.getItem(`flagged-${aid}`);
        if (savedFlags) {
          const set = new Set<string>(JSON.parse(savedFlags));
          setFlagged(set);
          flaggedRef.current = set;
        } else if (data.flaggedQuestionIds?.length) {
          const set = new Set(data.flaggedQuestionIds);
          setFlagged(set);
          flaggedRef.current = set;
        }
        const savedIndex = localStorage.getItem(`index-${aid}`);
        if (savedIndex) setCurrentIndex(parseInt(savedIndex, 10));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.quizId, router]);

  // ─── Apply exam-mode chrome globally while on this page ──────────
  useEffect(() => {
    if (attempt?.mode === "exam") {
      document.documentElement.classList.add("exam-mode");
      return () => document.documentElement.classList.remove("exam-mode");
    }
  }, [attempt?.mode]);

  // ─── Tick timer ───────────────────────────────────────────────────
  useEffect(() => {
    if (!attempt) return;
    const startedMs = new Date(attempt.startedAt).getTime();
    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedMs) / 1000);
      setElapsed(seconds);
      // Auto-submit on exam timeout. Claim the submit lock synchronously
      // here so a concurrent manual submit sees it as busy.
      if (
        attempt.mode === "exam" &&
        attempt.timeLimitSeconds != null &&
        seconds >= attempt.timeLimitSeconds &&
        !autoSubmitFired.current &&
        !submittingRef.current
      ) {
        autoSubmitFired.current = true;
        submittingRef.current = true;
        void submitAttempt(true);
      }
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // ─── Persist answers + flags ─────────────────────────────────────
  useEffect(() => {
    answersRef.current = answers;
    if (attemptId && Object.keys(answers).length > 0) {
      localStorage.setItem(`answers-${attemptId}`, JSON.stringify(answers));
    }
  }, [answers, attemptId]);

  useEffect(() => {
    flaggedRef.current = flagged;
    if (attemptId) {
      localStorage.setItem(
        `flagged-${attemptId}`,
        JSON.stringify(Array.from(flagged))
      );
    }
  }, [flagged, attemptId]);

  // ─── Time tracking per question ──────────────────────────────────
  const trackQuestionTime = useCallback(() => {
    if (!attempt) return;
    const q = attempt.questions[currentIndex];
    if (!q) return;
    const timeSpent = Math.round(
      (Date.now() - questionStartTime.current) / 1000
    );
    answersRef.current = {
      ...answersRef.current,
      [q.id]: {
        ...answersRef.current[q.id],
        selectedAnswer: answersRef.current[q.id]?.selectedAnswer ?? null,
        timeSpentSeconds:
          (answersRef.current[q.id]?.timeSpentSeconds ?? 0) + timeSpent,
      },
    };
    setAnswers(answersRef.current);
  }, [attempt, currentIndex]);

  const selectAnswer = (questionId: string, letter: string) => {
    if (navigator.vibrate) navigator.vibrate(8);
    answersRef.current = {
      ...answersRef.current,
      [questionId]: {
        ...answersRef.current[questionId],
        selectedAnswer: letter,
        timeSpentSeconds:
          answersRef.current[questionId]?.timeSpentSeconds ?? 0,
      },
    };
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        selectedAnswer: letter,
        timeSpentSeconds: prev[questionId]?.timeSpentSeconds ?? 0,
      },
    }));
  };

  const toggleFlag = (questionId: string) => {
    if (navigator.vibrate) navigator.vibrate(12);
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      flaggedRef.current = next;
      return next;
    });
  };

  const goToQuestion = (index: number) => {
    if (!attempt) return;
    if (index < 0 || index >= attempt.questions.length) return;
    setDirection(index > currentIndex ? 1 : -1);
    trackQuestionTime();
    setCurrentIndex(index);
    questionStartTime.current = Date.now();
    if (attemptId) {
      localStorage.setItem(`index-${attemptId}`, String(index));
    }
  };

  // ─── Submit ───────────────────────────────────────────────────────
  // The auto-submit branch claims submittingRef synchronously before calling
  // this. Manual submit sets it here. JS is single-threaded so the two
  // paths can't interleave — whichever fires first wins.
  const submitAttempt = async (timedOut: boolean) => {
    if (!submittingRef.current) submittingRef.current = true;
    setSubmitting(true);
    setSubmitError("");

    try {
      trackQuestionTime();
      questionStartTime.current = Date.now();

      const finalAnswers: AnswerMap = { ...answersRef.current };
      const saved = localStorage.getItem(`answers-${attemptId}`);
      if (saved) {
        const savedAnswers: AnswerMap = JSON.parse(saved);
        for (const [qId, ans] of Object.entries(savedAnswers)) {
          if (!finalAnswers[qId] || finalAnswers[qId].selectedAnswer === null) {
            finalAnswers[qId] = ans;
          }
        }
      }

      if (attempt) {
        for (const q of attempt.questions) {
          if (!finalAnswers[q.id]) {
            finalAnswers[q.id] = { selectedAnswer: null, timeSpentSeconds: 0 };
          }
        }
      }

      const res = await fetch(`/api/attempt/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: finalAnswers,
          flaggedQuestionIds: Array.from(flaggedRef.current),
          timedOut,
        }),
      });

      if (!res.ok) {
        // If the server says the attempt was already submitted (race with
        // auto-submit), just navigate to the results page.
        if (res.status === 400) {
          router.push(`/quiz/${params.quizId}/results/${attemptId}`);
          return;
        }
        throw new Error(`Server error (${res.status})`);
      }
      const resultData = await res.json();

      sessionStorage.setItem(
        "latest-quiz-results",
        JSON.stringify(resultData)
      );
      localStorage.removeItem(`answers-${attemptId}`);
      localStorage.removeItem(`flagged-${attemptId}`);
      localStorage.removeItem(`index-${attemptId}`);
      sessionStorage.removeItem(`attempt-${params.quizId}`);

      router.push(
        `/quiz/${params.quizId}/results/${resultData.attempt.id}`
      );
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to submit. Try again."
      );
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  // ─── Keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (!attempt) return;
      const q = attempt.questions[currentIndex];
      if (!q) return;
      const key = e.key.toUpperCase();
      if (["A", "B", "C", "D", "E"].includes(key)) {
        e.preventDefault();
        selectAnswer(q.id, key);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToQuestion(currentIndex - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToQuestion(currentIndex + 1);
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFlag(q.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, currentIndex]);

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => goToQuestion(currentIndex + 1),
    onSwipeRight: () => goToQuestion(currentIndex - 1),
  });

  if (loading || !attempt) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="glass rounded-2xl p-8 shimmer">
          <p className="text-muted-foreground serif-italic">Loading…</p>
        </div>
      </div>
    );
  }

  const question = attempt.questions[currentIndex];
  const answeredCount = Object.values(answers).filter(
    (a) => a.selectedAnswer !== null
  ).length;
  const isExam = attempt.mode === "exam";
  const isFlagged = flagged.has(question.id);

  // Timer display for exam vs practice
  let timerText = formatTime(elapsed);
  let timerClass = "text-foreground";
  if (isExam && attempt.timeLimitSeconds != null) {
    const remaining = Math.max(0, attempt.timeLimitSeconds - elapsed);
    timerText = formatTime(remaining);
    if (remaining <= 60) timerClass = "timer-warning";
    else if (remaining <= 300) timerClass = "timer-caution";
  }

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-3 md:px-6 pb-24 md:pb-6 pt-3 md:pt-6 safe-top">
      {/* ─── Top bar ───────────────────────────────────────────── */}
      <header className="glass-strong rounded-2xl px-4 md:px-6 py-3 mb-3 md:mb-4 flex items-center justify-between sticky top-3 z-30 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <span className="small-caps text-[11px] text-muted-foreground hidden sm:inline">
            {isExam ? "Exam" : "Practice"}
          </span>
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground numeral text-sm">
              {answeredCount}
            </span>
            <span className="mx-1 opacity-60">/</span>
            {attempt.totalQuestions}
          </span>
          {flagged.size > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-[color:var(--gold)]">
              <FlagIcon filled className="w-3 h-3" /> {flagged.size}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`font-mono tabular-nums font-semibold ${
              isExam ? "text-2xl md:text-3xl" : "text-lg md:text-xl"
            } ${timerClass}`}
          >
            {timerText}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSubmitDialog(true)}
            className="glass text-xs font-semibold tap-target"
          >
            Submit
          </Button>
        </div>
      </header>

      {/* ─── Question card ─────────────────────────────────────── */}
      <article
        key={question.id}
        {...swipeHandlers}
        className={`glass-strong rounded-3xl p-5 md:p-8 mb-3 md:mb-4 flex-1 touch-pan-y ${
          direction === 1 ? "question-enter" : "question-enter-back"
        }`}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-baseline gap-3">
            <span className="numeral text-5xl md:text-6xl leading-none text-primary">
              {String(question.questionNumber).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <p className="small-caps text-[10px] text-muted-foreground mb-0.5">
                Question
              </p>
              <p className="text-xs serif-italic text-muted-foreground truncate">
                {QUESTION_TYPES[question.questionType]?.name ??
                  question.questionType}
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleFlag(question.id)}
            className={`tap-target rounded-full p-2.5 transition-all glow-hover ${
              isFlagged
                ? "bg-[color:var(--gold)]/15 text-[color:var(--gold)] border border-[color:var(--gold)]/40"
                : "bg-secondary/40 text-muted-foreground border border-transparent hover:border-border"
            }`}
            aria-label={isFlagged ? "Unflag question" : "Flag question"}
            title="Flag for review (F)"
          >
            <FlagIcon filled={isFlagged} className="w-4 h-4" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-[16px] md:text-[17px] leading-[1.65] text-foreground/90 whitespace-pre-line">
            {question.stimulus}
          </p>
        </div>

        <div className="rule-ornament mb-5 text-xs">
          <span aria-hidden="true">§</span>
        </div>

        <p className="serif-italic text-[15px] md:text-base text-foreground mb-5 leading-relaxed">
          {question.questionStem}
        </p>

        <div className="space-y-2.5">
          {(["A", "B", "C", "D", "E"] as const).map((letter) => {
            const isSelected =
              answers[question.id]?.selectedAnswer === letter;
            return (
              <button
                key={letter}
                onClick={() => selectAnswer(question.id, letter)}
                className={`tap-target w-full text-left p-3.5 md:p-4 rounded-2xl border transition-all duration-200 flex items-start gap-3 ${
                  isSelected
                    ? "bg-primary/8 border-primary/60 shadow-[0_4px_20px_-8px_var(--primary)]"
                    : "glass border-transparent hover:border-primary/25"
                }`}
              >
                <span
                  className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all font-display ${
                    isSelected
                      ? "bg-primary text-primary-foreground scale-105"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {letter}
                </span>
                <span className="text-[15px] md:text-base leading-relaxed pt-1.5">
                  {question.choices[letter]}
                </span>
              </button>
            );
          })}
        </div>
      </article>

      {/* ─── Bottom nav ────────────────────────────────────────── */}
      <nav className="glass-strong rounded-2xl px-3 py-2.5 flex items-center justify-between sticky bottom-3 safe-bottom z-30">
        <Button
          variant="ghost"
          onClick={() => goToQuestion(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="text-sm tap-target"
          aria-label="Previous question"
        >
          ←
        </Button>

        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide max-w-[70%]">
          {attempt.questions.map((q, i) => {
            const isAnswered = answers[q.id]?.selectedAnswer != null;
            const isCurrent = i === currentIndex;
            const isFlaggedNav = flagged.has(q.id);
            return (
              <button
                key={q.id}
                onClick={() => goToQuestion(i)}
                className={`relative shrink-0 w-8 h-8 rounded-full text-xs font-semibold transition-all font-display ${
                  isCurrent
                    ? "bg-primary text-primary-foreground scale-110 shadow-md"
                    : isAnswered
                      ? "bg-primary/20 text-primary"
                      : "bg-secondary/50 text-muted-foreground"
                }`}
                aria-label={`Question ${i + 1}${isFlaggedNav ? " (flagged)" : ""}`}
              >
                {i + 1}
                {isFlaggedNav && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[color:var(--gold)] border border-background" />
                )}
              </button>
            );
          })}
        </div>

        <Button
          variant="ghost"
          onClick={() => goToQuestion(currentIndex + 1)}
          disabled={currentIndex === attempt.questions.length - 1}
          className="text-sm tap-target"
          aria-label="Next question"
        >
          →
        </Button>
      </nav>

      {/* ─── Submit dialog ─────────────────────────────────────── */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="glass-strong border-primary/20">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {isExam ? "Submit exam?" : "Submit quiz?"}
            </DialogTitle>
            <DialogDescription>
              You&apos;ve answered{" "}
              <span className="numeral text-foreground">
                {answeredCount}
              </span>{" "}
              of {attempt.totalQuestions}.
              {answeredCount < attempt.totalQuestions && (
                <span className="block mt-1 text-destructive">
                  {attempt.totalQuestions - answeredCount} left blank.
                </span>
              )}
              {flagged.size > 0 && (
                <span className="block mt-1 text-[color:var(--gold-foreground)]">
                  {flagged.size} flagged for review.
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
              className="flex-1 tap-target"
            >
              Keep Working
            </Button>
            <Button
              onClick={() => {
                if (submittingRef.current) return;
                submittingRef.current = true;
                void submitAttempt(false);
              }}
              disabled={submitting}
              className="flex-1 tap-target bg-primary text-primary-foreground border-0"
            >
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FlagIcon({
  filled,
  className,
}: {
  filled?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 21V4" />
      <path d="M4 4h11l-1.5 4L15 12H4" />
    </svg>
  );
}
