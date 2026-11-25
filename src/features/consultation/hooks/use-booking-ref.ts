'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** The booking this browser holds: its id, and the secret when its booker is signed out. */
export type BookingRef = { id: string; token?: string };

const KEY = 'stanzy.consultation.booking';
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Keeps the held booking for this tab (sessionStorage): never in the address,
 * so the secret is not in history, logs or a shared link. Gone when the tab closes;
 * a signed-in booker finds it again through `consultation.current`.
 */
export function useBookingRef(): [BookingRef | null, (ref: BookingRef | null) => void] {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const ref = raw ? (JSON.parse(raw) as BookingRef) : null;
  const set = useCallback((next: BookingRef | null) => {
    try {
      if (next) window.sessionStorage.setItem(KEY, JSON.stringify(next));
      else window.sessionStorage.removeItem(KEY);
    } catch {
      // Private mode without storage: the booking lives as long as the page.
    }
    for (const listener of listeners) listener();
  }, []);
  return [ref, set];
}
