import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Whether a scheduled call carries `Authorization: Bearer <secret>` (the
 * GitHub Actions workflows hold CRON_SECRET). Compares digests so the check
 * takes the same time whatever was sent. Without a secret, nothing passes.
 */
export function isCronCall(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const given = request.headers.get('authorization') ?? '';
  return timingSafeEqual(digest(given), digest(`Bearer ${secret}`));
}
