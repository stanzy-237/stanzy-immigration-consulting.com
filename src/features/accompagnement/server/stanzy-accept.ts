import { TRPCError } from '@trpc/server';

import { sendServiceContract } from '@/features/contracts/server/contracts-router';
import { textIn } from '@/features/document-services/lib/service-schema';
import type { DossierRow } from '@/features/dossiers/server/dossier-access';
import { addDraftInvoiceLine } from '@/features/invoices/server/draft-lines';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';

const refuse = (message: string): TRPCError => new TRPCError({ code: 'BAD_REQUEST', message });

/**
 * The consultant takes a « Stanzy s'en charge » request on: the service's
 * own Contrat goes to the Client to sign (in `locale`, at `amount` with its
 * échéancier), and a line for it joins the Dossier's draft invoice. From the
 * Dossier's request, or on approving a service's order (#80).
 */
export async function acceptStanzyRequest(
  ctx: { prisma: TRPCContext['prisma']; session: CurrentSession; headers: Headers },
  dossier: DossierRow,
  request: {
    id: string;
    status: string;
    document: { title: string };
    service: { name: unknown; contractTitle: unknown; contractBody: unknown } | null;
  },
  input: { locale: 'fr' | 'en'; amount: number; schedule: string },
) {
  if (request.status !== 'REQUESTED') throw refuse('STANZY_NOT_PENDING');
  if (!request.service) throw refuse('STANZY_NO_SERVICE');
  const serviceName = textIn(request.service.name, input.locale);
  const contract = await sendServiceContract(ctx, dossier, {
    stanzyRequestId: request.id,
    locale: input.locale,
    template: {
      title: textIn(request.service.contractTitle, input.locale),
      body: textIn(request.service.contractBody, input.locale),
    },
    serviceName,
    amount: input.amount,
    currency: 'XAF',
    schedule: input.schedule,
  });
  const { invoiceId } = await ctx.prisma.$transaction(async (tx) => {
    const { count } = await tx.stanzyRequest.updateMany({
      where: { id: request.id, status: 'REQUESTED' },
      data: { status: 'ACCEPTED', decidedAt: new Date() },
    });
    if (count === 0) throw refuse('STANZY_NOT_PENDING');
    return addDraftInvoiceLine(tx, dossier.id, {
      description: `${serviceName} – ${request.document.title}`,
      quantity: 1,
      unitAmount: input.amount,
    });
  });
  return { contract, invoiceId };
}
