/**
 * The requests Vercel BotID checks (#162): sign-up, sign-in (email and
 * Google), the password reset, the verification email, and the public forms
 * that write something (Demande d'intérêt, Alertes tirages, the PDF tool's
 * monthly count, « Signaler un problème », an Offre's order, a Consultation's booking). The browser
 * marks these requests (src/instrumentation-client.ts); the server refuses
 * the ones that come from a bot (src/server/bot-check.ts).
 */
export const AUTH_PROTECTED_PATHS = [
  '/api/auth/sign-up/email',
  '/api/auth/sign-in/email',
  '/api/auth/sign-in/social',
  '/api/auth/request-password-reset',
  '/api/auth/reset-password',
  '/api/auth/send-verification-email',
] as const;

export const TRPC_PROTECTED_PROCEDURES = [
  'accompagnement.submit',
  'draws.subscribe',
  'pdfTools.quota.use',
  'reports.create',
  'documentServices.orders.order',
  'consultation.book',
] as const;

export const BOT_PROTECTED_ROUTES = [
  ...AUTH_PROTECTED_PATHS.map((path) => ({ path, method: 'POST' })),
  ...TRPC_PROTECTED_PROCEDURES.map((procedure) => ({ path: `/api/trpc/${procedure}`, method: 'POST' })),
];

/** What a refused request answers, and the forms recognise. */
export const BOT_DETECTED = 'BOT_DETECTED';

/** True when a call was refused as coming from a bot (a tRPC or Better Auth error). */
export const isBotRefusal = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && ((error as { message?: string }).message === BOT_DETECTED || (error as { code?: string }).code === BOT_DETECTED);
