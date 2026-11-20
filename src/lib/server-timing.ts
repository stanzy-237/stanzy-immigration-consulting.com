/**
 * Durations for a `Server-Timing` header (#165): which step of a request took
 * the time, readable in the browser's developer tools (Network → Timing).
 * Names and milliseconds only.
 */
export function serverTiming() {
  const entries: string[] = [];
  return {
    /** Runs `work` and records how long it took under `name`. */
    async time<T>(name: string, work: () => Promise<T>): Promise<T> {
      const start = performance.now();
      try {
        return await work();
      } finally {
        entries.push(`${name};dur=${(performance.now() - start).toFixed(1)}`);
      }
    },
    header: (): string => entries.join(', '),
  };
}

export type ServerTiming = ReturnType<typeof serverTiming>;
