import type Rollbar from 'rollbar';

/** The browser's Rollbar, once ErrorTracking has loaded it (#160); null before, and without a token. */
export type BrowserRollbar = Pick<Rollbar, 'error' | 'configure'>;

let instance: BrowserRollbar | null = null;
let person: Rollbar.PersonParams | null = null;

export function setBrowserRollbar(rollbar: BrowserRollbar): void {
  instance = rollbar;
  if (person) rollbar.configure({ payload: { person } });
}

export const browserRollbar = (): BrowserRollbar | null => instance;

/** Who the errors happen to, kept until Rollbar is loaded. */
export function setRollbarPerson(next: Rollbar.PersonParams): void {
  person = next;
  instance?.configure({ payload: { person: next } });
}

/**
 * Reports an error a boundary caught (React swallows those, so Rollbar's own
 * handlers never see them). Server failures are skipped: the server reported them.
 */
export function reportClientError(error: unknown): void {
  if (!instance) return;
  if (error instanceof Error && error.name === 'TRPCClientError') return;
  instance.error(error instanceof Error ? error : new Error(String(error)));
}
