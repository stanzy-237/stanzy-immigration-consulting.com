'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { displayStatus, type DisplayStatus, type InvoiceStatus } from '@/features/invoices/lib/invoice-status';

const PILL: Record<DisplayStatus, string> = {
  DRAFT: 'bg-fog-light text-slate',
  SENT: 'bg-ice-blue text-navy-deep',
  OVERDUE: 'bg-blush text-crimson',
  PROOF_RECEIVED: 'bg-honey-tint text-navy-deep',
  PAID: 'bg-leaf-tint text-leaf',
  CANCELLED: 'bg-fog-light text-slate line-through',
};

/** A Facture's status as read today: En retard once a sent one is past its due day. */
export function InvoiceStatusPill({
  invoice,
}: {
  invoice: { status: InvoiceStatus; dueDate: Date | null };
}): ReactNode {
  const t = useTranslations('Invoices.status');
  const status = displayStatus(invoice, new Date());
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wider whitespace-nowrap uppercase ${PILL[status]}`}>
      {t(status)}
    </span>
  );
}
