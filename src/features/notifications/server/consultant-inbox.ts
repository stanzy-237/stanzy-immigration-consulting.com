import { env } from '@/lib/env';
import type { TRPCContext } from '@/server/trpc/context';

type Db = Pick<TRPCContext['prisma'], 'account'>;

/** Who reads an email meant for the consultant, and in what language. */
export type ConsultantInbox = { email: string; locale: string | null };

/**
 * Where the consultant's emails go: `CONSULTANT_INBOX` when set (in French),
 * otherwise every consultant Account's own email. The in-app Notifications
 * and pushes still go to the consultant Accounts.
 */
export async function consultantInboxes(db: Db, inbox = env.CONSULTANT_INBOX): Promise<ConsultantInbox[]> {
  const address = inbox?.trim();
  if (address) return [{ email: address, locale: 'fr' }];
  return db.account.findMany({ where: { role: 'CONSULTANT' }, select: { email: true, locale: true } });
}
