import { invalidateDraws } from '@/features/draws/server/draws-cache';
import { fetchIrccFeed, ingestDraws, type IngestReport } from '@/features/draws/server/ingest-draws';
import { notifyDrawPublished } from '@/features/notifications/server/draw-notifications';
import { prisma } from '@/server/db/client';
import { appPushSender } from '@/server/push/web-push';

const sendPush = appPushSender();

/**
 * One refresh of the Derniers tirages: IRCC's feed read (or the one given),
 * new rounds stored, Alertes tirages sent. The daily job
 * (.github/workflows/ingest-draws.yml) and the Tableau de bord's « Actualiser
 * maintenant » both run this.
 */
export async function ingestNow(feed?: unknown): Promise<IngestReport> {
  const report = await ingestDraws({
    db: prisma,
    fetchFeed: feed ? async () => feed : fetchIrccFeed,
    sendPush,
    now: new Date(),
    // Each alerted Tirage also lands in the bells of Accounts with Alertes tirages on (#92).
    onAlerted: (draw) => notifyDrawPublished(prisma, draw),
  });
  // The pages' cached Tirages (and « lu il y a … ») are stale now.
  invalidateDraws();
  return report;
}
