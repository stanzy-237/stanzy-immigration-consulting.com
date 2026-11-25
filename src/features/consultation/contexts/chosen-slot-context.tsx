'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

type ChosenSlot = [start: string | undefined, choose: (start: string) => void];

const ChosenSlotContext = createContext<ChosenSlot | null>(null);

/**
 * The start the visitor picked in « Choisissez votre créneau », shared with
 * what books it from elsewhere on the page (the mobile sticky bar).
 * Undefined until they pick: each reader then falls back to the first free slot.
 */
export function ChosenSlotProvider({ children }: { children: ReactNode }): ReactNode {
  const value = useState<string | undefined>(undefined);
  return <ChosenSlotContext.Provider value={value}>{children}</ChosenSlotContext.Provider>;
}

/** The picked start and a way to change it; outside a provider, a choice of the caller's own. */
export function useChosenSlot(): ChosenSlot {
  const shared = useContext(ChosenSlotContext);
  const own = useState<string | undefined>(undefined);
  return shared ?? own;
}

/** The first free start of the days the server sent, if any. */
export const firstFreeStart = (days: readonly { starts: readonly string[] }[]): string | undefined =>
  days.find((day) => day.starts.length > 0)?.starts[0];
