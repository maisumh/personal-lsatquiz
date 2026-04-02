"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { QUESTION_TYPES, type QuestionTypeInfo } from "@/lib/constants/question-types";
import { QUESTION_BANK } from "@/lib/data/question-bank";

type Step = "select" | "confirm" | "done";

export default function CreateQuiz() {
  const [step, setStep] = useState<Step>("select");
  const [selected, setSelected] = useState<{ slug: string; info: QuestionTypeInfo } | null>(null);
  const [type, setType] = useState<"quiz" | "exam">("quiz");
  const [creating, setCreating] = useState(false);
  const [quizLink, setQuizLink] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!selected) return;
    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/quiz/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Ch. ${selected.info.chapter}: ${selected.info.name}`,
          type,
          questionTypes: [selected.slug],
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

  // Step 3: Quiz created — show link with copy feedback
  if (step === "done") {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="glass-strong rounded-3xl p-8 md:p-12 max-w-lg w-full text-center page-enter">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Quiz Created!</h1>
          <p className="text-muted-foreground mb-6">
            Copy the link below and send it when you&apos;re ready.
          </p>
          <div className="flex gap-2 mb-6">
            <Input
              readOnly
              value={quizLink}
              className="glass text-sm"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              onClick={copyLink}
              className={`shrink-0 min-w-[80px] border-0 transition-all duration-300 ${
                copied
                  ? "bg-emerald-500 hover:bg-emerald-500 text-white"
                  : "bg-gradient-to-r from-pink-500 to-rose-500 text-white"
              }`}
            >
              {copied ? (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </span>
              ) : (
                "Copy"
              )}
            </Button>
          </div>
          <div className="flex gap-3">
            <a
              href="/admin"
              className="flex-1 inline-flex items-center justify-center h-10 rounded-xl border border-border hover:bg-accent transition-colors text-sm font-medium"
            >
              Dashboard
            </a>
            <Button
              onClick={() => {
                setQuizLink("");
                setSelected(null);
                setCopied(false);
                setStep("select");
              }}
              variant="outline"
              className="flex-1 h-10 rounded-xl"
            >
              Create Another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Chapter detail — description + quiz/exam toggle + create
  if (step === "confirm" && selected) {
    const bankCount = QUESTION_BANK[selected.slug]?.length ?? 0;
    return (
      <div className="flex-1 max-w-lg mx-auto w-full p-4 page-enter">
        <div className="mb-6">
          <button
            onClick={() => setStep("select")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Back to Chapters
          </button>
        </div>

        <div className="glass-strong rounded-3xl p-6 md:p-8">
          <Badge variant="secondary" className="text-xs mb-3">
            Chapter {selected.info.chapter}
          </Badge>
          <h1 className="text-2xl font-bold mb-3 bg-gradient-to-r from-pink-600 via-rose-500 to-pink-400 bg-clip-text text-transparent">
            {selected.info.name}
          </h1>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            {selected.info.description}
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            {bankCount} questions available
          </p>

          {/* Quiz vs Exam */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setType("quiz")}
              className={`flex-1 p-4 rounded-xl border transition-all text-center ${
                type === "quiz"
                  ? "glass-strong border-primary/50 shadow-[0_0_15px_oklch(0.7_0.15_340/20%)]"
                  : "glass border-transparent hover:border-primary/30"
              }`}
            >
              <p className="font-semibold">Quiz</p>
              <p className="text-xs text-muted-foreground mt-1">10 questions</p>
            </button>
            <button
              onClick={() => setType("exam")}
              className={`flex-1 p-4 rounded-xl border transition-all text-center ${
                type === "exam"
                  ? "glass-strong border-primary/50 shadow-[0_0_15px_oklch(0.7_0.15_340/20%)]"
                  : "glass border-transparent hover:border-primary/30"
              }`}
            >
              <p className="font-semibold">Exam</p>
              <p className="text-xs text-muted-foreground mt-1">30 questions</p>
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm mb-4">
              {error}
            </div>
          )}

          <Button
            onClick={handleCreate}
            disabled={creating}
            className="w-full h-12 text-base font-semibold rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white border-0 glow-hover transition-all disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Quiz"}
          </Button>
        </div>
      </div>
    );
  }

  // Step 1: Chapter list — tap one to continue
  return (
    <div className="flex-1 max-w-2xl mx-auto w-full p-4 page-enter">
      <div className="mb-6">
        <a
          href="/admin"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to Dashboard
        </a>
      </div>

      <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-pink-600 via-rose-500 to-pink-400 bg-clip-text text-transparent">
        Select a Chapter
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Choose a chapter to create a quiz from.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Object.entries(QUESTION_TYPES).map(([slug, info]) => {
          const bankCount = QUESTION_BANK[slug]?.length ?? 0;
          return (
            <button
              key={slug}
              onClick={() => {
                setSelected({ slug, info });
                setStep("confirm");
              }}
              className="glass p-4 rounded-xl border border-transparent hover:border-primary/30 glow-hover transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">
                  Chapter {info.chapter}
                </span>
                <svg
                  className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <p className="text-sm font-semibold">{info.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {bankCount} questions
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
