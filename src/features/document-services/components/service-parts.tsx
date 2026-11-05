'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { contractBlocks } from '@/features/contracts/lib/contract-schema';
import { PERCENT_MAX, textIn } from '@/features/document-services/lib/service-schema';
import { formatMoney } from '@/features/invoices/lib/money';

/** « 25 000 FCFA par pays et par personne », or « 2,5 % du montant à justifier ». */
export function ServicePrice({
  service,
  className,
}: {
  service: { priceKind: 'FIXED' | 'PERCENT'; price: number; unit: unknown };
  className?: string;
}): ReactNode {
  const locale = useLocale();
  const format = useFormatter();
  const amount =
    service.priceKind === 'FIXED'
      ? formatMoney(service.price, 'XAF', locale)
      : format.number(service.price / PERCENT_MAX, { style: 'percent', maximumFractionDigits: 2 });
  const unit = textIn(service.unit, locale);
  return (
    <p className={className}>
      <span className="font-heading text-2xl font-bold text-navy-deep">{amount}</span>
      {unit ? <span className="ml-1.5 text-sm text-slate">{unit}</span> : null}
    </p>
  );
}

/** A service's contract as the Client will sign it, its blanks shown as what fills them. */
export function ContractText({ body }: { body: string }): ReactNode {
  const t = useTranslations('DocumentServices.blanks');
  const shown = body.replace(/\{(client|service|prix|echeancier|date|numero)\}/g, (_, name: string) => `[${t(name)}]`);
  return (
    <div className="grid gap-3 text-sm leading-relaxed text-navy-deep">
      {contractBlocks(shown).map((block, index) =>
        block.kind === 'heading' ? (
          <h3 key={index} className="pt-2 font-heading text-base font-bold">
            {block.text}
          </h3>
        ) : block.kind === 'bullet' ? (
          <p key={index} className="flex gap-2 pl-2">
            <span aria-hidden={true}>•</span>
            {block.text}
          </p>
        ) : (
          <p key={index} className="whitespace-pre-line">
            {block.text}
          </p>
        ),
      )}
    </div>
  );
}
