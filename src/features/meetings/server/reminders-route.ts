import { remindMeetings } from '@/features/meetings/server/meeting-reminders';
import { env } from '@/lib/env';
import { siteUrl } from '@/lib/site-url';
import { isCronCall } from '@/server/cron-auth';
import { prisma } from '@/server/db/client';
import { appMailer } from '@/server/email/app-mailer';

/**
 * POST /api/cron/meetings, called every 5 minutes by
 * .github/workflows/meeting-reminders.yml with CRON_SECRET: the Réunion
 * reminders, the day before and 15 minutes before (#94).
 */
export async function POST(request: Request): Promise<Response> {
  if (!env.CRON_SECRET) return Response.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  if (!isCronCall(request, env.CRON_SECRET)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return Response.json(await remindMeetings({ db: prisma, mailer: appMailer, siteUrl: siteUrl(), now: new Date() }));
  } catch (error) {
    console.error('[meetings] the reminders failed', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Reminders failed' }, { status: 500 });
  }
}
