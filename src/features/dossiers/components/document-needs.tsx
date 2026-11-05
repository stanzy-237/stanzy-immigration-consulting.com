'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, HandHelping } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { toast } from '@/components/ui/toast';
import { helpFor } from '@/features/accompagnement/lib/interest-schema';
import { smallButton, type DocumentData, type Viewer } from '@/features/dossiers/components/document-styles';
import { TCF_ACADEMY_URL } from '@/features/shared/data/links';
import { Link } from '@/i18n/navigation';
import { inLanguage } from '@/features/dossiers/lib/documents-cache';
import { useTRPC } from '@/trpc/client';

/** « Manquant » while the Client said they don't have it and no Version came. */
const isMissing = (document: DocumentData) => document.missing && document.versions.length === 0;

/** Beside a Document's name: ★ Obligatoire or Recommandé, « Manquant », and where a Stanzy request stands (#81). */
export function NeedBadges({ document }: { document: DocumentData }): ReactNode {
  const t = useTranslations('Accompagnement');
  const request = document.stanzyRequests[0];
  return (
    <>
      {document.need ? (
        <span
          className={
            document.need === 'mandatory'
              ? 'shrink-0 rounded-full bg-blush px-2 py-0.5 text-xs font-semibold text-crimson'
              : 'shrink-0 rounded-full bg-off-white px-2 py-0.5 text-xs font-semibold text-slate'
          }
        >
          {document.need === 'mandatory' ? t('document.mandatory') : t('document.recommended')}
        </span>
      ) : null}
      {isMissing(document) ? (
        <span className="shrink-0 rounded-full bg-honey-tint px-2 py-0.5 text-xs font-semibold text-honey">
          {t('document.missing')}
        </span>
      ) : null}
      {request && request.status !== 'DECLINED' ? (
        <span className="shrink-0 rounded-full bg-ice-blue px-2 py-0.5 text-xs font-semibold text-navy-deep">
          {t(`stanzy.status.${request.status}`)}
        </span>
      ) : null}
    </>
  );
}

/**
 * Inside a Document made from the Demande d'intérêt: the Client's note, where
 * to get a missing one (the TCF academy, the EDE service), and for a Client
 * in Cameroon « Stanzy s'en charge ».
 */
export function DocumentNeeds({
  dossierId,
  document,
  viewer,
  open,
}: {
  dossierId: string;
  document: DocumentData;
  viewer: Viewer;
  open: boolean;
}): ReactNode {
  const t = useTranslations('Accompagnement');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const locale = useLocale();
  const { data } = useQuery({ ...trpc.dossiers.documents.sections.queryOptions({ dossierId }), select: inLanguage(locale) });
  const client = viewer === 'client';
  const missing = isMissing(document);
  const help = missing && client ? helpFor(document.kind) : null;
  const request = document.stanzyRequests[0];
  const canAsk = client && open && Boolean(data?.stanzy) && missing && (!request || request.status === 'DECLINED');
  const ask = useMutation(
    trpc.accompagnement.stanzy.request.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.dossiers.documents.sections.queryKey({ dossierId }) });
        toast.add({ title: t('toast.stanzyAsked'), type: 'success' });
      },
      onError: (error) => {
        const known = t.has(`errors.${error.message}`);
        toast.add({ title: t(known ? `errors.${error.message}` : 'errors.UNKNOWN'), type: known ? 'warning' : 'error' });
      },
    }),
  );

  if (!document.clientNote && !help && !canAsk && request?.status !== 'DECLINED') return null;
  return (
    <div className="grid gap-2 rounded-lg bg-off-white px-3 py-2.5 text-sm">
      {document.clientNote ? (
        <p className="text-navy-deep">
          {client ? t('document.yourNote', { note: document.clientNote }) : t('document.clientNote', { note: document.clientNote })}
        </p>
      ) : null}
      {request?.status === 'DECLINED' ? (
        <p className="text-slate">
          {t('stanzy.status.DECLINED')}
          {request.declineNote ? ` · ${request.declineNote}` : ''}
        </p>
      ) : null}
      {help || canAsk ? (
        <div className="flex flex-wrap items-center gap-2">
          {help === 'tcf' ? (
            <a
              href={TCF_ACADEMY_URL}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 font-semibold text-rouge hover:text-crimson"
            >
              {t('document.tcf')}
              <ExternalLink aria-hidden={true} className="size-3.5" />
            </a>
          ) : help === 'ede' ? (
            <Link href="/services/ede" className="font-semibold text-rouge hover:text-crimson">
              {t('document.ede')}
            </Link>
          ) : null}
          {canAsk ? (
            <button
              type="button"
              disabled={ask.isPending}
              onClick={() => ask.mutate({ documentId: document.id })}
              aria-label={t('stanzy.askLabel', { document: document.title })}
              aria-describedby={`${document.id}-stanzy-hint`}
              className={`${smallButton} h-9 border border-navy-deep text-navy-deep hover:bg-navy-deep hover:text-white`}
            >
              <HandHelping aria-hidden={true} className="size-4" />
              {t('stanzy.ask')}
            </button>
          ) : null}
          {canAsk ? (
            <span id={`${document.id}-stanzy-hint`} className="text-xs text-slate">
              {t('stanzy.askHint')}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
