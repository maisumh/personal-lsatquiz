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

export interface Quiz {
  id: string;
  title: string;
  type: "quiz" | "exam";
  questionTypes: string[];
  timeLimitMinutes: number;
  createdAt: string;
  questions: QuizQuestion[];
}

export interface Answer {
  questionId: string;
  questionType: string;
  selectedAnswer: "A" | "B" | "C" | "D" | "E" | null;
  isCorrect: boolean;
  timeSpentSeconds: number;
}

export interface Attempt {
  id: string;
  quizId: string;
  startedAt: string;
  completedAt: string | null;
  timeSpentSeconds: number | null;
  score: number | null;
  totalQuestions: number;
  status: "in_progress" | "completed" | "timed_out";
  answers: Answer[];
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
  }[];
}
