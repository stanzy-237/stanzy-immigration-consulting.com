'use client';

import { useMutation } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';

import { toast } from '@/components/ui/toast';
import { SlotChip } from '@/features/consultation/components/reservation-summary';
import type { BookingRef } from '@/features/consultation/hooks/use-booking-ref';
import { toE164 } from '@/features/consultation/lib/booking';
import { countries } from '@/features/consultation/lib/countries';
import { LABEL_CLASS, PRESS } from '@/features/consultation/lib/styles';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

export type Contact = { name: string; email: string; country: string; phone: string; whatsappReminders: boolean };

type ErrorKey = 'name' | 'email' | 'phone' | 'accountExists' | 'slotTaken';

/** The page a sign-in brings back to: this booking, at this slot. */
const backHere = (start: string) => `/services/consultation/reserver?creneau=${encodeURIComponent(start)}`;

const field = 'flex flex-col gap-0.5 px-4 py-2.5 lg:gap-2 lg:p-0';
const label = 'text-caption leading-4 text-slate lg:text-body-sm lg:leading-5 lg:font-semibold lg:text-ink';
const input =
  'h-6 w-full bg-transparent text-body leading-5.5 text-ink outline-none placeholder:text-slate-mute disabled:text-slate lg:h-12 lg:rounded-lg lg:border lg:border-fog lg:bg-white lg:px-4 lg:focus:border-2 lg:focus:border-navy-deep';

/**
 * Step 1, Vos coordonnées (docs/design/consultation.md, Booking). New: holds
 * the slot (and, signed out, creates the Compte). Editing (« Modifier »):
 * changes the country, number and reminders of the held booking. A signed-in
 * booker's name and e-mail are their Compte's.
 */
export function ContactStep({
  start,
  initial,
  signedIn,
  booking,
  previous,
  onHeld,
  onSaved,
}: {
  start: Date;
  initial: Partial<Contact>;
  signedIn: boolean;
  /** Editing the held booking. */
  booking?: BookingRef;
  /** « Changer »: the booking this browser held before. */
  previous?: BookingRef | null;
  onHeld: (ref: BookingRef) => void;
  onSaved: () => void;
}): ReactNode {
  const t = useTranslations('Consultation.reservation.contact');
  const tToast = useTranslations('Consultation.reservation.toast');
  const locale = useLocale();
  const trpc = useTRPC();
  const id = useId();
  const list = useMemo(() => countries(locale), [locale]);
  const [first, ...rest] = (initial.name ?? '').split(' ');
  const [firstName, setFirstName] = useState(first ?? '');
  const [lastName, setLastName] = useState(rest.join(' '));
  const [email, setEmail] = useState(initial.email ?? '');
  const [country, setCountry] = useState(initial.country ?? 'CM');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [reminders, setReminders] = useState(initial.whatsappReminders ?? true);
  const [error, setError] = useState<ErrorKey | null>(null);
  const dial = list.find((c) => c.code === country)?.dial ?? '';
  const editing = Boolean(booking);
  const locked = signedIn || editing;

  const onFailure = (failure: unknown) => {
    const message = failure instanceof TRPCClientError ? failure.message : '';
    if (message === 'ACCOUNT_EXISTS') setError('accountExists');
    else if (message === 'SLOT_TAKEN') setError('slotTaken');
    else toast.add({ title: tToast('error'), type: 'error' });
  };
  const book = useMutation(
    trpc.consultation.book.mutationOptions({
      onSuccess: (held) => {
        onHeld({ id: held.id, ...(held.token ? { token: held.token } : {}) });
        toast.add({ title: tToast('held'), type: 'success' });
      },
      onError: onFailure,
    }),
  );
  const update = useMutation(trpc.consultation.contact.mutationOptions({ onSuccess: onSaved, onError: onFailure }));
  const pending = book.isPending || update.isPending;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = `${firstName.trim()} ${lastName.trim()}`.trim();
    // Checked here first: each message sits under its field.
    if (name.length < 2) return setError('name');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('email');
    if (!toE164(phone, country)) return setError('phone');
    setError(null);
    const contact = { name, email: email.trim(), country, phone, whatsappReminders: reminders };
    if (booking) update.mutate({ ...booking, contact });
    else book.mutate({ start: start.toISOString(), contact, locale: locale === 'en' ? 'en' : 'fr', ...(previous ? { previous } : {}) });
  }

  const hint = (key: ErrorKey) =>
    error === key ? (
      <p id={`${id}-${key}`} role="alert" className="text-caption leading-4 text-rouge">
        {t(`errors.${key}`)}
      </p>
    ) : null;

  return (
    <form noValidate onSubmit={submit} className="flex flex-1 flex-col gap-5 lg:gap-6">
      {/* Mobile: the step's own screen head. */}
      <div className="flex flex-col gap-2 lg:hidden">
        <h2 className="font-heading text-h3 leading-8.5 font-extrabold tracking-tight text-ink">{t('mobileTitle')}</h2>
        <p className="text-body leading-6 text-slate">{t('mobileLead')}</p>
        <SlotChip startsAt={start} />
      </div>

      {error === 'accountExists' || error === 'slotTaken' ? (
        <div role="alert" className="flex flex-col gap-2 rounded-xl bg-blush px-4 py-3.5 text-body-sm leading-5 text-ink">
          <p>{t(`errors.${error}`)}</p>
          {error === 'accountExists' ? (
            <Link
              href={{ pathname: '/connexion', query: { next: backHere(start.toISOString()) } }}
              className="self-start font-semibold text-rouge underline underline-offset-2"
            >
              {t('signIn')}
            </Link>
          ) : (
            <Link href="/services/consultation" className="self-start font-semibold text-rouge underline underline-offset-2">
              {t('chooseAnother')}
            </Link>
          )}
        </div>
      ) : null}

      {/* Mobile: one grouped list; desktop: labelled fields. */}
      <div className="flex flex-col divide-y divide-fog-light overflow-hidden rounded-xl border border-fog lg:gap-4 lg:divide-y-0 lg:overflow-visible lg:rounded-none lg:border-0">
        <div className="flex flex-col divide-y divide-fog-light lg:flex-row lg:gap-4 lg:divide-y-0">
          <div className={cn(field, 'lg:flex-1')}>
            <label htmlFor={`${id}-first`} className={label}>
              {t('firstName')}
            </label>
            <input
              id={`${id}-first`}
              autoComplete="given-name"
              value={firstName}
              disabled={locked}
              onChange={(e) => setFirstName(e.target.value)}
              aria-invalid={error === 'name'}
              className={input}
            />
          </div>
          <div className={cn(field, 'lg:flex-1')}>
            <label htmlFor={`${id}-last`} className={label}>
              {t('lastName')}
            </label>
            <input
              id={`${id}-last`}
              autoComplete="family-name"
              value={lastName}
              disabled={locked}
              onChange={(e) => setLastName(e.target.value)}
              aria-invalid={error === 'name'}
              aria-describedby={error === 'name' ? `${id}-name` : undefined}
              className={input}
            />
          </div>
        </div>
        {error === 'name' ? <div className="px-4 py-2 lg:p-0">{hint('name')}</div> : null}

        <div className={field}>
          <label htmlFor={`${id}-country`} className={label}>
            <span className="lg:hidden">{t('countryMobile')}</span>
            <span className="hidden lg:inline">{t('country')}</span>
          </label>
          <div className="relative">
            <select
              id={`${id}-country`}
              autoComplete="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              aria-describedby={`${id}-country-hint`}
              className={cn(input, 'appearance-none pr-8')}
            >
              {list.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden={true} className="pointer-events-none absolute top-1/2 right-0 size-4 -translate-y-1/2 text-slate lg:right-4" strokeWidth={2.2} />
          </div>
          <p id={`${id}-country-hint`} className="hidden text-caption leading-4 text-slate lg:block">
            {t('countryHint')}
          </p>
        </div>

        <div className={cn(field, 'lg:order-last')}>
          <label htmlFor={`${id}-phone`} className={cn(label, 'font-semibold text-ink')}>
            {t('phone')}
          </label>
          <div className="flex items-center gap-2 lg:h-12 lg:gap-3 lg:rounded-lg lg:border lg:border-fog lg:bg-white lg:px-4 lg:focus-within:border-2 lg:focus-within:border-navy-deep">
            <span className="text-body leading-5.5 font-bold text-ink lg:border-r lg:border-fog-light lg:pr-3 lg:font-semibold">{dial}</span>
            <input
              id={`${id}-phone`}
              type="tel"
              autoComplete="tel-national"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={error === 'phone'}
              aria-describedby={error === 'phone' ? `${id}-phone` : undefined}
              className="h-6 w-full bg-transparent text-body leading-5.5 text-ink outline-none placeholder:text-slate-mute"
            />
          </div>
          {hint('phone')}
        </div>

        <div className={field}>
          <label htmlFor={`${id}-email`} className={label}>
            {t('email')}
          </label>
          <input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            placeholder={t('emailPlaceholder')}
            value={email}
            disabled={locked}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error === 'email'}
            aria-describedby={`${id}-email-hint`}
            className={input}
          />
          <p id={`${id}-email-hint`} className="hidden text-caption leading-4 text-slate lg:block">
            {t('emailHint')}
          </p>
          {hint('email')}
        </div>
      </div>

      {/* Reminders: a switch on mobile, a box to tick on desktop. */}
      <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-off-white px-4 py-3.5 lg:gap-2.5 lg:bg-transparent lg:p-0 lg:pt-1">
        <input type="checkbox" checked={reminders} onChange={(e) => setReminders(e.target.checked)} className="peer sr-only" />
        <span aria-hidden={true} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-whatsapp lg:hidden">
          <svg viewBox="0 0 24 24" className="size-4">
            <path d="M5 19l1.2-3.6A7.5 7.5 0 1 1 9 18.3z" fill="none" className="stroke-white" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="flex flex-1 flex-col lg:hidden">
          <span className="text-body-sm leading-5 font-bold text-ink">{t('remindersMobile')}</span>
          <span className="text-caption leading-4 text-slate">{t('remindersMobileHint')}</span>
        </span>
        <span
          aria-hidden={true}
          className={cn(
            'flex h-7 w-12 shrink-0 items-center rounded-full p-0.75 transition-colors duration-200 ease-standard peer-focus-visible:ring-2 peer-focus-visible:ring-navy-deep lg:hidden',
            reminders ? 'justify-end bg-leaf' : 'justify-start bg-fog',
          )}
        >
          <span className="size-5.5 rounded-full bg-white" />
        </span>
        <span
          aria-hidden={true}
          className={cn(
            'hidden size-5 shrink-0 items-center justify-center rounded-sm border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-navy-deep lg:flex',
            reminders ? 'border-navy-deep bg-navy-deep' : 'border-fog bg-white',
          )}
        >
          {reminders ? (
            <svg viewBox="0 0 24 24" className="size-3.5">
              <path d="M5 12.5l4.5 4.5L19 7" fill="none" className="stroke-white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </span>
        <span className="hidden text-body-sm leading-5 text-ink lg:inline">{t('reminders')}</span>
      </label>

      <div className="mt-auto flex flex-col gap-3 pt-4 lg:mt-0 lg:flex-row lg:items-center lg:justify-between lg:pt-1">
        {!signedIn && !editing ? <p className="hidden text-caption leading-4 text-slate lg:block">{t('accountNote')}</p> : <span />}
        <button
          type="submit"
          disabled={pending}
          className={cn(
            'flex h-14 items-center justify-center rounded-full bg-navy-deep px-7 font-heading text-body font-bold text-white disabled:opacity-60 lg:h-12',
            PRESS,
          )}
        >
          {pending ? t('saving') : t('submit')}
        </button>
        {!signedIn && !editing ? (
          <p className="text-center text-body-sm leading-5 text-slate lg:hidden">
            {t('haveAccount')}{' '}
            <Link href={{ pathname: '/connexion', query: { next: backHere(start.toISOString()) } }} className="font-bold text-ink underline underline-offset-2">
              {t('signIn')}
            </Link>
          </p>
        ) : null}
      </div>
      <p className={cn(LABEL_CLASS, 'sr-only')} aria-live="polite">
        {pending ? t('saving') : ''}
      </p>
    </form>
  );
}

/** « Déjà un compte ? Se connecter », beside the open step's title on desktop. */
export function SignInAside({ start }: { start: Date }): ReactNode {
  const t = useTranslations('Consultation.reservation.contact');
  return (
    <p className="text-body-sm leading-5 text-slate">
      {t('haveAccount')}{' '}
      <Link href={{ pathname: '/connexion', query: { next: backHere(start.toISOString()) } }} className="font-semibold text-ink underline underline-offset-2">
        {t('signIn')}
      </Link>
    </p>
  );
}
