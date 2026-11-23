'use client';

import { useEffect, useState } from 'react';

/** Under this, the timer turns rouge (docs/design/consultation-motion.md, row « Slot-hold timer »). */
const WARN_MS = 2 * 60 * 1000;

/**
 * The time left on a hold, as `mm:ss`, ticking each second (no motion per
 * second: the text just changes). `over` once it reaches 00:00.
 */
export function useHoldCountdown(heldUntil: Date | null): { text: string; warn: boolean; over: boolean } {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!heldUntil) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [heldUntil]);

  const left = heldUntil ? Math.max(0, heldUntil.getTime() - now) : 0;
  const seconds = Math.ceil(left / 1000);
  const text = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return { text, warn: left > 0 && left < WARN_MS, over: left === 0 };
}
