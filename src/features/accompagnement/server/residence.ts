import type { TRPCContext } from '@/server/trpc/context';

type Db = TRPCContext['prisma'];

/** Whether the Account lives in Cameroon, as their latest Demande d'intérêt says: « Stanzy s'en charge » is for them (#81). */
export async function livesInCameroon(db: Db, accountId: string): Promise<boolean> {
  const latest = await db.interestRequest.findFirst({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
    select: { residence: true },
  });
  return latest?.residence === 'CM';
}
