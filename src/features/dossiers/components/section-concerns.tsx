'use client';

import { useMutation } from '@tanstack/react-query';
import { MessageSquareWarning, Pencil } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState, type ReactNode } from 'react';

import { smallButton, type Viewer } from '@/features/dossiers/components/document-styles';
import { useDocumentsMutation } from '@/features/dossiers/hooks/use-documents-mutation';
import { withConcerns } from '@/features/dossiers/lib/documents-cache';
import { CONCERNS_MAX } from '@/features/dossiers/lib/document-schema';
import { useTRPC } from '@/trpc/client';

/**
 * Under a Section's title in an Accompagnement Dossier (#149): the Client
 * notes what they think may be an error or a problem for them there; the
 * consultant reads it. Kept for a later letter of explanation.
 */
export function SectionConcerns({
  dossierId,
  section,
  viewer,
  open,
}: {
  dossierId: string;
  section: { id: string; title: string; concerns: string | null; concernsUpdatedAt: Date | null };
  viewer: Viewer;
  open: boolean;
}): ReactNode {
  const t = useTranslations('Dossiers.documents.concerns');
  const format = useFormatter();
  const id = useId();
  const trpc = useTRPC();
  const { optimistic } = useDocumentsMutation(dossierId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const save = useMutation(
    trpc.dossiers.documents.setSectionConcerns.mutationOptions(
      optimistic(withConcerns, (input) => (input.concerns.trim() ? t('saved') : t('cleared'))),
    ),
  );
  const client = viewer === 'client';
  const canWrite = client && open;

  if (!section.concerns && !canWrite) return null;

  if (editing) {
    return (
      <form
        className="mt-3 grid grid-cols-1 gap-2 rounded-xl bg-off-white p-3"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate({ id: section.id, concerns: draft });
          setEditing(false);
        }}
      >
        <label htmlFor={id} className="text-sm font-semibold text-navy-deep">
          {t('label', { section: section.title })}
        </label>
        <p id={`${id}-hint`} className="text-xs text-slate">
          {t('hint')}
        </p>
        <textarea
          id={id}
          rows={4}
          value={draft}
          maxLength={CONCERNS_MAX}
          aria-describedby={`${id}-hint`}
          onChange={(event) => setDraft(event.target.value)}
          className="rounded-xl border-2 border-fog-light bg-white px-3 py-2 text-sm text-navy-deep focus:border-navy-deep focus:outline-none"
        />
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={`${smallButton} bg-navy-deep text-white hover:bg-navy-80`}>
            {t('save')}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className={`${smallButton} text-slate hover:text-navy-deep`}
          >
            {t('cancel')}
          </button>
        </div>
      </form>
    );
  }

  const edit = () => {
    setDraft(section.concerns ?? '');
    setEditing(true);
  };

  if (!section.concerns) {
    return (
      <button
        type="button"
        onClick={edit}
        aria-label={t('addLabel', { section: section.title })}
        className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-rouge hover:text-crimson"
      >
        <MessageSquareWarning aria-hidden={true} className="size-4" />
        {t('add')}
      </button>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-1 gap-1 rounded-xl bg-honey-tint px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 font-semibold text-navy-deep">
          <MessageSquareWarning aria-hidden={true} className="size-4 text-honey" />
          {client ? t('title') : t('titleConsultant')}
        </p>
        {canWrite ? (
          <button
            type="button"
            onClick={edit}
            aria-label={t('editLabel', { section: section.title })}
            className="inline-flex min-h-11 items-center gap-1 font-semibold text-slate hover:text-navy-deep"
          >
            <Pencil aria-hidden={true} className="size-3.5" />
            {t('edit')}
          </button>
        ) : null}
      </div>
      <p className="whitespace-pre-line text-navy-deep">{section.concerns}</p>
      {section.concernsUpdatedAt ? (
        <p className="text-xs text-slate">
          {t('updatedOn', {
            date: format.dateTime(section.concernsUpdatedAt, { day: 'numeric', month: 'long', year: 'numeric' }),
          })}
        </p>
      ) : null}
    </div>
  );
}
