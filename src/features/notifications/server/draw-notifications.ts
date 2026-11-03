import type { NormalizedDraw } from '@/features/draws/lib/normalize-ircc-rounds';
import { notify } from '@/features/notifications/server/notify';
import type { TRPCContext } from '@/server/trpc/context';

/**
 * Puts a new Tirage in the bell of every Account with Alertes tirages on one
 * of its devices (#92); the Alerte tirage itself is the push.
 */
export async function notifyDrawPublished(db: TRPCContext['prisma'], draw: NormalizedDraw): Promise<void> {
  const devices = await db.pushSubscription.findMany({
    where: { drawAlerts: true, accountId: { not: null } },
    select: { accountId: true },
  });
  const recipients = [...new Set(devices.map((d) => d.accountId!))];
  if (recipients.length === 0) return;
  await notify(db, {
    kind: 'DRAW_PUBLISHED',
    actorId: null,
    recipients,
    target: {},
    params: { round: draw.round, crs: String(draw.crsMin), invitations: String(draw.invitations) },
  });
}
