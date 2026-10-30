'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import type { z } from 'zod';

/**
 * Checks what the browser kept: any input is accepted (it is unknown JSON),
 * so a schema may coerce or default old shapes, e.g. with `.catch()`.
 */
type StoredSchema<T> = z.ZodType<T, z.ZodTypeDef, unknown>;

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Parses a stored value against `schema`; anything unreadable or out of shape is ignored. */
export function parseStored<T>(raw: string | null, schema: StoredSchema<T>): T | null {
  if (!raw) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The value stored under `key` in this browser, or null (none, or storage unavailable). */
export function readStored<T>(key: string, schema: StoredSchema<T>): T | null {
  return parseStored(readRaw(key), schema);
}

/** Keeps `value` under `key` in this browser; storage full or blocked only loses it for later visits. */
export function writeStored(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the answers still work for this visit.
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

/**
 * A value stored under `key` as a React value: null on the server and during
 * hydration, so a static page renders the same on both, then the browser's copy.
 */
export function useStoredValue<T>(key: string, schema: StoredSchema<T>): T | null {
  const raw = useSyncExternalStore(subscribe, () => readRaw(key), () => null);
  return useMemo(() => parseStored(raw, schema), [raw, schema]);
}

/**
 * A calculator's answers, kept in this browser between visits. Storage can be
 * unavailable (private mode); the form then simply starts from `defaults`.
 */
export function useStoredForm<T>(key: string, schema: StoredSchema<T>, defaults: T): [T, (next: T) => void] {
  const stored = useStoredValue(key, schema);
  const [edited, setEdited] = useState<T | null>(null);

  const update = useCallback(
    (next: T) => {
      setEdited(next);
      writeStored(key, next);
    },
    [key],
  );

  return [edited ?? stored ?? defaults, update];
}
