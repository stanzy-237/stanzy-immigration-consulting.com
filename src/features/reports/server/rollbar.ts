import 'server-only';

import Rollbar from 'rollbar';

import { baseRollbarConfig, rollbarPerson, type ErrorPerson } from '@/features/reports/lib/rollbar-config';
import { env } from '@/lib/env';

let instance: Rollbar | null = null;

/** The server's Rollbar, created on first use; it sends nothing without its token. */
export function serverRollbar(): Rollbar {
  instance ??= new Rollbar({
    ...baseRollbarConfig(env.ROLLBAR_STANZY_IMMIGRATION_CONSULTING_CO_SERVER_TOKEN_1795122183),
    // Next reports uncaught errors through instrumentation's onRequestError;
    // Rollbar's own process handlers would double them.
    captureUncaught: false,
    captureUnhandledRejections: false,
  });
  return instance;
}

/** Where a server error happened: the route (its path or tRPC procedure) and who called it. */
export type ServerErrorContext = {
  route: string;
  method?: string;
  person: ErrorPerson | null;
  extra?: Record<string, string>;
};

/**
 * Sends `error` to Rollbar and waits until it is out (a function may stop
 * once the response is sent). Never throws: reporting must not fail a request.
 */
export async function reportServerError(error: unknown, context: ServerErrorContext): Promise<void> {
  const rollbar = serverRollbar();
  try {
    await new Promise<void>((resolve) => {
      // Rollbar's server SDK reads the Account from a request-like argument
      // (`rollbar_person`); no headers, body or cookies are passed.
      const request = { headers: {}, method: context.method ?? 'GET', url: context.route, rollbar_person: rollbarPerson(context.person) };
      rollbar.error(error instanceof Error ? error : new Error(String(error)), request, { route: context.route, ...context.extra }, () =>
        resolve(),
      );
    });
  } catch {
    // Rollbar unreachable: the request already failed on its own.
  }
}
