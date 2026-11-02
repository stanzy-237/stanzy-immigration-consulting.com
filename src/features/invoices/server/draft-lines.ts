import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

/**
 * Adds a line to the Dossier's Brouillon, opening one in XAF if it has none,
 * for code that bills on its own (an accepted « Stanzy s'en charge », #81;
 * a document order, #80). The consultant reviews it before sending (#79).
 */
export async function addDraftInvoiceLine(
  tx: Tx,
  dossierId: string,
  line: { description: string; quantity: number; unitAmount: number },
): Promise<{ invoiceId: string }> {
  const draft =
    (await tx.invoice.findFirst({
      where: { dossierId, status: 'DRAFT' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })) ?? (await tx.invoice.create({ data: { dossierId }, select: { id: true } }));
  const position = await tx.invoiceLine.count({ where: { invoiceId: draft.id } });
  await tx.invoiceLine.create({ data: { invoiceId: draft.id, position, ...line } });
  return { invoiceId: draft.id };
}
