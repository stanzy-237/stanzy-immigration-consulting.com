'use client';

import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import type { ReactNode } from 'react';

import { exportUrl } from '@/features/finances/lib/finance-urls';

export const FINANCE_PAGES = [
  { key: 'overview', href: '/finances' },
  { key: 'incomes', href: '/finances/recettes' },
  { key: 'charges', href: '/finances/charges' },
  { key: 'settings', href: '/finances/reglages' },
] as const;
export type FinancePage = (typeof FINANCE_PAGES)[number]['key'];

/** Finances' title, its four pages as tabs, and the year shown (kept across them as `?annee=`). */
export function FinancesHeader({ page, year }: { page: FinancePage; year: number }): ReactNode {
  const t = useTranslations('Finances');
  const locale = useLocale();
  const at = (href: string, shown = year) => `${href}?annee=${shown}`;
  const current = FINANCE_PAGES.find((entry) => entry.key === page)!.href;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy-deep md:text-3xl">{t('title')}</h1>
          <p className="mt-1 text-sm text-slate">{t('intro')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-fog-light bg-white">
            <Link
              href={at(current, year - 1)}
              aria-label={t('year.previous')}
              className="inline-flex size-10 items-center justify-center rounded-full text-navy-deep hover:bg-off-white"
            >
              <ChevronLeft aria-hidden={true} className="size-4" />
            </Link>
            <span aria-label={t('year.label', { year })} className="px-1 text-sm font-semibold text-navy-deep tabular-nums">
              {year}
            </span>
            <Link
              href={at(current, year + 1)}
              aria-label={t('year.next')}
              className="inline-flex size-10 items-center justify-center rounded-full text-navy-deep hover:bg-off-white"
            >
              <ChevronRight aria-hidden={true} className="size-4" />
            </Link>
          </div>
          <a
            href={exportUrl(year, locale)}
            download={true}
            className="inline-flex h-10 items-center gap-2 rounded-full border-2 border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white"
          >
            <Download aria-hidden={true} className="size-4" />
            {t('export')}
          </a>
        </div>
      </div>
      <nav aria-label={t('nav.label')} className="flex gap-1 overflow-x-auto border-b border-fog-light">
        {FINANCE_PAGES.map((entry) => (
          <Link
            key={entry.key}
            href={at(entry.href)}
            aria-current={entry.key === page ? 'page' : undefined}
            className={
              entry.key === page
                ? '-mb-px border-b-2 border-rouge px-3 py-2.5 text-sm font-semibold whitespace-nowrap text-navy-deep'
                : '-mb-px border-b-2 border-transparent px-3 py-2.5 text-sm font-semibold whitespace-nowrap text-slate hover:text-navy-deep'
            }
          >
            {t(`nav.${entry.key}`)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
