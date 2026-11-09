import { z } from 'zod';

import { parseConsultantEmails } from '@/features/auth/lib/consultant-emails';
import { isEmailSender } from '@/server/email/sender';

const SENDER_FORMAT = 'Expected an email address or Name <address@domain>, e.g. Stanzy Immigration <dossiers@notifications.your-domain.com>';

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
  // Sender for the app's emails (Dossiers, Factures, messages):
  // `Name <address@domain>`, on a domain verified in Resend. Required whenever
  // RESEND_API_KEY is set.
  EMAIL_FROM: z.string().refine(isEmailSender, SENDER_FORMAT).optional(),
  // Sender for account emails (verification, password reset), on its own
  // subdomain. Optional: without it they come from EMAIL_FROM.
  AUTH_EMAIL_FROM: z.string().refine(isEmailSender, SENDER_FORMAT).optional(),
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
  // Where the consultant's emails go. Optional: without it, to every
  // consultant Account's own email.
  CONSULTANT_INBOX: z.string().email().optional(),
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
  // Encrypts the Documents de service's file keys (ADR 0007): 32 random bytes,
  // base64 (`openssl rand -base64 32`). Never change it once files exist:
  // they could no longer be read. Optional: without it uploads are refused.
  DOSSIER_FILES_KEY: z
    .string()
    .refine((raw) => Buffer.from(raw, 'base64').length === 32, 'Expected 32 bytes, base64 (openssl rand -base64 32)')
    .optional(),
  // Cloudflare R2 (#87): every file the app stores. One API token with
  // object read/write on both buckets (scripts/setup-r2.sh walks through it).
  // Optional: without them uploads are refused. Set all five or none.
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  // Private bucket: Documents de service and Preuves de paiement (ciphertext only).
  R2_PRIVATE_BUCKET: z.string().min(1).optional(),
  // Public bucket: blog images and the TikTok carousel.
  R2_PUBLIC_BUCKET: z.string().min(1).optional(),
  // Where the public bucket is served: its custom domain, or its r2.dev address.
  NEXT_PUBLIC_R2_PUBLIC_URL: z.string().url().optional(),
  // Stream Video (#94): Réunions, their Enregistrement and Transcription.
  // The key and secret of the Stream app (dashboard → the app → API keys);
  // the secret also verifies Stream's webhooks. Optional: without them the
  // Réunions can be planned but not joined. Set both or neither.
  STREAM_API_KEY: z.string().min(1).optional(),
  STREAM_API_SECRET: z.string().min(1).optional(),
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
  const r2 = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PRIVATE_BUCKET', 'R2_PUBLIC_BUCKET'] as const;
  if (r2.some((key) => value[key])) {
    for (const key of r2.filter((k) => !value[k])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: 'Required when any R2 variable is set (set all five or none)',
      });
    }
  }
  for (const [key, other] of [
    ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    ['GOOGLE_CLIENT_SECRET', 'GOOGLE_CLIENT_ID'],
    ['STREAM_API_KEY', 'STREAM_API_SECRET'],
    ['STREAM_API_SECRET', 'STREAM_API_KEY'],
  ] as const) {
    if (value[other] && !value[key]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `Required when ${other} is set (both come from the same ${key.startsWith('STREAM') ? 'Stream app' : 'Google OAuth client'})`,
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
