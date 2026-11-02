import { TRPCError } from '@trpc/server';

import { isConsultant } from '@/features/dossiers/server/dossier-access';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';

type Db = TRPCContext['prisma'];

export const invoiceFields = {
  id: true,
  number: true,
  status: true,
  currency: true,
  dueDate: true,
  notes: true,
  sentAt: true,
  paidAt: true,
  cancelledAt: true,
  cancelReason: true,
  createdAt: true,
  lines: { orderBy: { position: 'asc' }, select: { description: true, quantity: true, unitAmount: true } },
  dossier: {
    select: {
      id: true,
      service: true,
      accountId: true,
      account: { select: { id: true, name: true, email: true, locale: true } },
    },
  },
} as const;

/**
 * A Facture its Client or the consultant can reach. A Client never sees a
 * Brouillon: to them it doesn't exist yet (NOT_FOUND), as for anyone else's.
 */
export async function invoiceFor(prisma: Db, session: CurrentSession, id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: invoiceFields });
  const consultant = isConsultant(session);
  if (!invoice || (!consultant && (invoice.dossier.accountId !== session.account.id || invoice.status === 'DRAFT'))) {
    throw new TRPCError({ code: 'NOT_FOUND' });
  }
  return invoice;
}
