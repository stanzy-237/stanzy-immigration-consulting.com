'use client';

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
import { EtapeFeed } from '@/features/parcours/components/etape-feed';
import { EtapeForm } from '@/features/parcours/components/etape-form';
import { EtapeSheet } from '@/features/parcours/components/etape-sheet';
import { ParcoursShareView } from '@/features/parcours/components/parcours-share-view';
import { sortByDate } from '@/features/parcours/lib/calendar-day';
import type { Etape, EtapeInput } from '@/features/parcours/lib/etape-schema';
import { api } from '@/trpc/react';

/** Below `lg` the form lives in a bottom sheet instead of the sidebar. */
const isPhone = () => window.matchMedia('(max-width: 1023px)').matches;

/** The Parcours itself: hero, feed of Étapes, and the add/edit form. */
export function ParcoursJournal(): ReactNode {
  const t = useTranslations('Parcours');
  const { data = [] } = api.parcours.list.useQuery();
  const etapes = sortByDate(data);
  const utils = api.useUtils();
  const refresh = { onSuccess: () => void utils.parcours.list.invalidate() };
  const add = api.parcours.add.useMutation(refresh);
  const update = api.parcours.update.useMutation(refresh);
  const remove = api.parcours.delete.useMutation(refresh);

  /** The Étape open in the form, or null when the form adds a new one. */
  const [editing, setEditing] = useState<Etape | null>(null);
  // Remounting the form clears it once an Étape is saved.
  const [formKey, setFormKey] = useState(0);
  /** Why the last save failed; the form keeps its draft. */
  const [failure, setFailure] = useState<string>();
  const [deleting, setDeleting] = useState<Etape | null>(null);
  const [sharing, setSharing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const done = () => {
    setEditing(null);
    setFailure(undefined);
    setFormKey((k) => k + 1);
    setSheetOpen(false);
  };
  const startAdding = () => {
    done();
    if (isPhone()) setSheetOpen(true);
  };
  const edit = (etape: Etape) => {
    setEditing(etape);
    setFailure(undefined);
    if (isPhone()) setSheetOpen(true);
  };

  const failed = (error: { message: string }) =>
    setFailure(
      error.message === 'PARCOURS_LIMIT'
        ? t('form.errors.limit')
        : error.message === 'PARCOURS_FUTURE_DATE'
          ? t('form.errors.future')
          : t('form.errors.save'),
    );
  const save = (input: EtapeInput) => {
    setFailure(undefined);
    const outcome = { onSuccess: done, onError: failed };
    if (editing) update.mutate({ id: editing.id, ...input }, outcome);
    else add.mutate(input, outcome);
  };
  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate({ id: deleting.id }, { onSuccess: done, onError: failed });
    setDeleting(null);
  };

  const form = (
    <EtapeForm
      key={editing?.id ?? `new-${formKey}`}
      etape={editing}
      pending={add.isPending || update.isPending}
      error={failure}
      onSubmit={save}
      onDelete={editing ? () => setDeleting(editing) : undefined}
    />
  );

  return (
    <main className="bg-off-white">
      <header className="bg-linear-135 from-navy-deep to-navy-80 text-white">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-10">
          <p className="inline-flex rounded-full border border-rouge/35 bg-rouge/15 px-3 py-1.5 font-label uppercase tracking-widest text-rose">
            {t('eyebrow')}
          </p>
          <h1 className="mt-4 mb-2.5 font-heading text-h2 font-bold leading-none tracking-tight">{t('title')}</h1>
          <p className="max-w-xl text-body text-white/60">{t('lead')}</p>
          {etapes.length > 0 && (
            <button
              type="button"
              onClick={() => setSharing(true)}
              className="mt-6 h-10 rounded-full bg-rouge px-5 font-heading text-body-sm font-bold text-white shadow-md hover:bg-crimson"
            >
              {t('viewTimeline')}
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl items-start gap-8 px-5 pt-6 pb-24 sm:px-10 lg:grid-cols-3 lg:py-8">
        <div className="lg:col-span-2">
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
      <EtapeSheet open={sheetOpen} onOpenChange={setSheetOpen} editing={editing !== null}>
        {form}
      </EtapeSheet>

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
