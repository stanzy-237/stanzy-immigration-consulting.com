'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Check, FolderOpen, Pencil, Trash2, X, type LucideIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CrsProfile } from '@/features/crs/lib/compute-crs';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

/** A round icon-only button: `label` names it for screen readers, `tip` shows on hover. */
function IconButton({
  icon: Icon,
  label,
  tip,
  onClick,
  tone = 'neutral',
  type = 'button',
}: {
  icon: LucideIcon;
  label: string;
  tip: string;
  onClick?: () => void;
  tone?: 'neutral' | 'danger' | 'primary';
  type?: 'button' | 'submit';
}): ReactNode {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type={type}
            aria-label={label}
            onClick={onClick}
            className={cn(
              'inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rouge',
              tone === 'danger' && 'text-slate hover:bg-blush hover:text-rouge',
              tone === 'neutral' && 'text-slate hover:bg-ice-blue hover:text-navy-deep',
              tone === 'primary' && 'bg-navy-deep text-white hover:bg-navy-80',
            )}
          />
        }
      >
        <Icon aria-hidden={true} className="size-4" />
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

/** The signed-in Account's saved simulations: reopen, rename, delete. */
export function SavedSimulations({ onOpen }: { onOpen: (profile: CrsProfile) => void }): ReactNode {
  const t = useTranslations('Crs.simulations');
  const format = useFormatter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: simulations } = useSuspenseQuery(trpc.crs.list.queryOptions());
  /** Refreshes the list and says it worked, or says it didn't. */
  const outcome = (done: string) => ({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: trpc.crs.list.queryKey() });
      toast.add({ title: done, type: 'success' });
    },
    onError: () => toast.add({ title: t('toast.failed'), type: 'error' }),
  });
  const remove = useMutation(trpc.crs.delete.mutationOptions(outcome(t('toast.deleted'))));
  const rename = useMutation(trpc.crs.rename.mutationOptions(outcome(t('toast.renamed'))));
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  const open = async (id: string): Promise<void> => {
    try {
      const simulation = await queryClient.fetchQuery(trpc.crs.get.queryOptions({ id }));
      onOpen(simulation.profile);
    } catch {
      toast.add({ title: t('toast.openFailed'), type: 'error' });
    }
  };

  return (
    <section aria-labelledby="crs-simulations-title" className="rounded-2xl border border-fog bg-white p-5 shadow-sm">
      <h2 id="crs-simulations-title" className="font-heading text-h4 font-bold text-navy-deep">
        {t('title')}
      </h2>

      {simulations.length === 0 ? (
        <p className="mt-2 text-body-sm text-slate">{t('empty')}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {simulations.map((simulation) => (
            <li
              key={simulation.id}
              className="rounded-xl border border-fog p-3 transition-colors hover:border-slate-mute"
            >
              {renaming?.id === simulation.id ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = renaming.name.trim();
                    if (name) rename.mutate({ id: renaming.id, name });
                    setRenaming(null);
                  }}
                >
                  <input
                    aria-label={t('renameLabel', { name: simulation.name })}
                    className="h-10 min-w-0 flex-1 rounded-lg border border-fog px-3 text-body-sm text-navy-deep outline-none focus-visible:border-rouge focus-visible:ring-2 focus-visible:ring-rouge/20"
                    value={renaming.name}
                    maxLength={80}
                    autoFocus
                    onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                  />
                  <IconButton icon={Check} type="submit" tone="primary" label={t('confirmRename')} tip={t('confirmRename')} />
                  <IconButton icon={X} label={t('cancelRename')} tip={t('cancelRename')} onClick={() => setRenaming(null)} />
                </form>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-semibold text-navy-deep">{simulation.name}</p>
                    <p className="mt-0.5 text-caption text-slate">
                      {format.dateTime(simulation.updatedAt, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </p>
                  </div>
                  <p className="shrink-0 text-right">
                    <span className="font-heading text-h4 font-bold text-rouge">{simulation.total}</span>
                    <span className="ml-1 text-caption text-slate">{t('points')}</span>
                  </p>
                  <div className="flex shrink-0 items-center">
                    <IconButton
                      icon={FolderOpen}
                      label={t('openLabel', { name: simulation.name })}
                      tip={t('open')}
                      onClick={() => void open(simulation.id)}
                    />
                    <IconButton
                      icon={Pencil}
                      label={t('renameAction', { name: simulation.name })}
                      tip={t('rename')}
                      onClick={() => setRenaming({ id: simulation.id, name: simulation.name })}
                    />
                    <IconButton
                      icon={Trash2}
                      tone="danger"
                      label={t('deleteLabel', { name: simulation.name })}
                      tip={t('delete')}
                      onClick={() => setDeleting({ id: simulation.id, name: simulation.name })}
                    />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next) setDeleting(null);
        }}
      >
        <AlertDialogContent className="gap-5 p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-h4 font-bold text-navy-deep">
              {t('deleteTitle', { name: deleting?.name ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-body-sm text-slate">{t('deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">{t('cancelDelete')}</AlertDialogCancel>
            <button
              type="button"
              className="rounded-full bg-rouge px-5 py-2 text-body-sm font-semibold text-white transition-colors hover:bg-crimson"
              onClick={() => {
                if (deleting) remove.mutate({ id: deleting.id });
                setDeleting(null);
              }}
            >
              {t('confirmDelete')}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/** « Mes simulations » before the list arrives. */
export function SavedSimulationsSkeleton(): ReactNode {
  const t = useTranslations('Crs.simulations');
  const tCommon = useTranslations('Common');
  return (
    <section aria-labelledby="crs-simulations-title" className="rounded-2xl border border-fog bg-white p-5 shadow-sm">
      <h2 id="crs-simulations-title" className="font-heading text-h4 font-bold text-navy-deep">
        {t('title')}
      </h2>
      <div role="status" className="mt-4 space-y-2">
        <span className="sr-only">{tCommon('loading')}</span>
        {[0, 1].map((row) => (
          <Skeleton key={row} aria-hidden={true} className="h-16 rounded-xl" />
        ))}
      </div>
    </section>
  );
}
