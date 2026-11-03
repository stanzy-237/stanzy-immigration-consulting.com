'use client';

import { useTranslations } from 'next-intl';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { usePdfPages } from '@/features/signatures/hooks/use-pdf-pages';

/**
 * A PDF's pages one under the other, as the Client reads it before signing
 * and as the consultant places the fields. `overlay(index)` draws over each
 * page (positioned in fractions of it); `onPlace(index, x, y)` receives a
 * tap on a page, in fractions from its top left (Enter places at its centre).
 */
export function PdfPages({
  url,
  overlay,
  onPlace,
  placeLabel,
}: {
  url: string;
  overlay?: (index: number) => ReactNode;
  onPlace?: (index: number, x: number, y: number) => void;
  /** What a tap does, read out on each page: « Placer Signature sur la page 2 ». */
  placeLabel?: (number: number) => string;
}): ReactNode {
  const t = useTranslations('Signatures');
  const { pages, total, failed } = usePdfPages(url);

  if (failed) {
    return <p className="rounded-xl bg-blush px-4 py-3 text-sm text-crimson">{t('new.pdfFailed')}</p>;
  }
  if (total === null) return <PdfPagesSkeleton />;

  const place = (index: number) => (event: MouseEvent<HTMLDivElement>) => {
    if (!onPlace || event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    onPlace(index, (event.clientX - box.left) / box.width, (event.clientY - box.top) / box.height);
  };
  const placeByKey = (index: number) => (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onPlace || event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onPlace(index, 0.5, 0.5);
  };

  return (
    <ol className="grid gap-6">
      {Array.from({ length: total }, (_, index) => {
        const page = pages[index];
        return (
          <li key={index}>
            <p className="mb-1.5 text-xs font-semibold text-slate">{t('new.place.page', { number: index + 1 })}</p>
            {page ? (
              <div
                className="relative w-full overflow-hidden rounded-lg bg-white shadow-md ring-1 ring-fog-light"
                style={{ aspectRatio: `${page.width} / ${page.height}` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a page drawn in the browser, as a data URL */}
                <img src={page.src} alt="" className="pointer-events-none absolute inset-0 size-full select-none" />
                <div
                  className={
                    onPlace
                      ? 'absolute inset-0 cursor-crosshair focus-visible:outline-2 focus-visible:outline-navy-deep'
                      : 'absolute inset-0'
                  }
                  role={onPlace ? 'button' : undefined}
                  tabIndex={onPlace ? 0 : undefined}
                  aria-label={onPlace && placeLabel ? placeLabel(index + 1) : undefined}
                  onClick={place(index)}
                  onKeyDown={placeByKey(index)}
                >
                  {overlay?.(index)}
                </div>
              </div>
            ) : (
              <Skeleton aria-hidden={true} className="aspect-3/4 w-full rounded-lg" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function PdfPagesSkeleton(): ReactNode {
  const t = useTranslations('Signatures.new');
  return (
    <div role="status" className="grid gap-6">
      <span className="sr-only">{t('loadingPdf')}</span>
      <Skeleton aria-hidden={true} className="aspect-3/4 w-full rounded-lg" />
    </div>
  );
}

/** Where a field sits over its page, in fractions of it. */
export const fieldStyle = (field: { x: number; y: number; width: number; height: number }) => ({
  left: `${field.x * 100}%`,
  top: `${field.y * 100}%`,
  width: `${field.width * 100}%`,
  height: `${field.height * 100}%`,
});
