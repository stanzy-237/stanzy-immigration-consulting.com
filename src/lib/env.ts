import { z } from 'zod';

/**
 * Validated application configuration. For config this app depends on (e.g.
 * connection strings, API keys), import `env` instead of reading `process.env`
 * directly so missing or malformed values fail fast with a clear message rather
 * than surfacing as a confusing runtime error later.
 *
 * Framework/build-time variables that Next and the runtime set themselves —
 * `NODE_ENV`, `VERCEL_URL`, `PORT` — are read directly from `process.env` at
 * their point of use and are intentionally not part of this schema.
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
  // Resend API key. Without it, emails are logged to the console instead.
  RESEND_API_KEY: z.string().min(1).optional(),
  // Sender for transactional email; must be on a domain verified in Resend.
  // Required whenever RESEND_API_KEY is set.
  EMAIL_FROM: z.string().min(3).optional(),
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
