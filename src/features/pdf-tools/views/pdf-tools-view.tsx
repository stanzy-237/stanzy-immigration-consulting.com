'use client';

import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { PdfWorkbench, type WorkbenchEngine } from '@/features/pdf-tools/components/pdf-workbench';
import { ACCEPTED, rasterizePdf, readSource, thumbnail } from '@/features/pdf-tools/lib/browser-pdf';

/** pdf.js in the consultant's browser: nothing is sent anywhere. */
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

/** « Outils PDF » on its own (#79): files from the computer in, a PDF downloaded out. */
export function PdfToolsView({ engine = browserEngine }: { engine?: WorkbenchEngine }): ReactNode {
  const t = useTranslations('PdfTools');
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-heading text-3xl font-bold text-navy-deep">{t('title')}</h1>
      <p className="mt-1 mb-6 text-sm text-slate">{t('intro')}</p>
      <PdfWorkbench
        engine={engine}
        finish={{
          label: t('download'),
          icon: Download,
          run: async (pdf) => downloadPdf(pdf, t('fileName')),
        }}
      />
    </div>
  );
}
