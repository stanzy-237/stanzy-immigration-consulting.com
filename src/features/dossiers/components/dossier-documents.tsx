'use client';

import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { DocumentCard } from '@/features/dossiers/components/document-card';
import {
  fieldClass,
  smallButton,
  type DocumentData,
  type Viewer,
} from '@/features/dossiers/components/document-styles';
import { useDocumentsMutation } from '@/features/dossiers/hooks/use-documents-mutation';
import {
  renamedSection,
  withDocument,
  withoutSection,
  withSection,
  type SectionsData,
} from '@/features/dossiers/lib/documents-cache';
import { isOptimistic } from '@/lib/optimistic-list';
import { addSectionInput, TITLE_MAX } from '@/features/dossiers/lib/document-schema';
import { useTRPC } from '@/trpc/client';

/**
 * A Dossier's Sections IRCC and their Documents, for the consultant in the
 * Tableau de bord and for the Client in « Mon espace ». Both add Documents,
 * upload Versions and comment; the consultant also shapes the Sections and
 * picks the Finales.
 */
export function DossierDocuments({ dossierId, viewer }: { dossierId: string; viewer: Viewer }): ReactNode {
  const t = useTranslations('Dossiers.documents');
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.dossiers.documents.sections.queryOptions({ dossierId }));
  const consultant = viewer === 'consultant';

  return (
    <section aria-labelledby={`${dossierId}-documents`} className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={`${dossierId}-documents`} className="font-heading text-2xl font-bold text-navy-deep">
            {t('title')}
          </h2>
          <p className="mt-1 text-sm text-slate">{consultant ? t('introConsultant') : t('introClient')}</p>
        </div>
      </div>

      {data.locked ? <p className="rounded-xl bg-ice-blue px-4 py-3 text-sm text-navy-deep">{t('locked')}</p> : null}

      {data.sections.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-fog-light bg-white px-6 py-8 text-center text-sm text-slate">
          {consultant ? t('emptyConsultant') : t('emptyClient')}
        </p>
      ) : (
        <ul className="grid gap-4">
          {data.sections.map((section) => (
            <li key={section.id}>
              <SectionCard
                dossierId={dossierId}
                section={section}
                viewer={viewer}
                me={data.viewer}
                open={data.open}
                locked={data.locked}
              />
            </li>
          ))}
        </ul>
      )}

      {consultant && data.open ? <AddSection dossierId={dossierId} /> : null}
    </section>
  );
}

type SectionData = {
  id: string;
  title: string;
  documents: DocumentData[];
};

function SectionCard({
  dossierId,
  section,
  viewer,
  me,
  open,
  locked,
}: {
  dossierId: string;
  section: SectionData;
  viewer: Viewer;
  me: SectionsData['viewer'];
  open: boolean;
  locked: boolean;
}): ReactNode {
  const t = useTranslations('Dossiers.documents');
  const trpc = useTRPC();
  const { optimistic } = useDocumentsMutation(dossierId);
  const [renaming, setRenaming] = useState(false);
  const consultant = viewer === 'consultant';
  // Just added: it has no server id until the refetch, so it can't change yet.
  const pending = isOptimistic(section);

  const remove = useMutation(
    trpc.dossiers.documents.deleteSection.mutationOptions(optimistic(withoutSection, () => t('toast.sectionDeleted'))),
  );

  return (
    <article className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2">
        {renaming ? (
          <TitleForm
            label={t('sectionTitle')}
            initial={section.title}
            submitLabel={t('save')}
            onCancel={() => setRenaming(false)}
            onDone={() => setRenaming(false)}
            dossierId={dossierId}
            mutation="rename"
            targetId={section.id}
          />
        ) : (
          <>
            <h3 className="font-heading text-lg font-bold text-navy-deep">{section.title}</h3>
            {consultant && open && !pending ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  className={`${smallButton} text-slate hover:text-navy-deep`}
                >
                  <Pencil aria-hidden={true} className="size-4" />
                  <span className="sr-only">{t('renameSection', { title: section.title })}</span>
                </button>
                {section.documents.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => remove.mutate({ id: section.id })}
                    className={`${smallButton} text-slate hover:text-rouge`}
                  >
                    <Trash2 aria-hidden={true} className="size-4" />
                    <span className="sr-only">{t('deleteSection', { title: section.title })}</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </header>

      {section.documents.length === 0 ? (
        <p className="mt-3 text-sm text-slate">{t('noDocuments')}</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {section.documents.map((document) => (
            <li key={document.id}>
              <DocumentCard
                dossierId={dossierId}
                document={document}
                viewer={viewer}
                me={me}
                open={open}
                locked={locked}
              />
            </li>
          ))}
        </ul>
      )}

      {open && !pending ? (
        <div className="mt-4 border-t border-off-white pt-4">
          <TitleForm
            label={t('documentTitle')}
            hint={consultant ? undefined : t('documentHint')}
            submitLabel={t('addDocument')}
            dossierId={dossierId}
            mutation="addDocument"
            targetId={section.id}
          />
        </div>
      ) : null}
    </article>
  );
}

function AddSection({ dossierId }: { dossierId: string }): ReactNode {
  const t = useTranslations('Dossiers.documents');
  return (
    <div className="rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
      <p className="mb-3 flex items-center gap-2 font-semibold text-navy-deep">
        <FolderPlus aria-hidden={true} className="size-5 text-rouge" />
        {t('newSection')}
      </p>
      <TitleForm
        label={t('sectionTitle')}
        hint={t('sectionHint')}
        submitLabel={t('addSection')}
        dossierId={dossierId}
        mutation="addSection"
        targetId={dossierId}
      />
    </div>
  );
}

/** One title field and a button: adds a Section or a Document, or renames a Section. */
function TitleForm({
  label,
  hint,
  initial = '',
  submitLabel,
  dossierId,
  mutation,
  targetId,
  onCancel,
  onDone,
}: {
  label: string;
  hint?: string;
  initial?: string;
  submitLabel: string;
  dossierId: string;
  mutation: 'addSection' | 'addDocument' | 'rename';
  targetId: string;
  onCancel?: () => void;
  onDone?: () => void;
}): ReactNode {
  const t = useTranslations('Dossiers.documents');
  const id = useId();
  const trpc = useTRPC();
  const { optimistic } = useDocumentsMutation(dossierId);
  const [title, setTitle] = useState(initial);
  const [invalid, setInvalid] = useState(false);

  const addSection = useMutation(
    trpc.dossiers.documents.addSection.mutationOptions(optimistic(withSection, () => t('toast.sectionAdded'))),
  );
  const addDocument = useMutation(
    trpc.dossiers.documents.addDocument.mutationOptions(optimistic(withDocument, () => t('toast.documentAdded'))),
  );
  const rename = useMutation(
    trpc.dossiers.documents.renameSection.mutationOptions(optimistic(renamedSection, () => t('toast.sectionRenamed'))),
  );

  // The change is on screen at once: the form clears (or closes) without waiting for the server.
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const valid = addSectionInput.shape.title.safeParse(title).success;
    setInvalid(!valid);
    if (!valid) return;
    if (mutation === 'addSection') addSection.mutate({ dossierId: targetId, title });
    else if (mutation === 'addDocument') addDocument.mutate({ sectionId: targetId, title });
    else rename.mutate({ id: targetId, title });
    setTitle('');
    onDone?.();
  };

  const described = invalid ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <form onSubmit={submit} noValidate className="grid w-full gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-navy-deep">
        {label}
      </label>
      <div className="flex flex-wrap gap-2 sm:flex-nowrap">
        <input
          id={id}
          value={title}
          maxLength={TITLE_MAX}
          aria-invalid={invalid}
          aria-describedby={described}
          onChange={(event) => setTitle(event.target.value)}
          className={fieldClass}
        />
        <button type="submit" className={`${smallButton} bg-navy-deep text-white hover:bg-navy-80`}>
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className={`${smallButton} text-slate hover:text-navy-deep`}>
            {t('cancel')}
          </button>
        ) : null}
      </div>
      {invalid ? (
        <p id={`${id}-error`} className="text-sm text-rouge">
          {t('titleError')}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate">
          {hint}
        </p>
      ) : null}
    </form>
  );
}

export function DossierDocumentsSkeleton(): ReactNode {
  const t = useTranslations('Dossiers.documents');
  return (
    <div role="status">
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden={true} className="grid gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </div>
  );
}
