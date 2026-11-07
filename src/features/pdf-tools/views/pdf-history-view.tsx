'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, ExternalLink, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { HISTORY_DAYS } from '@/features/pdf-tools/lib/history-schema';
import { optimisticList } from '@/lib/optimistic-list';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type HistoryFile = RouterOutputs['pdfTools']['history']['list'][number];

const fileUrl = (id: string) => `/api/pdf-tools/files/${id}`;

/** « Historique » of the Outils PDF (#79): every PDF downloaded these last 90 days, newest first. */
export function PdfHistoryView(): ReactNode {
  const t = useTranslations('PdfTools.history');
  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/outils-pdf"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate hover:text-navy-deep"
      >
        <ArrowLeft aria-hidden={true} className="size-4" />
        {t('back')}
      </Link>
      <h1 className="font-heading text-3xl font-bold text-navy-deep">{t('title')}</h1>
      <p className="mt-1 mb-6 text-sm text-slate">{t('intro', { days: HISTORY_DAYS })}</p>
      <QueryBoundary fallback={<HistorySkeleton />}>
        <HistoryList />
      </QueryBoundary>
    </div>
  );
}

function HistoryList(): ReactNode {
  const t = useTranslations('PdfTools');
  const format = useFormatter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: files } = useSuspenseQuery(trpc.pdfTools.history.list.queryOptions());
  const [deleting, setDeleting] = useState<HistoryFile | null>(null);
  const remove = useMutation(
    trpc.pdfTools.history.delete.mutationOptions(
      optimisticList<HistoryFile, { id: string }>(queryClient, trpc.pdfTools.history.list.queryKey(), (list, input) =>
        list.filter((file) => file.id !== input.id),
      ),
    ),
  );
  const mo = (bytes: number) => t('size', { size: format.number(bytes / 1024 / 1024, { maximumFractionDigits: 1 }) });

  if (files.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-fog-light bg-white px-6 py-12 text-center text-slate">
        {t('history.empty')}
      </p>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-3">
        {files.map((file) => (
          <li key={file.id} className="rounded-2xl border border-fog-light bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-navy-deep">{file.name}</p>
                <p className="text-sm text-slate">
                  {format.dateTime(file.createdAt, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' · '}
                  {t('pageCount', { count: file.pageCount })} · {mo(file.size)}
                </p>
                {file.sourceNames.length > 0 ? (
                  <p className="mt-0.5 truncate text-xs text-slate-mute">
                    {t('history.from', { names: file.sourceNames.join(', ') })}
                  </p>
                ) : null}
                <ul aria-label={t('history.changes')} className="mt-2 flex flex-wrap gap-1.5">
                  {file.changes.map((change) => (
                    <li
                      key={change}
                      className="rounded-full bg-ice-blue px-2.5 py-0.5 text-xs font-semibold text-navy-deep"
                    >
                      {change === 'compressed' && file.quality !== null
                        ? t('history.change.compressedAt', { quality: Math.round(file.quality * 100) })
                        : t(`history.change.${change}` as never)}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={fileUrl(file.id)}
                  target="_blank"
                  rel="noopener"
                  aria-label={t('history.openLabel', { name: file.name })}
                  className="inline-flex size-10 items-center justify-center rounded-full text-navy-deep hover:bg-off-white"
                >
                  <ExternalLink aria-hidden={true} className="size-4" />
                </a>
                <a
                  href={`${fileUrl(file.id)}?download`}
                  aria-label={t('history.downloadLabel', { name: file.name })}
                  className="inline-flex size-10 items-center justify-center rounded-full text-navy-deep hover:bg-off-white"
                >
                  <Download aria-hidden={true} className="size-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setDeleting(file)}
                  aria-label={t('history.deleteLabel', { name: file.name })}
                  className="inline-flex size-10 items-center justify-center rounded-full text-slate hover:bg-off-white hover:text-rouge"
                >
                  <Trash2 aria-hidden={true} className="size-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent className="gap-5 p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">
              {t('history.deleteTitle', { name: deleting?.name ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate">{t('history.deleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">{t('cancel')}</AlertDialogCancel>
            <button
              type="button"
              onClick={() => {
                if (deleting) {
                  remove.mutate(
                    { id: deleting.id },
                    {
                      onSuccess: () => toast.add({ title: t('history.deleted'), type: 'deleted' }),
                      onError: () => toast.add({ title: t('errors.failed'), type: 'error' }),
                    },
                  );
                }
                setDeleting(null);
              }}
              className="rounded-full bg-rouge px-5 py-2 text-sm font-semibold text-white hover:bg-crimson"
            >
              {t('history.delete')}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function HistorySkeleton(): ReactNode {
  const t = useTranslations('PdfTools.history');
  return (
    <div role="status">
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden={true} className="grid grid-cols-1 gap-3">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-24 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
