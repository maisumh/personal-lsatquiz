"use client";

import { useRef, useCallback } from "react";

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** minimum horizontal distance in px (default 60) */
  threshold?: number;
  /** max vertical drift allowed to still count as horizontal swipe */
  verticalTolerance?: number;
}

/**
 * Minimal pointer-event swipe detector. Attach the returned handlers to any
 * element. Works on touch + pen + mouse. Ignores scrolls.
 */
export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 60,
  verticalTolerance = 50,
}: SwipeHandlers) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const s = start.current;
      if (!s || s.id !== e.pointerId) return;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      start.current = null;
      if (Math.abs(dy) > verticalTolerance) return;
      if (dx <= -threshold) onSwipeLeft?.();
      else if (dx >= threshold) onSwipeRight?.();
    },
    [onSwipeLeft, onSwipeRight, threshold, verticalTolerance]
  );

  const onPointerCancel = useCallback(() => {
    start.current = null;
  }, []);

  return { onPointerDown, onPointerUp, onPointerCancel };
}
