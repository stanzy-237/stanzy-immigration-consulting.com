export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PROOF_RECEIVED' | 'PAID' | 'CANCELLED';

/**
 * What the consultant and the Client read. En retard is never stored: it is
 * a sent invoice once its due day is over. With a Preuve de paiement it stays
 * « Preuve reçue »: the Client has done their part.
 */
export type DisplayStatus = InvoiceStatus | 'OVERDUE';

const DAY = 24 * 60 * 60 * 1000;

export function displayStatus(invoice: { status: InvoiceStatus; dueDate: Date | null }, now: Date): DisplayStatus {
  if (invoice.status === 'SENT' && invoice.dueDate && invoice.dueDate.getTime() + DAY <= now.getTime())
    return 'OVERDUE';
  return invoice.status;
}

/** STZ-2026-0007 */
export const invoiceNumber = (year: number, sequence: number): string =>
  `STZ-${year}-${String(sequence).padStart(4, '0')}`;

/** Statuses the Client can still pay: a Preuve de paiement can be added, the consultant can mark it Payée or cancel it. */
export const isAwaitingPayment = (status: InvoiceStatus): boolean => status === 'SENT' || status === 'PROOF_RECEIVED';
