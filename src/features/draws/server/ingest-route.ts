import { createIngestHandler } from '@/features/draws/server/ingest-handler';
import { fetchIrccFeed, ingestDraws } from '@/features/draws/server/ingest-draws';
import { webPushSender } from '@/features/draws/server/web-push-sender';
import { env } from '@/lib/env';
import { prisma } from '@/server/db/client';

const sendPush =
  env.VAPID_PRIVATE_KEY && env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_SUBJECT
    ? webPushSender({
        subject: env.VAPID_SUBJECT,
        publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
      })
    : null;

/**
 * POST /api/cron/draws, called hourly by .github/workflows/ingest-draws.yml.
 * The workflow sends IRCC's feed when it could download it; otherwise the app
 * reads it from canada.ca itself.
 */
export const POST = createIngestHandler({
  secret: env.CRON_SECRET,
  run: (feed) =>
    ingestDraws({ db: prisma, fetchFeed: feed ? async () => feed : fetchIrccFeed, sendPush, now: new Date() }),
});
