'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, History } from 'lucide-react';
import { useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import type { ReactNode } from 'react';

import { toast } from '@/components/ui/toast';
import { uploadEncryptedFile } from '@/features/dossiers/lib/upload-version';
import { PdfWorkbench, type OutputMeta, type WorkbenchEngine } from '@/features/pdf-tools/components/pdf-workbench';
import { ACCEPTED, rasterizePdf, readSource, thumbnail } from '@/features/pdf-tools/lib/browser-pdf';
import { useTRPC } from '@/trpc/client';

/** pdf.js in the consultant's browser. */
export const browserEngine: WorkbenchEngine = { accepted: ACCEPTED, readSource, thumbnail, rasterize: rasterizePdf };

/** Hands the browser a file to save. */
export function downloadPdf(pdf: Uint8Array, name: string): void {
  const url = URL.createObjectURL(new Blob([pdf.slice()], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Keeps a downloaded PDF in the history (#79): encrypted in the browser, sent
 * to the private R2 bucket, then recorded. Resolves when it's in.
 */
export function useSaveToHistory(upload: typeof uploadEncryptedFile = uploadEncryptedFile) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const add = useMutation(trpc.pdfTools.history.add.mutationOptions());
  return async (pdf: Uint8Array, meta: OutputMeta) => {
    const file = new File([pdf.slice()], meta.name, { type: 'application/pdf' });
    const stored = await upload(file, { uploadRoute: '/api/pdf-tools/upload', payload: {} });
    await add.mutateAsync({
      ...stored,
      contentType: 'application/pdf',
      pageCount: meta.pageCount,
      changes: meta.changes,
      quality: meta.quality,
      sourceNames: meta.sourceNames,
    });
    void queryClient.invalidateQueries({ queryKey: trpc.pdfTools.history.list.queryKey() });
  };
}

/** « Outils PDF » on its own (#79): files in, a PDF downloaded out, and a copy kept 90 days in the history. */
export function PdfToolsView({
  engine = browserEngine,
  upload,
}: {
  engine?: WorkbenchEngine;
  upload?: typeof uploadEncryptedFile;
}): ReactNode {
  const t = useTranslations('PdfTools');
  const save = useSaveToHistory(upload);
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-navy-deep">{t('title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate">{t('intro')}</p>
        </div>
        <Link
          href="/outils-pdf/historique"
          className="inline-flex h-11 items-center gap-1.5 rounded-full border-2 border-fog-light bg-white px-4 text-sm font-semibold text-navy-deep hover:border-navy-deep"
        >
          <History aria-hidden={true} className="size-4" />
          {t('history.link')}
        </Link>
      </div>
      <PdfWorkbench
        engine={engine}
        finish={{
          label: t('download'),
          icon: Download,
          run: async (pdf, meta) => {
            downloadPdf(pdf, meta.name);
            // The download never waits on the copy; a failed copy only says so.
            try {
              await save(pdf, meta);
              toast.add({ title: t('history.saved'), type: 'success' });
            } catch {
              toast.add({ title: t('history.saveFailed'), type: 'warning' });
            }
          },
        }}
      />
    </div>
  );
}
