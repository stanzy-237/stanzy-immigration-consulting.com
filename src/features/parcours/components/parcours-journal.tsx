'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
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
import { AorCounter } from '@/features/parcours/components/aor-counter';
import { EtapeFeed } from '@/features/parcours/components/etape-feed';
import { EtapeForm } from '@/features/parcours/components/etape-form';
import { EtapeDrawer } from '@/features/parcours/components/etape-drawer';
import { ParcoursShareView } from '@/features/parcours/components/parcours-share-view';
import { MAX_ETAPES } from '@/features/parcours/data/etapes';
import { sortByDate } from '@/features/parcours/lib/calendar-day';
import type { Etape, EtapeInput } from '@/features/parcours/lib/etape-schema';
import { isOptimistic, optimisticId, optimisticList } from '@/lib/optimistic-list';
import { useTRPC } from '@/trpc/client';

/** Below `lg` the form lives in a drawer instead of the sidebar. */
const isPhone = () => window.matchMedia('(max-width: 1023px)').matches;

/** The navy hero: eyebrow, title, lead, and whatever the page adds under them. */
function ParcoursHero({ children }: { children?: ReactNode }): ReactNode {
  const t = useTranslations('Parcours');
  return (
    <header className="bg-linear-135 from-navy-deep to-navy-80 text-white">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-10">
        <p className="inline-flex rounded-full border border-rouge/35 bg-rouge/15 px-3 py-1.5 font-label uppercase tracking-widest text-rose">
          {t('eyebrow')}
        </p>
        <h1 className="mt-4 mb-2.5 font-heading text-h2 font-bold leading-none tracking-tight">{t('title')}</h1>
        <p className="max-w-xl text-body text-white/60">{t('lead')}</p>
        {children}
      </div>
    </header>
  );
}

/** The page before the Étapes arrive: the hero, then the feed and the form as blocks. */
export function ParcoursJournalSkeleton(): ReactNode {
  const t = useTranslations('Common');
  return (
    <main className="bg-off-white">
      <ParcoursHero />
      <div role="status" className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-8 px-5 pt-6 pb-24 sm:px-10 lg:grid-cols-3 lg:py-8">
        <span className="sr-only">{t('loading')}</span>
        <div aria-hidden={true} className="flex flex-col gap-4 lg:col-span-2">
          <Skeleton className="h-24 rounded-2xl" />
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton aria-hidden={true} className="hidden h-96 rounded-2xl lg:block" />
      </div>
    </main>
  );
}

/** The Parcours itself: hero, feed of Étapes, and the add/edit form. The route prefetches its Étapes. */
export function ParcoursJournal(): ReactNode {
  const t = useTranslations('Parcours');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(trpc.parcours.list.queryOptions());
  const etapes = sortByDate(data);
  // Optimistic: the feed changes on the tap; a refusal puts it back (and says so in a toast).
  const listKey = trpc.parcours.list.queryKey();
  const asEtape = (input: EtapeInput, id: string): Etape => ({ id, ...input, code: input.code ?? '', note: input.note ?? '' });
  const add = useMutation(
    trpc.parcours.add.mutationOptions(
      optimisticList<Etape, EtapeInput>(queryClient, listKey, (list, input) => [...list, asEtape(input, optimisticId())]),
    ),
  );
  const update = useMutation(
    trpc.parcours.update.mutationOptions(
      optimisticList<Etape, EtapeInput & { id: string }>(queryClient, listKey, (list, { id, ...input }) =>
        list.map((etape) => (etape.id === id ? asEtape(input, id) : etape)),
      ),
    ),
  );
  const remove = useMutation(
    trpc.parcours.delete.mutationOptions(
      optimisticList<Etape, { id: string }>(queryClient, listKey, (list, { id }) => list.filter((etape) => etape.id !== id)),
    ),
  );

  /** The Étape open in the form, or null when the form adds a new one. */
  const [editing, setEditing] = useState<Etape | null>(null);
  // Remounting the form clears it once an Étape is saved.
  const [formKey, setFormKey] = useState(0);
  /** Why the last save failed; the form keeps its draft. */
  const [failure, setFailure] = useState<string>();
  const [deleting, setDeleting] = useState<Etape | null>(null);
  const [sharing, setSharing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const done = () => {
    setEditing(null);
    setFailure(undefined);
    setFormKey((k) => k + 1);
    setDrawerOpen(false);
  };
  const startAdding = () => {
    done();
    if (isPhone()) setDrawerOpen(true);
  };
  const edit = (etape: Etape) => {
    // Not saved yet: it has no id the server knows. The refetch brings it in a moment.
    if (isOptimistic(etape)) return;
    setEditing(etape);
    setFailure(undefined);
    if (isPhone()) setDrawerOpen(true);
  };

  /**
   * The form closes at once (the feed already shows the change); the server's
   * answer arrives as a toast. A refusal is a toast too: the form is gone.
   */
  const failed = (error: { message: string }) =>
    toast.add({
      title:
        error.message === 'PARCOURS_LIMIT'
          ? t('form.errors.limit')
          : error.message === 'PARCOURS_FUTURE_DATE'
            ? t('form.errors.future')
            : t('form.errors.save'),
      type: 'error',
    });
  const confirmed = (title: string, type: 'success' | 'deleted' = 'success') => () => toast.add({ title, type });
  const save = (input: EtapeInput) => {
    setFailure(undefined);
    // Known before asking: the limit stays in the form, which keeps the draft.
    if (!editing && etapes.length >= MAX_ETAPES) {
      setFailure(t('form.errors.limit'));
      return;
    }
    if (editing) update.mutate({ id: editing.id, ...input }, { onSuccess: confirmed(t('toast.updated')), onError: failed });
    else add.mutate(input, { onSuccess: confirmed(t('toast.added')), onError: failed });
    done();
  };
  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(
      { id: deleting.id },
      { onSuccess: confirmed(t('toast.deleted'), 'deleted'), onError: () => toast.add({ title: t('toast.deleteFailed'), type: 'error' }) },
    );
    setDeleting(null);
    done();
  };

  const form = (
    <EtapeForm
      key={editing?.id ?? `new-${formKey}`}
      etape={editing}
      // Optimistic: the form is reset at once, so it never waits on a save.
      pending={false}
      error={failure}
      onSubmit={save}
      onDelete={editing ? () => setDeleting(editing) : undefined}
    />
  );

  return (
    <main className="bg-off-white">
      <ParcoursHero>
        {etapes.length > 0 && (
          <button
            type="button"
            onClick={() => setSharing(true)}
            className="mt-6 h-10 rounded-full bg-rouge px-5 font-heading text-body-sm font-bold text-white shadow-md hover:bg-crimson"
          >
            {t('viewTimeline')}
          </button>
        )}
      </ParcoursHero>

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-8 px-5 pt-6 pb-24 sm:px-10 lg:grid-cols-3 lg:py-8">
        <div className="min-w-0 lg:col-span-2">
          <AorCounter
            etapes={etapes}
            className="mb-6 rounded-2xl border-2 border-fog-light border-l-rouge bg-white p-5 shadow-sm"
            headlineSize="text-h4"
          />
          <EtapeFeed etapes={etapes} onAdd={startAdding} onEdit={edit} />
        </div>
        <aside className="hidden flex-col gap-4 lg:sticky lg:top-20 lg:flex">
          <section aria-labelledby="parcours-form-title" className="rounded-2xl border-2 border-fog-light bg-white p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="parcours-form-title" className="font-heading text-body font-bold text-navy-deep">
                {editing ? t('form.editTitle') : t('form.addTitle')}
              </h2>
              {editing && (
                <button type="button" onClick={done} className="text-caption font-semibold text-rouge">
                  {t('form.cancelEdit')}
                </button>
              )}
            </div>
            {form}
          </section>
        </aside>
      </div>

      <button
        type="button"
        onClick={startAdding}
        className="fixed right-4 bottom-4.5 z-40 inline-flex min-h-13 items-center rounded-full bg-rouge px-4.5 font-heading text-body font-bold text-white shadow-lg lg:hidden"
      >
        {t('fab')}
      </button>
      <EtapeDrawer open={drawerOpen} onOpenChange={setDrawerOpen} editing={editing !== null}>
        {form}
      </EtapeDrawer>

      <ParcoursShareView etapes={etapes} open={sharing} onOpenChange={setSharing} />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent className="gap-5 p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-h4 font-bold text-navy-deep">
              {t('deleteConfirm.title')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-body-sm text-slate">
              {t('deleteConfirm.text', { label: deleting?.label ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">{t('deleteConfirm.cancel')}</AlertDialogCancel>
            <button
              type="button"
              onClick={confirmDelete}
              className="rounded-full bg-rouge px-5 py-2 text-body-sm font-semibold text-white transition-colors hover:bg-crimson"
            >
              {t('deleteConfirm.confirm')}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
