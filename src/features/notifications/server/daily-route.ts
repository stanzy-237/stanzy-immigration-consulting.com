import { runDailyJobs } from '@/features/notifications/server/daily-jobs';
import { env } from '@/lib/env';
import { siteUrl } from '@/lib/site-url';
import { isCronCall } from '@/server/cron-auth';
import { prisma } from '@/server/db/client';
import { appMailer } from '@/server/email/app-mailer';

/**
 * POST /api/cron/daily, called every morning by .github/workflows/daily-jobs.yml
 * with CRON_SECRET: Facture reminders, the sign-ups summary, the clean-up (#92).
 */
export async function POST(request: Request): Promise<Response> {
  if (!env.CRON_SECRET) return Response.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  if (!isCronCall(request, env.CRON_SECRET)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return Response.json(await runDailyJobs({ db: prisma, mailer: appMailer, siteUrl: siteUrl(), now: new Date() }));
  } catch (error) {
    console.error('[daily] the daily jobs failed', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Daily jobs failed' }, { status: 500 });
  }
}
