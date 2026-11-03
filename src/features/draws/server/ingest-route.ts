import { createIngestHandler } from '@/features/draws/server/ingest-handler';
import { fetchIrccFeed, ingestDraws } from '@/features/draws/server/ingest-draws';
import { notifyDrawPublished } from '@/features/notifications/server/draw-notifications';
import { env } from '@/lib/env';
import { prisma } from '@/server/db/client';
import { appPushSender } from '@/server/push/web-push';

const sendPush = appPushSender();

/**
 * POST /api/cron/draws, called hourly by .github/workflows/ingest-draws.yml.
 * The workflow sends IRCC's feed when it could download it; otherwise the app
 * reads it from canada.ca itself.
 */
export const POST = createIngestHandler({
  secret: env.CRON_SECRET,
  run: (feed) =>
    ingestDraws({
      db: prisma,
      fetchFeed: feed ? async () => feed : fetchIrccFeed,
      sendPush,
      now: new Date(),
      // Each alerted Tirage also lands in the bells of Accounts with Alertes tirages on (#92).
      onAlerted: (draw) => notifyDrawPublished(prisma, draw),
    }),
});
