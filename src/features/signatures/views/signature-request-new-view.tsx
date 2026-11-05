'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, Send, Upload } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { TITLE_MAX } from '@/features/dossiers/lib/document-schema';
import { uploadVersionFile, versionFileUrl } from '@/features/dossiers/lib/upload-version';
import { FieldPlacer, type PlacedField } from '@/features/signatures/components/field-placer';
import { useSignatureErrors } from '@/features/signatures/hooks/use-signature-errors';
import type { FieldKind } from '@/features/signatures/lib/signature-schema';
import { inLanguage } from '@/features/dossiers/lib/documents-cache';
import { useTRPC } from '@/trpc/client';

const fieldClass =
  'h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm text-navy-deep focus:border-navy-deep focus:outline-none';

/**
 * « Demander une signature » from a Dossier (#96): pick a PDF Version (or
 * upload one as a new Document), place the fields, send it to the Client.
 * `?version=` starts on a Version chosen from its Document.
 */
export function SignatureRequestNewView({ dossierId }: { dossierId: string }): ReactNode {
  const t = useTranslations('Signatures.new');
  const params = useSearchParams();
  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div>
        <Link
          href={`/dossiers/${dossierId}#documents`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate hover:text-navy-deep"
        >
          <ArrowLeft aria-hidden={true} className="size-4" />
          {t('back')}
        </Link>
        <h1 className="font-heading text-2xl font-bold text-navy-deep md:text-3xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate">{t('intro')}</p>
      </div>
      <QueryBoundary fallback={<ComposeSkeleton />}>
        <Compose dossierId={dossierId} initialVersion={params.get('version')} />
      </QueryBoundary>
    </div>
  );
}

function Compose({ dossierId, initialVersion }: { dossierId: string; initialVersion: string | null }): ReactNode {
  const t = useTranslations('Signatures.new');
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const failed = useSignatureErrors();
  const locale = useLocale();
  const { data } = useSuspenseQuery({
    ...trpc.dossiers.documents.sections.queryOptions({ dossierId }),
    select: inLanguage(locale),
  });
  const { data: assets } = useSuspenseQuery(trpc.signatures.assets.queryOptions());
  const [versionId, setVersionId] = useState(initialVersion);
  const [fields, setFields] = useState<PlacedField[]>([]);
  const [tool, setTool] = useState<FieldKind>('SIGNATURE');

  const pdfs = data.sections.flatMap((section) =>
    section.documents.flatMap((document) =>
      document.versions
        .filter((version) => version.contentType === 'application/pdf')
        .map((version) => ({ section: section.title, document, version })),
    ),
  );
  const chosen = pdfs.find((pdf) => pdf.version.id === versionId);

  const create = useMutation(
    trpc.signatures.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.dossiers.documents.sections.queryKey({ dossierId }) });
        void queryClient.invalidateQueries({ queryKey: trpc.signatures.pending.queryKey() });
        toast.add({ title: t('sent'), type: 'success' });
        const focus = chosen ? `?document=${chosen.document.id}` : '';
        router.push(`/dossiers/${dossierId}${focus}#documents`);
      },
      onError: failed,
    }),
  );

  if (!versionId || !chosen) {
    return (
      <PickPdf
        dossierId={dossierId}
        pdfs={pdfs}
        sections={data.sections.map((section) => ({ id: section.id, title: section.title }))}
        onPick={(id) => {
          setVersionId(id);
          setFields([]);
        }}
      />
    );
  }

  const hasSignature = fields.some((field) => field.kind === 'SIGNATURE');
  return (
    <div className="grid gap-5">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fog-light bg-white p-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <FileText aria-hidden={true} className="size-5 shrink-0 text-slate" />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-navy-deep">{chosen.document.title}</span>
            <span className="block truncate text-xs text-slate">
              {chosen.section} · {t('pick.version', { number: chosen.version.number, file: chosen.version.fileName })}
            </span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setVersionId(null)}
          className="inline-flex h-10 items-center rounded-full border border-fog-light px-4 text-sm font-semibold text-navy-deep hover:border-navy-deep"
        >
          {t('place.change')}
        </button>
      </section>

      <h2 className="font-heading text-xl font-bold text-navy-deep">{t('place.title')}</h2>
      <FieldPlacer
        url={versionFileUrl(chosen.version.id)}
        fields={fields}
        onChange={setFields}
        tool={tool}
        onTool={setTool}
        stampReady={Boolean(assets.SIGNATURE && assets.STAMP)}
      />

      <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-fog-light bg-white/95 p-3 shadow-md backdrop-blur">
        {hasSignature ? null : <p className="mr-auto text-sm text-slate">{t('place.needSignature')}</p>}
        <button
          type="button"
          disabled={!hasSignature || create.isPending}
          onClick={() =>
            create.mutate({
              versionId: chosen.version.id,
              fields: fields.map(({ kind, page, x, y, width, height }) => ({ kind, page, x, y, width, height })),
            })
          }
          className="inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
        >
          <Send aria-hidden={true} className="size-4" />
          {create.isPending ? t('sending') : t('send')}
        </button>
      </div>
    </div>
  );
}

type Pdf = {
  section: string;
  document: { id: string; title: string; signatures: { id: string }[] };
  version: { id: string; number: number; fileName: string };
};

/** A PDF already in the Dossier, or a new one uploaded as a Document of the chosen Section. */
function PickPdf({
  dossierId,
  pdfs,
  sections,
  onPick,
}: {
  dossierId: string;
  pdfs: Pdf[];
  sections: { id: string; title: string }[];
  onPick: (versionId: string) => void;
}): ReactNode {
  const t = useTranslations('Signatures');
  const card = useTranslations('Signatures.card');
  const ids = useId();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const failed = useSignatureErrors();
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const addDocument = useMutation(trpc.dossiers.documents.addDocument.mutationOptions());
  const addVersion = useMutation(trpc.dossiers.documents.addVersion.mutationOptions());

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || !sectionId || title.trim().length < 2) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.add({ title: t('new.pick.pdfOnly'), type: 'warning' });
      return;
    }
    setSending(true);
    try {
      const document = await addDocument.mutateAsync({ sectionId, title: title.trim() });
      const uploaded = await uploadVersionFile(document.id, file);
      const version = await addVersion.mutateAsync({ documentId: document.id, ...uploaded });
      await queryClient.invalidateQueries({ queryKey: trpc.dossiers.documents.sections.queryKey({ dossierId }) });
      onPick(version.id);
    } catch (error) {
      failed({ message: error instanceof Error ? error.message : '' });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="grid gap-5 rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-heading text-xl font-bold text-navy-deep">{t('new.pick.title')}</h2>
        <p className="mt-1 text-sm text-slate">{t('new.pick.existing')}</p>
      </div>

      {pdfs.length === 0 ? (
        <p className="text-sm text-slate">{t('new.pick.noPdf')}</p>
      ) : (
        <ul className="grid gap-2">
          {pdfs.map((pdf) => {
            const waiting = pdf.document.signatures.length > 0;
            return (
              <li
                key={pdf.version.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-off-white px-3 py-2"
              >
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-semibold text-navy-deep">{pdf.document.title}</span>
                  <span className="block truncate text-xs text-slate">
                    {pdf.section} ·{' '}
                    {t('new.pick.version', { number: pdf.version.number, file: pdf.version.fileName })}
                  </span>
                </span>
                {waiting ? (
                  <span className="text-xs font-semibold text-slate">{card('pendingConsultant')}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onPick(pdf.version.id)}
                    className="inline-flex h-10 items-center rounded-full border-2 border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white"
                  >
                    {t('new.pick.choose')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs font-semibold tracking-wider text-slate uppercase">{t('new.pick.or')}</p>

      {sections.length === 0 ? (
        <p className="text-sm text-slate">{t('new.pick.noSection')}</p>
      ) : (
        <form onSubmit={upload} className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-semibold text-navy-deep" htmlFor={`${ids}-section`}>
            {t('new.pick.section')}
            <select
              id={`${ids}-section`}
              value={sectionId}
              onChange={(event) => setSectionId(event.target.value)}
              className={fieldClass}
            >
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-navy-deep" htmlFor={`${ids}-title`}>
            {t('new.pick.documentTitle')}
            <input
              id={`${ids}-title`}
              value={title}
              required={true}
              minLength={2}
              maxLength={TITLE_MAX}
              placeholder={t('new.pick.documentPlaceholder')}
              onChange={(event) => setTitle(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-navy-deep sm:col-span-2" htmlFor={`${ids}-file`}>
            {t('new.pick.file')}
            <input
              id={`${ids}-file`}
              type="file"
              accept="application/pdf,.pdf"
              required={true}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="text-sm font-normal text-navy-deep file:mr-3 file:h-10 file:rounded-full file:border-0 file:bg-ice-blue file:px-4 file:font-semibold file:text-navy-deep"
            />
          </label>
          <button
            type="submit"
            disabled={sending}
            className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-navy-deep px-5 text-sm font-semibold text-white hover:bg-navy-80 disabled:opacity-50"
          >
            <Upload aria-hidden={true} className="size-4" />
            {sending ? t('new.pick.uploading') : t('new.pick.upload')}
          </button>
        </form>
      )}
    </section>
  );
}

function ComposeSkeleton(): ReactNode {
  const t = useTranslations('Signatures.new');
  return (
    <div role="status" className="grid gap-4">
      <span className="sr-only">{t('loadingPdf')}</span>
      <Skeleton aria-hidden={true} className="h-20 rounded-2xl" />
      <Skeleton aria-hidden={true} className="h-96 rounded-2xl" />
    </div>
  );
}
