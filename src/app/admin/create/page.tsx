"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { QUESTION_TYPES } from "@/lib/constants/question-types";
import { QUESTION_BANK } from "@/lib/data/question-bank";

export default function CreateQuiz() {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"quiz" | "exam">("quiz");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [quizLink, setQuizLink] = useState("");

  const toggleType = (slug: string) => {
    setSelectedTypes((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const selectAll = () => {
    if (selectedTypes.length === Object.keys(QUESTION_TYPES).length) {
      setSelectedTypes([]);
    } else {
      setSelectedTypes(Object.keys(QUESTION_TYPES));
    }
  };

  const handleCreate = async () => {
    if (selectedTypes.length === 0) return;
    setCreating(true);

    const res = await fetch("/api/quiz/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title || undefined,
        type,
        questionTypes: selectedTypes,
      }),
    });

    const data = await res.json();
    setQuizLink(`${window.location.origin}/quiz/${data.id}`);
    setCreating(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(quizLink);
  };

  if (quizLink) {
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
              className="bg-gradient-to-r from-pink-500 to-rose-500 text-white border-0 shrink-0"
            >
              Copy
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
                setSelectedTypes([]);
                setTitle("");
              }}
              variant="outline"
              className="flex-1"
            >
              Create Another
            </Button>
          </div>
        </div>
      </div>
    );
  }

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

      <div className="glass-strong rounded-3xl p-6 md:p-8">
        <h1 className="text-2xl font-bold mb-6 bg-gradient-to-r from-pink-600 via-rose-500 to-pink-400 bg-clip-text text-transparent">
          Create Quiz
        </h1>

        <div className="space-y-6">
          {/* Title */}
          <div>
            <Label htmlFor="title" className="text-sm font-medium">
              Title (optional)
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Auto-generated from selected types"
              className="mt-1.5 glass"
            />
          </div>

          {/* Type Toggle */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Type</Label>
            <div className="flex gap-3">
              <button
                onClick={() => setType("quiz")}
                className={`flex-1 p-4 rounded-xl border transition-all text-center ${
                  type === "quiz"
                    ? "glass-strong border-primary/50 shadow-[0_0_15px_oklch(0.7_0.15_340/20%)]"
                    : "glass border-transparent hover:border-primary/30"
                }`}
              >
                <p className="font-semibold">Quiz</p>
                <p className="text-xs text-muted-foreground mt-1">
                  10 questions &middot; 15 min
                </p>
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
                <p className="text-xs text-muted-foreground mt-1">
                  30 questions &middot; 45 min
                </p>
              </button>
            </div>
          </div>

          {/* Question Types */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Question Types</Label>
              <button
                onClick={selectAll}
                className="text-xs text-primary hover:underline"
              >
                {selectedTypes.length === Object.keys(QUESTION_TYPES).length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(QUESTION_TYPES).map(([slug, info]) => {
                const bankCount = QUESTION_BANK[slug]?.length ?? 0;
                return (
                  <label
                    key={slug}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedTypes.includes(slug)
                        ? "glass-strong border-primary/40"
                        : "glass border-transparent hover:border-primary/20"
                    }`}
                  >
                    <Checkbox
                      checked={selectedTypes.includes(slug)}
                      onCheckedChange={() => toggleType(slug)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        Ch. {info.chapter}: {info.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {bankCount} questions available
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Selected Preview */}
          {selectedTypes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedTypes.map((slug) => (
                <Badge key={slug} variant="secondary" className="text-xs">
                  {QUESTION_TYPES[slug]?.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Create Button */}
          <Button
            onClick={handleCreate}
            disabled={selectedTypes.length === 0 || creating}
            className="w-full h-12 text-base font-semibold rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white border-0 glow-hover transition-all disabled:opacity-50"
          >
            {creating
              ? "Creating..."
              : `Create ${type === "quiz" ? "Quiz" : "Exam"} (${
                  type === "quiz" ? "10" : "30"
                } questions)`}
          </Button>
        </div>
      </div>
    </div>
  );
}
