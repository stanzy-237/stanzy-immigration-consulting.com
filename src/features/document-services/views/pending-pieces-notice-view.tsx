'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowRight, FileStack } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { textIn } from '@/features/document-services/lib/service-schema';
import { Link } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';

/**
 * At the top of « Mon espace » and of the Client's Dossiers: the Services
 * documentaires still waiting for their Pièces à remettre (« Vous n'avez pas
 * encore envoyé les pièces nécessaires pour la preuve de fonds et
 * l'attestation CNPS »), leading to « Mes services en cours ». Nothing while
 * it loads or when nothing waits.
 */
export function PendingPiecesNoticeView(): ReactNode {
  return (
    <QueryBoundary fallback={null}>
      <Notice />
    </QueryBoundary>
  );
}

function Notice(): ReactNode {
  const t = useTranslations('DocumentServices.pending');
  const locale = useLocale();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.documentServices.requirements.mine.queryOptions());
  const waiting = data.filter((request) => request.hasRequirements && request.handOver === 'OPEN' && request.service);
  if (waiting.length === 0) return null;
  const names = new Intl.ListFormat(locale, { type: 'conjunction' }).format(
    [...new Set(waiting.map((request) => textIn(request.service!.name, locale)))],
  );
  return (
    <aside
      aria-label={t('label')}
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-rose bg-blush px-5 py-4 shadow-sm"
    >
      <p className="flex items-start gap-3 text-sm font-semibold text-navy-deep">
        <FileStack aria-hidden={true} className="mt-0.5 size-5 shrink-0 text-rouge" />
        <span>{t('text', { services: names })}</span>
      </p>
      <Link
        href="/mon-espace/services#en-cours"
        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-rouge px-4 text-sm font-semibold text-white hover:bg-crimson"
      >
        {t('link')}
        <ArrowRight aria-hidden={true} className="size-4" />
      </Link>
    </aside>
  );
}
