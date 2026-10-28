'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BudgetEstimator } from '@/features/budget/components/budget-estimator';
import { ExpenseJournal } from '@/features/budget/components/expense-journal';

/** Each tab has a URL hash, so a link can open « Mes dépenses » directly. */
type Tab = 'estimer' | 'depenses';

const tabOfHash = (hash: string): Tab => (hash === '#depenses' ? 'depenses' : 'estimer');

// Phones: tighter padding and text, so « Estimer mon budget » fits half the frame.
// Hover turns an inactive tab's text red; the active one stays white on navy.
const trigger =
  'h-11 min-w-0 flex-1 rounded-full px-3 font-heading text-xs font-bold text-slate transition-colors hover:text-rouge data-active:bg-navy-deep data-active:text-white data-active:hover:text-white sm:flex-none sm:px-5 sm:text-sm';

/** « Estimer mon budget » / « Mes dépenses ». */
export function BudgetTabs(): ReactNode {
  const t = useTranslations('Budget.tabs');
  const [tab, setTab] = useState<Tab>('estimer');

  // The hash only exists in the browser; read it once mounted.
  useEffect(() => {
    const sync = () => setTab(tabOfHash(window.location.hash));
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const choose = (value: unknown) => {
    const next = tabOfHash(`#${String(value)}`);
    setTab(next);
    window.history.replaceState(null, '', `#${next}`);
  };

  return (
    <Tabs value={tab} onValueChange={choose} className="mx-auto max-w-7xl gap-6 px-5 pb-20 sm:px-10">
      <TabsList
        aria-label={t('label')}
        // group-data-horizontal/tabs:h-auto beats the list's default h-8, which
        // left the 44px tabs sticking out of the frame.
        className="mx-auto h-auto w-full gap-1 rounded-full border-2 border-fog-light bg-white p-1 group-data-horizontal/tabs:h-auto sm:w-auto"
      >
        <TabsTrigger value="estimer" className={trigger}>
          {t('estimate')}
        </TabsTrigger>
        <TabsTrigger value="depenses" className={trigger}>
          {t('expenses')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="estimer">
        <BudgetEstimator />
      </TabsContent>
      <TabsContent value="depenses">
        <ExpenseJournal />
      </TabsContent>
    </Tabs>
  );
}
