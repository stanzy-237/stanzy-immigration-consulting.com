'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { Check, Info, Plus, Trash2, X } from 'lucide-react';
import { useFormatter, useLocale, useNow, useTranslations } from 'next-intl';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useReduction } from '@/features/consultation/components/promo-field';
import { discountFor, normalizeCode, PROMO_SERVICES, type PromoService } from '@/features/consultation/lib/promo';
import { fcfa } from '@/features/consultation/lib/slot-format';
import { LABEL_CLASS, PRESS } from '@/features/consultation/lib/styles';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Listing = RouterOutputs['promoCodes']['list'];
type Code = Listing['codes'][number];

const DOUALA = 'Africa/Douala';

/**
 * Tableau de bord → Facturation → Codes promo (#15, `Tableau de bord · Codes
 * promo`): the codes with their places used and end, « Nouveau code » beside
 * the list (desktop) or in a sheet (mobile), « Supprimer » after a
 * confirmation. Pages never show a code; it is applied at checkout only.
 */
export function PromoCodesView(): ReactNode {
  const t = useTranslations('Consultation.promoCodes');
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-28 lg:pb-0">
      <div className="flex flex-col gap-2">
        <p className={cn(LABEL_CLASS, 'text-steel-blue lg:hidden')}>{t('eyebrow')}</p>
        <h1 className="font-heading text-h2 leading-11 font-extrabold tracking-tight text-navy-deep lg:text-h1 lg:leading-14">{t('title')}</h1>
        <p className="hidden text-body leading-6 text-slate lg:block">{t('lead')}</p>
      </div>
      <QueryBoundary fallback={<PromoCodesSkeleton />}>
        <PromoCodes />
      </QueryBoundary>
    </div>
  );
}

function PromoCodes(): ReactNode {
  const t = useTranslations('Consultation.promoCodes');
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.promoCodes.list.queryOptions());
  const [sheet, setSheet] = useState(false);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex flex-1 flex-col gap-4">
        {data.codes.length === 0 ? (
          <p className="rounded-3xl border border-fog-light bg-white p-8 text-center text-body-sm leading-5 text-slate">{t('empty')}</p>
        ) : (
          <section aria-label={t('listLabel')} className="flex flex-col gap-4 lg:gap-0 lg:overflow-hidden lg:rounded-3xl lg:border lg:border-fog-light lg:bg-white">
            <div className={cn(LABEL_CLASS, 'hidden grid-cols-12 gap-4 border-b border-fog-light px-5 py-4 text-slate lg:grid')}>
              <span className="col-span-5">{t('columns.code')}</span>
              <span className="col-span-3">{t('columns.used')}</span>
              <span className="col-span-4">{t('columns.end')}</span>
            </div>
            <ul className="flex flex-col gap-4 lg:gap-0 lg:divide-y lg:divide-fog-light">
              {data.codes.map((code) => (
                <CodeRow key={code.id} code={code} />
              ))}
            </ul>
          </section>
        )}
        <p className="flex gap-3 text-caption leading-5 text-slate lg:rounded-b-3xl lg:bg-off-white lg:px-5 lg:py-4">
          <Info aria-hidden={true} className="mt-0.5 hidden size-4 shrink-0 lg:block" strokeWidth={2} />
          {t('note')}
        </p>
      </div>

      {/* Desktop: the form beside the list. */}
      <section aria-labelledby="new-code" className="hidden w-100 shrink-0 rounded-3xl border border-fog-light bg-white p-6 lg:block">
        <h2 id="new-code" className="pb-5 font-heading text-h4 font-bold text-navy-deep">
          {t('form.title')}
        </h2>
        <NewCodeForm price={data.consultationPrice} />
      </section>

      {/* Mobile: « + Nouveau code » in the bottom bar opens the sheet. */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2 border-t border-fog-light bg-white px-5 pt-4 pb-6 lg:hidden">
        <button
          type="button"
          onClick={() => setSheet(true)}
          className={cn('flex h-14 items-center justify-center gap-2 rounded-full bg-rouge font-heading text-body font-bold text-white', PRESS)}
        >
          <Plus aria-hidden={true} className="size-4.5" strokeWidth={2.5} />
          {t('new')}
        </button>
        <p className="text-center text-caption leading-4 text-slate">{t('lead')}</p>
      </div>
      <Drawer open={sheet} onOpenChange={setSheet} showSwipeHandle={true}>
        <DrawerContent className="max-h-dvh overflow-y-auto rounded-t-3xl px-5 pt-2 pb-8 lg:hidden">
          <div className="flex items-center justify-between py-4">
            <DrawerTitle className="font-heading text-h4 font-bold text-navy-deep">{t('form.title')}</DrawerTitle>
            <DrawerClose aria-label={t('form.close')} className="flex size-9 items-center justify-center rounded-full bg-off-white">
              <X aria-hidden={true} className="size-4 text-ink" strokeWidth={2.5} />
            </DrawerClose>
          </div>
          <NewCodeForm price={data.consultationPrice} onDone={() => setSheet(false)} />
        </DrawerContent>
      </Drawer>
    </div>
  );
}

const STATUS_CLASS: Record<Code['status'], string> = {
  ACTIVE: 'bg-leaf-tint text-leaf',
  SOLD_OUT: 'bg-honey-tint text-honey',
  ENDED: 'bg-fog-light text-slate',
};

/** One code: its text and status, reduction and services, places used with a bar, its end, « Supprimer ». */
function CodeRow({ code }: { code: Code }): ReactNode {
  const t = useTranslations('Consultation.promoCodes');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const reduction = useReduction();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation(
    trpc.promoCodes.remove.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.promoCodes.list.queryKey() });
        toast.add({ title: t('deleted', { code: code.code }), type: 'success' });
      },
      onError: () => toast.add({ title: t('error'), type: 'error' }),
    }),
  );
  const live = code.status === 'ACTIVE';
  const share = code.places ? Math.min(1, code.used / code.places) : 0;
  const services = code.services.map((s) => t(`services.${s as PromoService}`)).join(', ');
  const end = code.endsAt ? new Date(code.endsAt) : null;
  const endLabel = end
    ? format.dateTime(end, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: DOUALA })
    : t('noEnd');
  const endNote = end ? (end > now ? t('endIn', { relative: format.relativeTime(end, now) }) : t('ended')) : code.status === 'SOLD_OUT' ? t('limitReached') : null;

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-fog-light bg-white p-5 lg:grid lg:grid-cols-12 lg:items-center lg:gap-4 lg:rounded-none lg:border-0 lg:px-5 lg:py-4">
      <div className="flex items-start justify-between gap-3 lg:col-span-5 lg:flex-col lg:gap-1">
        <div className="flex flex-col gap-1">
          <p className={cn('font-heading text-h4 leading-6 font-extrabold tracking-wide', live ? 'text-navy-deep' : 'text-slate')}>{code.code}</p>
          <p className="flex items-center gap-2 text-caption leading-4 text-slate">
            <span className={cn('rounded-full px-2 py-0.5 font-label font-bold', STATUS_CLASS[code.status])}>{t(`status.${code.status}`)}</span>
            {reduction(code)} · {services}
          </p>
        </div>
        <p className="font-heading text-body font-extrabold text-ink tabular-nums lg:hidden">
          {code.places === null ? t('usedOnly', { used: code.used }) : `${code.used} / ${code.places}`}
        </p>
      </div>

      <div className="flex flex-col gap-2 lg:col-span-3">
        <p className="hidden text-body-sm leading-5 font-bold text-ink tabular-nums lg:block">
          {code.places === null ? t('usedOnly', { used: code.used }) : `${code.used} / ${code.places}`}
        </p>
        {code.places !== null ? (
          <span
            role="meter"
            aria-label={t('placesUsed')}
            aria-valuemin={0}
            aria-valuemax={code.places}
            aria-valuenow={code.used}
            className="relative h-1.5 overflow-hidden rounded-full bg-fog-light"
          >
            <span className={cn('absolute inset-0 origin-left rounded-full', live ? 'bg-rouge' : 'bg-fog')} style={{ transform: `scaleX(${share})` }} />
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 lg:col-span-4">
        <div className="flex flex-col gap-0.5 text-caption leading-4 text-slate lg:text-body-sm lg:leading-5">
          <span className="font-semibold text-ink first-letter:uppercase">{endLabel}</span>
          {endNote ? <span>{end ? `${t('douala')} · ${endNote}` : endNote}</span> : null}
        </div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={t('delete', { code: code.code })}
          className="shrink-0 text-body-sm font-bold text-rouge lg:flex lg:size-9 lg:items-center lg:justify-center lg:rounded-lg lg:border lg:border-fog-light"
        >
          <span className="lg:hidden">{t('deleteShort')}</span>
          <Trash2 aria-hidden={true} className="hidden size-4 lg:block" strokeWidth={2.2} />
        </button>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="gap-5 p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-h4 font-bold text-navy-deep">{t('confirm.title', { code: code.code })}</AlertDialogTitle>
            <AlertDialogDescription className="text-body-sm text-slate">{t('confirm.text')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">{t('confirm.cancel')}</AlertDialogCancel>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                remove.mutate({ id: code.id });
              }}
              className="rounded-full bg-rouge px-5 py-2 text-body-sm font-semibold text-white hover:bg-crimson"
            >
              {t('confirm.delete')}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

/** `datetime-local` in Douala time (UTC+1, no summer time) → the instant. */
const doualaToDate = (value: string): Date | null => (value ? new Date(`${value}:00+01:00`) : null);

type FormError = 'code' | 'value' | 'percent' | 'services' | 'taken';

/** « Nouveau code »: text, % or FCFA, services, places, end (Douala), « Une seule fois par Compte », the price it gives. */
function NewCodeForm({ price, onDone }: { price: number | null; onDone?: () => void }): ReactNode {
  const t = useTranslations('Consultation.promoCodes.form');
  const tCodes = useTranslations('Consultation.promoCodes');
  const locale = useLocale();
  const id = useId();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [type, setType] = useState<'PERCENT' | 'AMOUNT'>('PERCENT');
  const [value, setValue] = useState('');
  const [services, setServices] = useState<PromoService[]>(['CONSULTATION']);
  const [places, setPlaces] = useState('');
  const [end, setEnd] = useState('');
  const [once, setOnce] = useState(true);
  const [error, setError] = useState<FormError | null>(null);

  const create = useMutation(trpc.promoCodes.create.mutationOptions());
  const amount = Number.parseInt(value, 10);
  const preview =
    price !== null && services.includes('CONSULTATION') && Number.isFinite(amount) && amount > 0
      ? price - discountFor(price, { reductionType: type, reductionValue: amount })
      : null;

  const reset = () => {
    setCode('');
    setValue('');
    setPlaces('');
    setEnd('');
    setServices(['CONSULTATION']);
    setOnce(true);
    setError(null);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const text = normalizeCode(code);
    if (text.length < 3) return setError('code');
    if (!Number.isFinite(amount) || amount <= 0) return setError('value');
    if (type === 'PERCENT' && amount > 99) return setError('percent');
    if (services.length === 0) return setError('services');
    const count = Number.parseInt(places, 10);
    try {
      await create.mutateAsync({
        code: text,
        reductionType: type,
        reductionValue: amount,
        services,
        places: Number.isFinite(count) && count > 0 ? count : null,
        endsAt: doualaToDate(end),
        oncePerAccount: once,
      });
      await queryClient.invalidateQueries({ queryKey: trpc.promoCodes.list.queryKey() });
      toast.add({ title: tCodes('created', { code: text }), type: 'success' });
      reset();
      onDone?.();
    } catch (failure) {
      if (failure instanceof TRPCClientError && failure.message === 'PROMO_TAKEN') return setError('taken');
      toast.add({ title: tCodes('error'), type: 'error' });
    }
  }

  const label = 'text-body-sm leading-5 font-semibold text-ink';
  const input = 'h-12 w-full rounded-xl border border-fog bg-white px-4 text-body text-ink outline-none focus:border-2 focus:border-navy-deep';
  const hint = (key: FormError) =>
    error === key ? (
      <p role="alert" className="text-caption leading-4 font-semibold text-rouge">
        {t(`errors.${key}`)}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-code`} className={label}>
          {t('code')}
        </label>
        <input
          id={`${id}-code`}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoComplete="off"
          spellCheck={false}
          placeholder="BLACKFRIDAY"
          aria-invalid={error === 'code' || error === 'taken'}
          className={cn(input, 'h-14 border-2 border-navy-deep font-heading font-bold tracking-wide uppercase placeholder:text-slate-mute')}
        />
        {hint('code') ?? hint('taken')}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={cn(label, 'mb-2')}>{t('reduction')}</legend>
        <div className="flex gap-2">
          <div className="flex h-12 shrink-0 gap-1 rounded-xl bg-ice-blue p-1">
            {(['PERCENT', 'AMOUNT'] as const).map((kind) => (
              <label
                key={kind}
                className={cn(
                  'flex cursor-pointer items-center rounded-lg px-3.5 text-body-sm font-bold has-focus-visible:ring-2 has-focus-visible:ring-navy-deep',
                  type === kind ? 'bg-white text-ink shadow-sm' : 'text-slate',
                )}
              >
                <input type="radio" name={`${id}-type`} checked={type === kind} onChange={() => setType(kind)} className="sr-only" />
                {kind === 'PERCENT' ? '%' : 'FCFA'}
              </label>
            ))}
          </div>
          <label htmlFor={`${id}-value`} className="sr-only">
            {type === 'PERCENT' ? t('percent') : t('amount')}
          </label>
          <input
            id={`${id}-value`}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
            aria-invalid={error === 'value' || error === 'percent'}
            className={input}
          />
        </div>
        {hint('value') ?? hint('percent')}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className={cn(label, 'mb-2')}>{t('services')}</legend>
        <div className="flex flex-wrap gap-2">
          {PROMO_SERVICES.map((service) => {
            const on = services.includes(service);
            return (
              <button
                key={service}
                type="button"
                aria-pressed={on}
                onClick={() => setServices((all) => (on ? all.filter((s) => s !== service) : [...all, service]))}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-caption font-bold',
                  on ? 'border-2 border-navy-deep bg-ice-blue text-ink' : 'border border-fog text-ink',
                  PRESS,
                )}
              >
                {on ? <Check aria-hidden={true} className="size-3" strokeWidth={3} /> : null}
                {tCodes(`services.${service}`)}
              </button>
            );
          })}
        </div>
        {hint('services')}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-places`} className={label}>
            {t('places')}
          </label>
          <input
            id={`${id}-places`}
            inputMode="numeric"
            value={places}
            placeholder={t('noLimit')}
            onChange={(e) => setPlaces(e.target.value.replace(/\D/g, ''))}
            className={cn(input, 'placeholder:text-slate-mute')}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-end`} className={label}>
            {t('end')}
          </label>
          <input id={`${id}-end`} type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} aria-describedby={`${id}-end-hint`} className={cn(input, 'px-3')} />
          <p id={`${id}-end-hint`} className="text-caption leading-4 text-slate">
            {t('endHint')}
          </p>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3 text-body-sm leading-5 text-ink">
        <input type="checkbox" checked={once} onChange={(e) => setOnce(e.target.checked)} className="size-5 accent-navy-deep" />
        {t('once')}
      </label>

      {preview !== null && price !== null ? (
        <p className="flex items-center justify-between gap-3 rounded-xl bg-leaf-tint px-4 py-3 text-body-sm leading-5 text-leaf">
          <span>{t('atCheckout')}</span>
          <span>
            <span className="line-through">{fcfa(price, locale).replace(' FCFA', '')}</span> <b className="font-bold">{fcfa(preview, locale)}</b> {t('plusFees')}
          </span>
        </p>
      ) : null}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => (onDone ? onDone() : reset())} className={cn('h-12 rounded-full border border-fog px-6 font-heading text-body-sm font-bold text-ink', PRESS)}>
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={create.isPending}
          className={cn('h-12 flex-1 rounded-full bg-leaf px-6 font-heading text-body-sm font-bold text-white disabled:opacity-60 lg:flex-none', PRESS)}
        >
          {t('create')}
        </button>
      </div>
    </form>
  );
}

function PromoCodesSkeleton(): ReactNode {
  const t = useTranslations('Consultation.promoCodes');
  return (
    <div role="status" className="flex animate-skeleton-in flex-col gap-6 lg:flex-row">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-72 flex-1 rounded-3xl" />
      <Skeleton aria-hidden={true} className="hidden h-150 w-100 rounded-3xl lg:block" />
    </div>
  );
}
