'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Circle, FileText, PenLine, Plus, Save, Trash2, TriangleAlert, Upload } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import NextLink from 'next/link';
import { useId, useRef, useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import {
  CONTACTS_MAX,
  requirementFileUrl,
  type Answers,
  type Question,
} from '@/features/document-services/lib/requirements';
import { textIn } from '@/features/document-services/lib/service-schema';
import { signaturePage } from '@/features/document-services/lib/signature-page';
import { uploadEncryptedFile } from '@/features/dossiers/lib/upload-version';
import { SignaturePad } from '@/features/shared/components/signing/signature-pad';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { INKS, type Ink } from '@/features/signatures/lib/inks';
import { Link } from '@/i18n/navigation';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Data = RouterOutputs['documentServices']['requirements']['get'];
type Item = Data['items'][number];

const field =
  'h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none disabled:bg-off-white';
const card = 'grid grid-cols-1 gap-4 rounded-2xl border border-fog-light bg-white p-5 shadow-sm md:p-6';
const pill = 'rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap';
const STATE_STYLES = {
  given: 'bg-leaf-tint text-leaf',
  inDossier: 'bg-leaf-tint text-leaf',
  missing: 'bg-honey-tint text-honey',
} as const;

/**
 * What the Client hands over for a « Stanzy s'en charge » request (#80): the
 * service's questionnaire (proof of funds: NIU, emergency contacts, a
 * donation) and its prerequisite files, any photo or PDF with no IRCC rules,
 * a signature drawn on screen. Shared with the consultant (and the Partner in
 * charge, #42); none of it becomes a Document of the Dossier. The Client
 * reaches it in « Mon espace », the consultant from the Dossier's « Documents
 * à obtenir par Stanzy ».
 */
export function RequirementsView({ requestId, viewer }: { requestId: string; viewer: 'client' | 'consultant' }): ReactNode {
  const body = (
    <div className="mx-auto grid grid-cols-1 max-w-3xl gap-6">
      <QueryBoundary fallback={<RequirementsSkeleton />}>
        <Requirements requestId={requestId} viewer={viewer} />
      </QueryBoundary>
    </div>
  );
  if (viewer === 'consultant') return body;
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-off-white px-4 py-10 md:py-14">{body}</main>
      <SiteFooter />
    </>
  );
}

function Requirements({ requestId, viewer }: { requestId: string; viewer: 'client' | 'consultant' }): ReactNode {
  const t = useTranslations('DocumentServices.requirements');
  const locale = useLocale();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.documentServices.requirements.get.queryOptions({ requestId }));
  const left = data.items.filter((item) => item.state === 'missing').length + data.questionsLeft.length;
  const backClass = 'inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-slate hover:text-navy-deep';
  const backContent = (
    <>
      <ArrowLeft aria-hidden={true} className="size-4" />
      {t('back')}
    </>
  );
  return (
    <>
      {viewer === 'consultant' ? (
        <NextLink href={`/dossiers/${data.dossier.id}#stanzy`} className={backClass}>
          {backContent}
        </NextLink>
      ) : (
        <Link
          href={`/mon-espace/dossiers/${data.dossier.id}?document=${data.request.document.id}#documents`}
          className={backClass}
        >
          {backContent}
        </Link>
      )}
      <div>
        <h1 className="font-heading text-2xl font-bold text-navy-deep md:text-3xl">
          {data.request.service ? textIn(data.request.service.name, locale) : t('title')}
        </h1>
        <p className="mt-1 text-sm text-slate">
          {t('for', { document: data.request.document.title, client: data.dossier.client })}
        </p>
        <p className="mt-3 text-sm text-navy-deep">{t('intro')}</p>
        <p
          className={`mt-3 inline-flex items-center gap-1.5 ${pill} ${data.complete ? 'bg-leaf-tint text-leaf' : 'bg-honey-tint text-honey'}`}
        >
          {data.complete ? t('complete') : t('left', { count: left })}
        </p>
        {!data.editable ? <p className="mt-2 text-sm text-slate">{t('closed')}</p> : null}
      </div>
      {data.questionnaire ? <Questions data={data} /> : null}
      {data.items.length > 0 ? (
        <section aria-labelledby="requirements-files" className={card}>
          <h2 id="requirements-files" className="font-heading text-lg font-bold text-navy-deep">
            {t('files')}
          </h2>
          <ul className="grid grid-cols-1 gap-3">
            {data.items.map((item) => (
              <Requirement key={item.key} requestId={requestId} item={item} editable={data.editable} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

/** The service's questionnaire, saved whole: what is still to answer shows on the page. */
function Questions({ data }: { data: Data }): ReactNode {
  const t = useTranslations('DocumentServices.requirements');
  const ids = useId();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Answers>(() =>
    data.answers.contacts.length > 0 ? data.answers : { ...data.answers, contacts: [{ name: '', phone: '' }] },
  );
  const update = (patch: Partial<Answers>) => setAnswers((current) => ({ ...current, ...patch }));
  const save = useMutation(
    trpc.documentServices.requirements.saveAnswers.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.documentServices.requirements.get.queryKey() });
        toast.add({ title: t('saved'), type: 'success' });
      },
      onError: (error) => {
        const known = t.has(`errors.${error.message}`);
        toast.add({ title: t(known ? `errors.${error.message}` : 'errors.UNKNOWN'), type: known ? 'warning' : 'error' });
      },
    }),
  );
  const missing = (question: Question) => data.questionsLeft.includes(question);
  const disabled = !data.editable;
  const yesNo = (name: string, value: boolean | null, onChange: (value: boolean) => void) => (
    <div role="radiogroup" aria-label={t(`questions.${name}`)} className="flex gap-2">
      {[true, false].map((choice) => (
        <label
          key={String(choice)}
          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border-2 border-fog-light px-4 text-sm font-semibold text-navy-deep has-checked:border-navy-deep"
        >
          <input
            type="radio"
            name={`${ids}-${name}`}
            checked={value === choice}
            disabled={disabled}
            onChange={() => onChange(choice)}
            className="accent-rouge"
          />
          {choice ? t('yes') : t('no')}
        </label>
      ))}
    </div>
  );
  const label = (question: Question, text: string) => (
    <span className="flex items-center gap-2 text-sm font-semibold text-navy-deep">
      {text}
      {missing(question) ? <span className={`${pill} ${STATE_STYLES.missing}`}>{t('toAnswer')}</span> : null}
    </span>
  );

  return (
    <form
      aria-labelledby="requirements-questions"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({ requestId: data.request.id, answers });
      }}
      className={card}
    >
      <h2 id="requirements-questions" className="font-heading text-lg font-bold text-navy-deep">
        {t('questionsTitle')}
      </h2>
      <label htmlFor={`${ids}-niu`} className="grid grid-cols-1 gap-1.5">
        {label('niu', t('questions.niu'))}
        <input
          id={`${ids}-niu`}
          value={answers.niu}
          maxLength={30}
          disabled={disabled}
          onChange={(event) => update({ niu: event.target.value })}
          className={field}
        />
        <span className="text-xs text-slate">{t('niuHint')}</span>
      </label>

      <fieldset className="grid grid-cols-1 gap-2">
        <legend className="mb-1.5">{label('contacts', t('questions.contacts'))}</legend>
        {answers.contacts.map((contact, index) => {
          const setContact = (patch: Partial<typeof contact>) =>
            update({ contacts: answers.contacts.map((other, at) => (at === index ? { ...other, ...patch } : other)) });
          return (
            <div key={index} className="grid grid-cols-1 gap-2 rounded-xl bg-off-white p-3 sm:grid-cols-2">
              <input
                aria-label={t('contactName', { n: index + 1 })}
                placeholder={t('name')}
                value={contact.name}
                maxLength={120}
                disabled={disabled}
                onChange={(event) => setContact({ name: event.target.value })}
                className={field}
              />
              <div className="flex gap-2">
                <input
                  aria-label={t('contactPhone', { n: index + 1 })}
                  placeholder={t('phone')}
                  type="tel"
                  value={contact.phone}
                  maxLength={30}
                  disabled={disabled}
                  onChange={(event) => setContact({ phone: event.target.value })}
                  className={field}
                />
                {answers.contacts.length > 1 && !disabled ? (
                  <button
                    type="button"
                    onClick={() => update({ contacts: answers.contacts.filter((_, at) => at !== index) })}
                    aria-label={t('removeContact', { n: index + 1 })}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-slate hover:bg-white hover:text-rouge"
                  >
                    <Trash2 aria-hidden={true} className="size-4" />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        {answers.contacts.length < CONTACTS_MAX && !disabled ? (
          <button
            type="button"
            onClick={() => update({ contacts: [...answers.contacts, { name: '', phone: '' }] })}
            className="inline-flex h-10 w-fit items-center gap-1.5 rounded-full border-2 border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white"
          >
            <Plus aria-hidden={true} className="size-4" />
            {t('addContact')}
          </button>
        ) : null}
      </fieldset>

      <div className="grid grid-cols-1 gap-2">
        {label('donation', t('questions.donation'))}
        {yesNo('donation', answers.donation, (donation) =>
          update({ donation, donor: donation ? (answers.donor ?? { name: '', email: '', phone: '' }) : null }),
        )}
      </div>
      {answers.donation && answers.donor ? (
        <fieldset className="grid grid-cols-1 gap-2 rounded-xl bg-off-white p-3 sm:grid-cols-3">
          <legend className="mb-1.5">{label('donor', t('questions.donor'))}</legend>
          {(['name', 'email', 'phone'] as const).map((key) => (
            <input
              key={key}
              aria-label={t(`donor.${key}`)}
              placeholder={t(`donor.${key}`)}
              type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
              value={answers.donor?.[key] ?? ''}
              maxLength={key === 'email' ? 200 : key === 'phone' ? 30 : 120}
              disabled={disabled}
              onChange={(event) => update({ donor: { ...answers.donor!, [key]: event.target.value } })}
              className={field}
            />
          ))}
          <p className="text-xs text-slate sm:col-span-3">{t('donorPhoto')}</p>
        </fieldset>
      ) : null}

      {data.questionnaire === 'proofOfFundsNoFunds' ? (
        <div className="grid grid-cols-1 gap-2">
          {label('ubaAccount', t('questions.ubaAccount'))}
          {yesNo('ubaAccount', answers.ubaAccount, (ubaAccount) => update({ ubaAccount }))}
          {answers.ubaAccount ? (
            <p role="note" className="flex items-start gap-2 rounded-xl bg-honey-tint px-3 py-2.5 text-sm text-navy-deep">
              <TriangleAlert aria-hidden={true} className="mt-0.5 size-4 shrink-0 text-honey" />
              {t('ubaClose')}
            </p>
          ) : null}
        </div>
      ) : null}

      {data.editable ? (
        <button
          type="submit"
          disabled={save.isPending}
          className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
        >
          <Save aria-hidden={true} className="size-4" />
          {save.isPending ? t('saving') : t('save')}
        </button>
      ) : null}
    </form>
  );
}

/** One prerequisite: where it stands, the files handed over, and a way to add one (a file, or a signature to draw). */
function Requirement({ requestId, item, editable }: { requestId: string; item: Item; editable: boolean }): ReactNode {
  const t = useTranslations('DocumentServices.requirements');
  const files = useTranslations('Dossiers.documents');
  const locale = useLocale();
  const format = useFormatter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [signing, setSigning] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.documentServices.requirements.get.queryKey() });
  const add = useMutation(trpc.documentServices.requirements.addFile.mutationOptions());
  const remove = useMutation(
    trpc.documentServices.requirements.removeFile.mutationOptions({
      onSuccess: () => {
        void refresh();
        toast.add({ title: t('removed'), type: 'success' });
      },
      onError: () => toast.add({ title: t('errors.UNKNOWN'), type: 'error' }),
    }),
  );

  const send = async (file: File): Promise<boolean> => {
    setBusy(true);
    try {
      const stored = await uploadEncryptedFile(file, { uploadRoute: '/api/requirements/upload', payload: { requestId } });
      await add.mutateAsync({ ...stored, requestId, prerequisite: item.key });
      await refresh();
      toast.add({ title: t('added'), type: 'success' });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const known = files.has(`errors.${message}`);
      toast.add({ title: known ? files(`errors.${message}`) : t('errors.UNKNOWN'), type: known ? 'warning' : 'error' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="grid grid-cols-1 gap-2 rounded-xl bg-off-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-navy-deep">
          {item.state === 'missing' ? (
            <Circle aria-hidden={true} className="size-4 shrink-0 text-slate" />
          ) : (
            <CheckCircle2 aria-hidden={true} className="size-4 shrink-0 text-leaf" />
          )}
          {item[locale === 'en' ? 'en' : 'fr']}
        </span>
        <span className={`${pill} ${STATE_STYLES[item.state]}`}>{t(`states.${item.state}`)}</span>
      </div>
      {item.state === 'inDossier' && item.document ? (
        <p className="text-xs text-slate">{t('inDossierHint', { document: item.document.title })}</p>
      ) : null}
      {item.type === 'file' && item.files.length === 0 && editable ? (
        <p className="text-xs text-slate">{t('anyFormat')}</p>
      ) : null}
      {item.files.length > 0 ? (
        <ul className="grid grid-cols-1 gap-1">
          {item.files.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
              <a
                href={requirementFileUrl(file.id)}
                target="_blank"
                rel="noopener"
                className="flex min-w-0 items-center gap-2 text-sm font-semibold text-navy-deep hover:text-rouge"
              >
                <FileText aria-hidden={true} className="size-4 shrink-0" />
                <span className="truncate">{file.fileName}</span>
                <span className="shrink-0 text-xs font-normal text-slate">
                  {format.dateTime(file.createdAt, { day: 'numeric', month: 'short' })}
                </span>
              </a>
              {editable ? (
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ id: file.id })}
                  aria-label={t('remove', { name: file.fileName })}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-slate hover:bg-off-white hover:text-rouge"
                >
                  <Trash2 aria-hidden={true} className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {editable ? (
        item.type === 'signature' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setSigning(true)}
            className="inline-flex h-10 w-fit items-center gap-1.5 rounded-full border-2 border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white disabled:opacity-50"
          >
            <PenLine aria-hidden={true} className="size-4" />
            {busy ? t('sending') : item.files.length > 0 ? t('signAgain') : t('sign')}
          </button>
        ) : (
          <>
            <input
              ref={input}
              type="file"
              accept="application/pdf,image/*"
              className="sr-only"
              tabIndex={-1}
              aria-hidden={true}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) await send(file);
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
              className="inline-flex h-10 w-fit items-center gap-1.5 rounded-full border-2 border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white disabled:opacity-50"
            >
              <Upload aria-hidden={true} className="size-4" />
              {busy ? t('sending') : t('upload')}
            </button>
          </>
        )
      ) : null}
      {signing ? (
        <SignDialog
          onClose={() => setSigning(false)}
          onSave={async (png) => {
            const pdf = await signaturePage(png);
            const name = `${t('signatureFile')}.pdf`;
            if (await send(new File([pdf as BlobPart], name, { type: 'application/pdf' }))) setSigning(false);
          }}
        />
      ) : null}
    </li>
  );
}

/** The Client signs on the pad; the signature goes on a blank page, as a PDF. */
function SignDialog({ onClose, onSave }: { onClose: () => void; onSave: (png: string) => Promise<void> }): ReactNode {
  const t = useTranslations('DocumentServices.requirements');
  const [ink, setInk] = useState<Ink>('black');
  const [png, setPng] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const hint = useId();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg gap-4 p-6">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold text-navy-deep">{t('signTitle')}</DialogTitle>
          <DialogDescription id={hint} className="text-sm text-slate">
            {t('signHint')}
          </DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label={t('ink')} className="flex gap-2">
          {(Object.keys(INKS) as Ink[]).map((choice) => (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={ink === choice}
              onClick={() => setInk(choice)}
              className="inline-flex h-9 items-center gap-2 rounded-full border-2 border-fog-light px-3 text-sm font-semibold text-navy-deep aria-checked:border-navy-deep"
            >
              <span aria-hidden={true} className="size-3 rounded-full" style={{ backgroundColor: INKS[choice] }} />
              {t(`inks.${choice}`)}
            </button>
          ))}
        </div>
        <SignaturePad ink={ink} onChange={setPng} describedBy={hint} />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-full px-4 text-sm font-semibold text-navy-deep hover:bg-off-white"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={!png || saving}
            onClick={async () => {
              if (!png) return;
              setSaving(true);
              try {
                await onSave(png);
              } finally {
                setSaving(false);
              }
            }}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
          >
            {saving ? t('sending') : t('signSave')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RequirementsSkeleton(): ReactNode {
  const t = useTranslations('DocumentServices.requirements');
  return (
    <div role="status" className="grid grid-cols-1 gap-4">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-24 rounded-2xl" />
      <Skeleton aria-hidden={true} className="h-72 rounded-2xl" />
    </div>
  );
}
