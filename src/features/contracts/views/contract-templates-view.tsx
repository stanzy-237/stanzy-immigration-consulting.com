'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, Eye, Save } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { useId, useRef, useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useContractErrors } from '@/features/contracts/hooks/use-contract-errors';
import {
  BODY_MAX,
  CONTRACT_BLANKS,
  CONTRACT_LOCALES,
  TITLE_MAX,
  unknownBlanks,
} from '@/features/contracts/lib/contract-schema';
import { SERVICE_TYPES, type ServiceType } from '@/features/dossiers/data/workflows';
import { useTRPC } from '@/trpc/client';

type Locale = (typeof CONTRACT_LOCALES)[number];

const field =
  'h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none';

/**
 * « Modèles de contrat » (#96): one template per service and language,
 * written in plain text with blanks filled in when a Contrat is sent, and
 * a PDF preview on the letterhead before saving. No price lives here.
 */
export function ContractTemplatesView(): ReactNode {
  const t = useTranslations('Contracts.templates');
  return (
    <div className="mx-auto grid grid-cols-1 max-w-4xl gap-6">
      <div>
        <Link
          href="/contrats"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate hover:text-navy-deep"
        >
          <ArrowLeft aria-hidden={true} className="size-4" />
          {t('back')}
        </Link>
        <h1 className="font-heading text-2xl font-bold text-navy-deep md:text-3xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate">{t('intro')}</p>
      </div>
      <QueryBoundary fallback={<TemplatesSkeleton />}>
        <Templates />
      </QueryBoundary>
    </div>
  );
}

function Templates(): ReactNode {
  const t = useTranslations('Contracts.templates');
  const services = useTranslations('Dossiers.services');
  const format = useFormatter();
  const trpc = useTRPC();
  const { data: templates } = useSuspenseQuery(trpc.contracts.templates.list.queryOptions());
  const [service, setService] = useState<ServiceType>('ACCOMPAGNEMENT');
  const [locale, setLocale] = useState<Locale>('fr');
  const current = templates.find((template) => template.service === service && template.locale === locale);
  const has = (s: ServiceType, l: Locale) => templates.some((template) => template.service === s && template.locale === l);

  return (
    <div className="grid grid-cols-1 gap-5">
      <div role="radiogroup" aria-label={t('service')} className="flex flex-wrap gap-2">
        {SERVICE_TYPES.map((choice) => (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={service === choice}
            onClick={() => setService(choice)}
            className={
              service === choice
                ? 'inline-flex h-10 items-center gap-2 rounded-full bg-navy-deep px-4 text-sm font-semibold text-white'
                : 'inline-flex h-10 items-center gap-2 rounded-full border border-fog-light bg-white px-4 text-sm font-semibold text-navy-deep hover:border-navy-deep'
            }
          >
            {services(choice)}
            <span
              aria-hidden={true}
              className={
                has(choice, 'fr') && has(choice, 'en') ? 'size-2 rounded-full bg-leaf' : 'size-2 rounded-full bg-fog'
              }
            />
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label={t('locale')} className="flex gap-2">
        {CONTRACT_LOCALES.map((choice) => (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={locale === choice}
            onClick={() => setLocale(choice)}
            className={
              locale === choice
                ? 'inline-flex h-9 items-center rounded-full bg-ice-blue px-4 text-sm font-semibold text-navy-deep ring-2 ring-navy-deep'
                : 'inline-flex h-9 items-center rounded-full bg-white px-4 text-sm font-semibold text-slate ring-1 ring-fog-light hover:text-navy-deep'
            }
          >
            {t(choice)}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate">
        {current
          ? t('updated', { date: format.dateTime(current.updatedAt, { day: 'numeric', month: 'long', year: 'numeric' }) })
          : t('missing')}
      </p>
      {/* A fresh form for each service and language. */}
      <TemplateForm
        key={`${service}-${locale}`}
        service={service}
        locale={locale}
        initial={current ? { title: current.title, body: current.body } : { title: '', body: '' }}
      />
    </div>
  );
}

function TemplateForm({
  service,
  locale,
  initial,
}: {
  service: ServiceType;
  locale: Locale;
  initial: { title: string; body: string };
}): ReactNode {
  const t = useTranslations('Contracts.templates');
  const ids = useId();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const failed = useContractErrors();
  const text = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [previewing, setPreviewing] = useState(false);
  const unknown = unknownBlanks(`${title}\n${body}`);
  const ready = title.trim().length >= 3 && body.trim().length >= 20;

  const save = useMutation(
    trpc.contracts.templates.save.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.contracts.templates.list.queryKey() });
        toast.add({ title: t('saved'), type: 'success' });
      },
      onError: failed,
    }),
  );

  /** The blank where the cursor is, as `{name}`. */
  const insert = (blank: string) => {
    const element = text.current;
    const at = element?.selectionStart ?? body.length;
    const next = `${body.slice(0, at)}{${blank}}${body.slice(element?.selectionEnd ?? at)}`;
    setBody(next);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(at + blank.length + 2, at + blank.length + 2);
    });
  };

  const preview = async () => {
    // Opened now, on the click, so the browser doesn't block it as a pop-up.
    const tab = window.open('', '_blank');
    setPreviewing(true);
    try {
      const response = await fetch('/api/contracts/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, title: title.trim(), body: body.trim() }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const url = URL.createObjectURL(await response.blob());
      if (tab) tab.location.href = url;
      else window.open(url, '_blank');
    } catch {
      tab?.close();
      toast.add({ title: t('previewFailed'), type: 'error' });
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <form
      className="grid grid-cols-1 gap-4 rounded-2xl border border-fog-light bg-white p-5 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) save.mutate({ service, locale, title: title.trim(), body: body.trim() });
      }}
    >
      <label htmlFor={`${ids}-title`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep">
        {t('titleLabel')}
        <input
          id={`${ids}-title`}
          required={true}
          minLength={3}
          maxLength={TITLE_MAX}
          value={title}
          placeholder={t('titlePlaceholder')}
          onChange={(event) => setTitle(event.target.value)}
          className={field}
        />
      </label>

      <div className="grid grid-cols-1 gap-2">
        <p className="text-sm font-semibold text-navy-deep">{t('blanks')}</p>
        <ul className="flex flex-wrap gap-2">
          {CONTRACT_BLANKS.map((blank) => (
            <li key={blank}>
              <button
                type="button"
                onClick={() => insert(blank)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-off-white px-3 text-xs text-navy-deep hover:bg-ice-blue"
              >
                <code className="font-semibold">{`{${blank}}`}</code>
                <span className="text-slate">{t(`blank.${blank}`)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <label htmlFor={`${ids}-body`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep">
        {t('text')}
        <textarea
          ref={text}
          id={`${ids}-body`}
          rows={22}
          required={true}
          minLength={20}
          maxLength={BODY_MAX}
          value={body}
          aria-describedby={`${ids}-format`}
          onChange={(event) => setBody(event.target.value)}
          className="w-full rounded-xl border-2 border-fog-light bg-white px-3.5 py-2.5 font-mono text-sm font-normal text-navy-deep focus:border-navy-deep focus:outline-none"
        />
        <span id={`${ids}-format`} className="text-xs font-normal text-slate">
          {t('format')}
        </span>
      </label>

      {unknown.length > 0 ? (
        <p role="status" className="rounded-xl bg-honey-tint px-4 py-2 text-sm text-honey">
          {t('unknown', { list: unknown.map((name) => `{${name}}`).join(', ') })}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={!ready || previewing}
          onClick={preview}
          className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white disabled:opacity-50"
        >
          <Eye aria-hidden={true} className="size-4" />
          {previewing ? t('previewing') : t('preview')}
        </button>
        <button
          type="submit"
          disabled={!ready || save.isPending}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
        >
          <Save aria-hidden={true} className="size-4" />
          {save.isPending ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  );
}

function TemplatesSkeleton(): ReactNode {
  const t = useTranslations('Contracts.templates');
  return (
    <div role="status" className="grid grid-cols-1 gap-4">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-10 w-full rounded-full" />
      <Skeleton aria-hidden={true} className="h-96 rounded-2xl" />
    </div>
  );
}
