import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function pickQuestions<T>(items: T[], count: number): T[] {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function distributeCount(
  types: string[],
  total: number
): Record<string, number> {
  const base = Math.floor(total / types.length);
  const remainder = total % types.length;
  const result: Record<string, number> = {};
  types.forEach((type, i) => {
    result[type] = base + (i < remainder ? 1 : 0);
  });
  return result;
}
