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
