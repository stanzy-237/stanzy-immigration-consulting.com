import { z } from 'zod';

import { parseConsultantEmails } from '@/features/auth/lib/consultant-emails';

/**
 * Validated application configuration. For config this app depends on (e.g.
 * connection strings, API keys), import `env` instead of reading `process.env`
 * directly so missing or malformed values fail fast with a clear message rather
 * than surfacing as a confusing runtime error later.
 *
 * Framework/build-time variables that Next and the runtime set themselves —
 * `NODE_ENV`, `VERCEL_URL`, `PORT` — are read directly from `process.env` at
 * their point of use and are intentionally not part of this schema. So is
 * `GOOGLE_SIGN_IN_ENABLED`, which `next.config.ts` derives from the Google
 * vars at build time so the browser bundle knows whether to show the button.
 *
 * Validation is skipped when `SKIP_ENV_VALIDATION` is set, which lets CI run
 * lint/typecheck and Docker-style build steps without a live database.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Pooled Neon connection string, used by the app at runtime.
  DATABASE_URL: z.string().url(),
  // Direct Neon connection string, used by Prisma for migrations.
  DIRECT_URL: z.string().url().optional(),
  // Signs session cookies and verification tokens. `openssl rand -base64 32`.
  BETTER_AUTH_SECRET: z.string().min(32),
  // Public origin of the app. Required in Vercel production (VERCEL_ENV), where
  // VERCEL_URL is the per-deployment *.vercel.app host, not the real domain.
  // Previews and local dev fall back to VERCEL_URL / localhost.
  BETTER_AUTH_URL: z.string().url().optional(),
  // Parent domain for the session cookie (`stanzy-immigration-consulting.com`),
  // so one sign-in covers the site and the Tableau de bord on admin.<site>.
  // Production only: unset, each host keeps its own sign-in.
  AUTH_COOKIE_DOMAIN: z.string().min(3).optional(),
  // Resend API key. Without it, emails are logged to the console instead.
  RESEND_API_KEY: z.string().min(1).optional(),
  // Sender for transactional email; must be on a domain verified in Resend.
  // Required whenever RESEND_API_KEY is set.
  EMAIL_FROM: z.string().min(3).optional(),
  // Google OAuth client for "Continuer avec Google" (scripts/setup-google-sign-in.sh).
  // Optional: without it the Google button is hidden and email/password still
  // works, so a deploy never breaks for lack of it. Set both or neither.
  GOOGLE_CLIENT_ID: z
    .string()
    .regex(
      /\.apps\.googleusercontent\.com$/,
      'Expected a Google OAuth client ID (…apps.googleusercontent.com)',
    )
    .optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  // Comma-separated emails whose Account gets the consultant role at creation
  // (normally one). Optional: without it nobody is consultant.
  CONSULTANT_EMAILS: z
    .string()
    .refine(
      (raw) => parseConsultantEmails(raw).invalid.length === 0,
      'Expected comma-separated email addresses',
    )
    .optional(),
  // Shared with the scheduled GitHub Actions workflow that calls
  // /api/cron/draws (#49). `openssl rand -base64 32`. Optional: without it the
  // endpoint answers 503 and the draws are never refreshed.
  CRON_SECRET: z.string().min(32).optional(),
  // VAPID keys for Alertes tirages (Web Push, #49): `npx web-push
  // generate-vapid-keys`. The public key is also read by the browser. Optional:
  // without them the alert button is hidden. Set all three or none.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  // Contact the push services can reach: `mailto:you@your-domain.com`.
  VAPID_SUBJECT: z.string().regex(/^(mailto:|https:\/\/)/, 'Expected mailto:… or https://…').optional(),
}).superRefine((value, ctx) => {
  if (process.env.VERCEL_ENV === 'production' && !value.BETTER_AUTH_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['BETTER_AUTH_URL'],
      message: 'Required in production (the public URL, e.g. https://your-domain.com)',
    });
  }
  if (value.RESEND_API_KEY && !value.EMAIL_FROM) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['EMAIL_FROM'],
      message: 'Required when RESEND_API_KEY is set (a sender on your verified domain)',
    });
  }
  const vapid = ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const;
  if (vapid.some((key) => value[key])) {
    for (const key of vapid.filter((k) => !value[k])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: 'Required when any VAPID variable is set (set all three or none)',
      });
    }
  }
  for (const [key, other] of [
    ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    ['GOOGLE_CLIENT_SECRET', 'GOOGLE_CLIENT_ID'],
  ] as const) {
    if (value[other] && !value[key]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `Required when ${other} is set (both come from the same Google OAuth client)`,
      });
    }
  }
});

export type Env = z.infer<typeof schema>;

function loadEnv(): Env {
  if (process.env.SKIP_ENV_VALIDATION) {
    return process.env as unknown as Env;
  }

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
