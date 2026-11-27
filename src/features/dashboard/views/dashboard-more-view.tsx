'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import type { ReactNode } from 'react';

import { TAB_SEGMENTS } from '@/features/dashboard/components/dashboard-tab-bar';
import { DASHBOARD_GROUPS, DASHBOARD_SECTIONS, type DashboardSection } from '@/features/dashboard/data/sections';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

const ROW = 'flex h-12 items-center gap-3 px-4';

/**
 * « Plus » (`Tableau de bord · Mobile v2 · 6 Plus`): the sections without a
 * tab, grouped as in the sidebar, each with what waits in it; the public
 * site at the end.
 */
export function DashboardMoreView({ siteUrl }: { siteUrl: string }): ReactNode {
  const t = useTranslations('Dashboard');
  const trpc = useTRPC();
  const { data } = useQuery(trpc.overview.today.queryOptions());
  const badge = (key: DashboardSection['key']): { text: string; tone: 'navy' | 'rouge' | 'plain' } | null => {
    if (!data) return null;
    if (key === 'demandes' && data.toHandle.interests.count) return { text: String(data.toHandle.interests.count), tone: 'navy' };
    if (key === 'signalements' && data.toHandle.reports) return { text: String(data.toHandle.reports), tone: 'navy' };
    if (key === 'services-en-cours' && data.toHandle.orders.count) return { text: String(data.toHandle.orders.count), tone: 'navy' };
    if (key === 'signatures' && data.toHandle.signatures) return { text: String(data.toHandle.signatures), tone: 'plain' };
    if (key === 'factures' && data.toHandle.overdue.count) return { text: t('more.overdue', { count: data.toHandle.overdue.count }), tone: 'rouge' };
    if (key === 'codes-promo' && data.promo) return { text: data.promo.code, tone: 'plain' };
    return null;
  };
  const rest = DASHBOARD_SECTIONS.filter((s) => !(TAB_SEGMENTS as readonly (string | null)[]).includes(s.segment));
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-h3 leading-9 font-extrabold tracking-tight text-navy-deep">{t('tabs.more')}</h1>
      {DASHBOARD_GROUPS.map((group) => {
        const sections = rest.filter((s) => s.group === group);
        if (sections.length === 0) return null;
        return (
          <section key={group} aria-labelledby={`more-${group}`} className="flex flex-col gap-2">
            <h2 id={`more-${group}`} className="pl-1 font-label text-label font-bold tracking-wide text-slate uppercase">
              {t(`nav.groups.${group}`)}
            </h2>
            <ul className="flex flex-col divide-y divide-fog-light overflow-hidden rounded-2xl border border-fog-light bg-white">
              {sections.map((section) => {
                const b = badge(section.key);
                return (
                  <li key={section.key}>
                    <Link href={section.href} className={cn(ROW, 'hover:bg-off-white')}>
                      <section.icon aria-hidden={true} className="size-4.5 shrink-0 text-navy-deep" strokeWidth={2} />
                      <span className="min-w-0 flex-1 truncate text-body text-ink">{t(`nav.${section.key}`)}</span>
                      {b ? (
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-caption font-bold',
                            b.tone === 'rouge' ? 'bg-blush text-rouge' : b.tone === 'navy' ? 'bg-navy-deep text-white' : 'text-slate',
                          )}
                        >
                          {b.text}
                        </span>
                      ) : null}
                      <ChevronRight aria-hidden={true} className="size-4 shrink-0 text-slate-mute" strokeWidth={2.4} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <a href={siteUrl} className={cn(ROW, 'rounded-2xl border border-fog-light bg-white text-body text-ink')}>
        <span className="flex-1">{t('viewSite')}</span>
        <ArrowUpRight aria-hidden={true} className="size-4 text-slate-mute" strokeWidth={2.4} />
      </a>
    </div>
  );
}
