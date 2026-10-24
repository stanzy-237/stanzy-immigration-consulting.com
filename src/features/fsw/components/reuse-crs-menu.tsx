'use client';

import { ChevronDown, FilePenLine, History } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentAccount } from '@/features/auth/hooks/use-current-account';
import { useCrsDraftValue } from '@/features/crs/hooks/use-crs-draft';
import { fromProfile, type CrsForm } from '@/features/crs/lib/crs-form';
import { api } from '@/trpc/react';

/**
 * « Reprendre une simulation CRS »: a dropdown of the CRS answers in progress
 * on this device and, when signed in, every saved CRS simulation (name,
 * score, date). Picking one hands its answers to `onPick`. Renders nothing
 * when there is nothing to reuse.
 */
export function ReuseCrsMenu({ onPick }: { onPick: (answers: CrsForm) => void }): ReactNode {
  const t = useTranslations('Fsw.reuse');
  const format = useFormatter();
  const { account } = useCurrentAccount();
  const draft = useCrsDraftValue();
  const utils = api.useUtils();
  const { data: simulations = [] } = api.crs.list.useQuery(undefined, { enabled: account !== null });

  if (!draft && simulations.length === 0) return null;

  const pickSaved = async (id: string): Promise<void> => {
    const simulation = await utils.crs.get.fetch({ id });
    onPick(fromProfile(simulation.profile));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-full border border-fog bg-white px-4 py-2 text-body-sm font-semibold text-navy-deep transition-colors hover:bg-ice-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rouge">
        <History aria-hidden={true} className="size-4 text-rouge" />
        {t('trigger')}
        <ChevronDown aria-hidden={true} className="size-4 text-slate" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {draft ? (
          <DropdownMenuItem onClick={() => onPick(draft)} className="gap-3 py-2">
            <FilePenLine aria-hidden={true} className="size-4 text-steel-blue" />
            <span className="text-body-sm font-semibold text-navy-deep">{t('inProgress')}</span>
          </DropdownMenuItem>
        ) : null}
        {draft && simulations.length > 0 ? <DropdownMenuSeparator /> : null}
        {simulations.length > 0 ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-label text-slate">{t('saved')}</DropdownMenuLabel>
            {simulations.map((simulation) => (
              <DropdownMenuItem
                key={simulation.id}
                onClick={() => void pickSaved(simulation.id)}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-body-sm font-semibold text-navy-deep">{simulation.name}</span>
                  <span className="block text-caption text-slate">
                    {format.dateTime(simulation.updatedAt, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                </span>
                <span className="shrink-0 font-heading text-body-sm font-bold text-rouge">
                  {t('points', { points: simulation.total })}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
