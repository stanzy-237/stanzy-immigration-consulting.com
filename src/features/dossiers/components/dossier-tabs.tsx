'use client';

import { FileText, LayoutDashboard, MessageSquare, Receipt, Video, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const DOSSIER_TABS = ['apercu', 'documents', 'messages', 'reunions', 'facturation'] as const;
export type DossierTab = (typeof DOSSIER_TABS)[number];

const TAB_ICON: Record<DossierTab, LucideIcon> = {
  apercu: LayoutDashboard,
  documents: FileText,
  messages: MessageSquare,
  reunions: Video,
  facturation: Receipt,
};

/** The anchors emails and Notifications link to (`#messages`…), and the tab each lives in. */
const ANCHOR_TAB: Record<string, DossierTab> = {
  etapes: 'apercu',
  documents: 'documents',
  stanzy: 'documents',
  messages: 'messages',
  reunions: 'reunions',
  factures: 'facturation',
  contrats: 'facturation',
  finances: 'facturation',
};

const isTab = (value: string | null): value is DossierTab => (DOSSIER_TABS as readonly string[]).includes(value ?? '');

/**
 * The tab a Dossier opens on: `?onglet=`, else a Document a link points to
 * (`?document=`), else the anchor (`#messages`), else « Aperçu ».
 */
export function tabFrom(search: URLSearchParams, hash: string): DossierTab {
  const asked = search.get('onglet');
  if (isTab(asked)) return asked;
  if (search.has('document')) return 'documents';
  return ANCHOR_TAB[hash.replace(/^#/, '')] ?? 'apercu';
}

/**
 * A Dossier's tabs, the same for the consultant and the Client: one subject
 * at a time instead of the whole Dossier on one page. The tab is kept in the
 * address (`?onglet=`), and the anchors older links use still land on the
 * right tab and section. `counts` adds what is waiting next to a tab's name.
 * The five tabs always fit the width (icon over the name on a phone), so
 * the active one's underline is never scrolled out of sight.
 */
export function DossierTabs({
  panels,
  counts = {},
}: {
  panels: Record<DossierTab, ReactNode>;
  counts?: Partial<Record<DossierTab, { value: number; label: string }>>;
}): ReactNode {
  const t = useTranslations('Dossiers.tabs');
  const search = useSearchParams();
  const [tab, setTab] = useState<DossierTab>(() => tabFrom(search, ''));

  // The anchor is only known in the browser: follow it once loaded, and on each change.
  useEffect(() => {
    const follow = () => {
      const anchor = window.location.hash.replace(/^#/, '');
      if (!anchor) return;
      setTab(tabFrom(new URLSearchParams(window.location.search), window.location.hash));
      requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }));
    };
    follow();
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, []);

  const choose = (next: DossierTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set('onglet', next);
    url.hash = '';
    window.history.replaceState(window.history.state, '', url);
  };

  return (
    <Tabs value={tab} onValueChange={(value) => choose(value as DossierTab)} className="gap-6">
      <TabsList
        variant="line"
        aria-label={t('label')}
        className="w-full justify-start gap-0 border-b border-fog-light group-data-horizontal/tabs:h-auto"
      >
        {DOSSIER_TABS.map((key) => {
          const count = counts[key];
          const Icon = TAB_ICON[key];
          return (
            <TabsTrigger
              key={key}
              value={key}
              className="h-14 min-w-0 flex-1 flex-col gap-1 rounded-none px-1 text-xs font-semibold text-slate hover:text-navy-deep data-active:text-navy-deep group-data-horizontal/tabs:after:bottom-0 after:bg-rouge sm:h-11 sm:flex-none sm:flex-row sm:gap-2 sm:px-4 sm:text-sm"
            >
              <Icon aria-hidden={true} className="size-5 sm:size-4" />
              <span className="max-w-full truncate">{t(key)}</span>
              {count && count.value > 0 ? (
                <span className="absolute top-1 left-1/2 ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-rouge px-1.5 text-xs font-bold text-white sm:static sm:ml-0">
                  {count.value}
                  <span className="sr-only"> {count.label}</span>
                </span>
              ) : null}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {DOSSIER_TABS.map((key) => (
        <TabsContent key={key} value={key} className="grid gap-10">
          {panels[key]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
