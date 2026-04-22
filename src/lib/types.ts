export interface Question {
  id: string;
  questionType: string;
  stimulus: string;
  questionStem: string;
  choices: { A: string; B: string; C: string; D: string; E: string };
  correctAnswer: "A" | "B" | "C" | "D" | "E";
  explanation: string;
}

export interface QuizQuestion extends Question {
  questionNumber: number;
}

/**
 * A Quiz is a reusable *config*. It defines what a session looks like
 * (chapters, count, mode, time limit) but does NOT pin a question list.
 * Questions are sampled fresh at attempt start so each retake is different.
 *
 * Legacy quizzes saved before this rework may still carry a `questions` field
 * (pre-sampled). The runtime treats those as a fallback only.
 */
export interface Quiz {
  id: string;
  title: string;
  type: "quiz" | "exam"; // kept for user-facing labels; "exam" = LSAT timed behavior
  questionTypes: string[];
  questionCount: number;
  timeLimitMinutes: number;
  createdAt: string;
  /** @deprecated only present on pre-migration blobs */
  questions?: QuizQuestion[];
}

export interface Answer {
  questionId: string;
  questionType: string;
  selectedAnswer: "A" | "B" | "C" | "D" | "E" | null;
  isCorrect: boolean;
  timeSpentSeconds: number;
}

export type AttemptSourceKind = "fresh" | "retake" | "wrong-only" | "drill";

export interface Attempt {
  id: string;
  quizId: string;
  /** Snapshot of the quiz title at attempt time */
  quizTitle?: string;
  /** Snapshot of mode for the take screen */
  mode?: "quiz" | "exam";
  /** Snapshot of time limit in seconds (server-enforced for exam mode) */
  timeLimitSeconds?: number | null;
  startedAt: string;
  completedAt: string | null;
  timeSpentSeconds: number | null;
  score: number | null;
  totalQuestions: number;
  status: "in_progress" | "completed" | "timed_out";
  answers: Answer[];
  /** Fresh question selection for this attempt. Optional for legacy attempts. */
  questions?: QuizQuestion[];
  /** Question IDs the user flagged during the attempt */
  flaggedQuestionIds?: string[];
  /** Notes written post-quiz keyed by question ID */
  notesByQuestionId?: Record<string, string>;
  /** If this attempt was spawned from another (wrong-only redo, drill), link it */
  sourceAttemptId?: string;
  sourceKind?: AttemptSourceKind;
}

export interface IndexEntry {
  quizzes: {
    id: string;
    title: string;
    type: "quiz" | "exam";
    questionTypes: string[];
    createdAt: string;
    questionCount: number;
  }[];
  attempts: {
    id: string;
    quizId: string;
    quizTitle: string;
    score: number | null;
    totalQuestions: number;
    completedAt: string | null;
    status: string;
    mode?: "quiz" | "exam";
  }[];
}
