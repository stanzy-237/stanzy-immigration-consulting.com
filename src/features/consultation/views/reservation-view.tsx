'use client';

import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, ShieldCheck } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useCurrentAccount } from '@/features/auth/hooks/use-current-account';
import { ContactStep, SignInAside, type Contact } from '@/features/consultation/components/contact-step';
import { PaymentConfirmed } from '@/features/consultation/components/payment-confirmed';
import { PaymentProgress, paymentScreen } from '@/features/consultation/components/payment-progress';
import { PaymentStep, sentMethod, type FeeLine, type PayMethod } from '@/features/consultation/components/payment-step';
import { PrepareStep, useAnswersSummary, type Answers } from '@/features/consultation/components/prepare-step';
import { ReleasedPanel } from '@/features/consultation/components/released-panel';
import { ReservationStep } from '@/features/consultation/components/reservation-step';
import { BookingSummary, HoldTimer } from '@/features/consultation/components/reservation-summary';
import { useBookingRef, type BookingRef } from '@/features/consultation/hooks/use-booking-ref';
import { useHoldCountdown } from '@/features/consultation/hooks/use-hold-countdown';
import { countries } from '@/features/consultation/lib/countries';
import { LABEL_CLASS } from '@/features/consultation/lib/styles';
import { SiteNav } from '@/features/landing/components/site-nav';
import { Link, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Step = 1 | 2 | 3;

/**
 * « Finalisez votre réservation » (#15, docs/design/consultation.md, Booking):
 * 1 Vos coordonnées holds the chosen slot 15 minutes, 2 Préparer l'échange,
 * 3 Paiement. Desktop: the three steps stacked beside the summary; mobile:
 * one step per screen under a progress bar. The slot comes from the address
 * (`?creneau=`), the held booking from this tab (or, signed in, the Compte).
 */
export function ReservationView(): ReactNode {
  return (
    <MotionConfig reducedMotion="user">
      <div className="hidden lg:block">
        <SiteNav />
      </div>
      <main className="flex min-h-dvh flex-col bg-white lg:bg-off-white">
        <QueryBoundary fallback={<ReservationSkeleton />}>
          <Reservation />
        </QueryBoundary>
      </main>
    </MotionConfig>
  );
}

function Reservation(): ReactNode {
  const t = useTranslations('Consultation.reservation');
  const trpc = useTRPC();
  const creneau = useSearchParams()?.get('creneau') ?? null;
  const [ref, setRef] = useBookingRef();
  const { account, pending: accountPending } = useCurrentAccount();
  const { data: slots } = useSuspenseQuery(trpc.consultation.slots.queryOptions());

  // Signed in with nothing in this tab (back from the verification link): the Compte's held booking.
  const current = useQuery({ ...trpc.consultation.current.queryOptions(), enabled: !ref && Boolean(account) });
  useEffect(() => {
    if (!ref && current.data) setRef({ id: current.data.id });
  }, [ref, current.data, setRef]);

  const booking = useQuery({ ...trpc.consultation.booking.queryOptions(ref ?? { id: '' }), enabled: Boolean(ref), retry: false });
  // A booking this tab can no longer open (another Compte signed in, or gone): forget it.
  useEffect(() => {
    if (ref && booking.isError) setRef(null);
  }, [ref, booking.isError, setRef]);

  if (accountPending || (ref && booking.isPending) || (!ref && account && current.isPending)) return <ReservationSkeleton />;

  const held = booking.data;
  const chosenElsewhere = creneau && held && new Date(creneau).getTime() !== new Date(held.startsAt).getTime();

  // A slot to hold: new, or « Changer » from a booking this tab held.
  if (creneau && (!held || chosenElsewhere)) {
    const start = new Date(creneau);
    return (
      <Layout
        step={1}
        startsAt={start}
        durationMinutes={slots.durationMinutes}
        price={slots.price}
        heldUntil={null}
      >
        <ReservationStep number={1} title={t('contact.title')} state="open" aside={account ? null : <SignInAside start={start} />}>
          <ContactStep
            start={start}
            signedIn={Boolean(account)}
            initial={held ? held.contact : { name: account?.name, email: account?.email }}
            previous={held ? ref : null}
            onHeld={setRef}
            onSaved={() => undefined}
          />
        </ReservationStep>
        <ReservationStep number={2} title={t('prepare.title')} state="closed" />
        <ReservationStep number={3} title={t('payment.title')} state="closed" />
      </Layout>
    );
  }

  if (!held || !ref) return <MissingSlot />;
  return <HeldBooking booking={held} bookingRef={ref} onRef={setRef} />;
}

type Held = RouterOutputs['consultation']['booking'];

/** A payment this page follows: its id and, when this tab started it, how (to try again the same way). */
type Following = { paymentId: string; method: PayMethod | null };

/**
 * A held booking: step 1 done, then 2 Préparer l'échange and 3 Paiement;
 * « libéré » once the hold runs out unpaid. Once « Payer » is pressed the
 * page follows that payment until SasPay answers; paid, it becomes
 * `6 Confirmée`. A reload finds the latest payment again.
 */
function HeldBooking({ booking, bookingRef, onRef }: { booking: Held; bookingRef: BookingRef; onRef: (ref: BookingRef) => void }): ReactNode {
  const t = useTranslations('Consultation.reservation');
  const locale = useLocale();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const latest = booking.payment;
  const [following, setFollowing] = useState<Following | null>(() =>
    latest && (latest.status !== 'FAILED' || booking.status === 'PAID') ? { paymentId: latest.id, method: null } : null,
  );
  const [step, setStep] = useState<Step>(following ? 3 : 2);
  const [editing, setEditing] = useState(false);
  const [fee, setFee] = useState<FeeLine | null>(null);
  const onFee = useCallback((line: FeeLine | null) => setFee(line), []);
  const startsAt = new Date(booking.startsAt);
  const heldUntil = booking.heldUntil ? new Date(booking.heldUntil) : null;
  const { over } = useHoldCountdown(heldUntil);
  const released = booking.status !== 'PAID' && (!booking.held || over) && !following;
  const countryName = countries(locale).find((c) => c.code === booking.contact.country)?.name ?? booking.contact.country;
  const answers: Answers = booking.answers;
  const prepared = useAnswersSummary(answers);
  const contact: Contact = booking.contact;
  const contactLine = t('contact.summary', { name: contact.name, country: countryName, email: contact.email, phone: contact.phone });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: trpc.consultation.booking.queryKey(bookingRef) });

  const frame = (children: ReactNode) => (
    <Layout
      step={editing ? 1 : step}
      startsAt={startsAt}
      durationMinutes={booking.durationMinutes}
      price={booking.price}
      fee={fee}
      heldUntil={heldUntil}
      released={released}
      onBack={step === 3 && !editing && !following ? () => setStep(2) : editing ? () => setEditing(false) : undefined}
    >
      {editing && !released ? (
        <ReservationStep number={1} title={t('contact.title')} state="open">
          <ContactStep
            start={startsAt}
            signedIn={true}
            booking={bookingRef}
            initial={contact}
            onHeld={onRef}
            onSaved={() => {
              refresh();
              setEditing(false);
            }}
          />
        </ReservationStep>
      ) : (
        <ReservationStep
          number={1}
          title={t('contact.title')}
          state="done"
          summary={contactLine}
          onEdit={released || following ? undefined : () => setEditing(true)}
        />
      )}
      {children}
    </Layout>
  );

  if (following) {
    return (
      <QueryBoundary fallback={frame(<ReservationStep number={3} title={t('payment.title')} state="open"><PaymentLoading /></ReservationStep>)}>
        <PaymentFollow
          bookingRef={bookingRef}
          following={following}
          heldUntil={heldUntil}
          frame={(panel, title) =>
            frame(
              <>
                <ReservationStep number={2} title={t('prepare.title')} state="done" summary={prepared} />
                <ReservationStep number={3} title={title} state="open">
                  {panel}
                </ReservationStep>
              </>,
            )
          }
          onFollow={setFollowing}
          onChangeMethod={() => {
            setFollowing(null);
            refresh();
          }}
        />
      </QueryBoundary>
    );
  }

  return frame(
    released ? (
      <ReleasedPanel
        previous={bookingRef}
        contact={contact}
        onHeld={(next, start) => {
          onRef(next);
          router.replace({ pathname: '/services/consultation/reserver', query: { creneau: start } });
        }}
      />
    ) : (
      <>
        {step === 2 && !editing ? (
          <ReservationStep number={2} title={t('prepare.title')} state="open">
            <PrepareStep
              booking={bookingRef}
              initial={answers}
              onSaved={() => {
                refresh();
                setStep(3);
              }}
              onExpired={refresh}
            />
          </ReservationStep>
        ) : (
          <ReservationStep
            number={2}
            title={t('prepare.title')}
            state={step > 2 ? 'done' : 'closed'}
            summary={prepared}
            onEdit={step > 2 && !editing ? () => setStep(2) : undefined}
          />
        )}
        {step === 3 && !editing ? (
          <ReservationStep number={3} title={t('payment.title')} state="open">
            <PaymentStep
              bookingRef={bookingRef}
              contact={contact}
              heldUntil={heldUntil}
              onFee={onFee}
              onExpired={refresh}
              onStarted={(paymentId, method) => {
                setFollowing({ paymentId, method });
                refresh();
              }}
            />
          </ReservationStep>
        ) : (
          <ReservationStep number={3} title={t('payment.title')} state="closed" />
        )}
      </>
    ),
  );
}

/** While PENDING, the page asks again every few seconds; the server asks SasPay at most that often. */
const POLL_MS = 3000;

/**
 * One payment followed: `Paiement v2` 1–5 inside step 3 until SasPay answers,
 * then `6 Confirmée` in place of the whole page.
 */
function PaymentFollow({
  bookingRef,
  following,
  heldUntil,
  frame,
  onFollow,
  onChangeMethod,
}: {
  bookingRef: BookingRef;
  following: Following;
  heldUntil: Date | null;
  frame: (panel: ReactNode, title: string) => ReactNode;
  onFollow: (following: Following) => void;
  onChangeMethod: () => void;
}): ReactNode {
  const t = useTranslations('Consultation.reservation');
  const locale = useLocale();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const input = { ...bookingRef, paymentId: following.paymentId };
  const { data: payment } = useSuspenseQuery({
    ...trpc.consultation.payment.queryOptions(input),
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? POLL_MS : false),
  });
  const pay = useMutation(trpc.consultation.pay.mutationOptions());
  const check = useMutation({
    mutationFn: () => queryClient.fetchQuery(trpc.consultation.payment.queryOptions({ ...input, force: true })),
    onSuccess: (fresh) => queryClient.setQueryData(trpc.consultation.payment.queryKey(input), fresh),
  });

  if (payment.status === 'SUCCESS' && payment.consultation) return <PaymentConfirmed payment={payment} />;

  // The same way again, unless a one-time code must be typed again.
  const method = following.method;
  const retry =
    method && !(method.kind === 'network' && method.otp)
      ? async () => {
          try {
            const started = await pay.mutateAsync({ ...bookingRef, locale: locale === 'en' ? 'en' : 'fr', method: sentMethod(method) });
            if (started.checkoutUrl) window.open(started.checkoutUrl, '_blank', 'noopener');
            onFollow({ paymentId: started.paymentId, method });
          } catch {
            toast.add({ title: t('toast.error'), type: 'error' });
          }
        }
      : undefined;

  const held = payment.heldUntil ? new Date(payment.heldUntil) : heldUntil;
  return frame(
    <PaymentProgress
      payment={payment}
      screen={paymentScreen(payment)}
      heldUntil={held}
      onRetry={retry}
      onChangeMethod={onChangeMethod}
      onCheckNow={() => check.mutate()}
      checking={check.isPending}
    />,
    payment.networkName ? t('payment.titleWith', { network: payment.networkName }) : t('payment.title'),
  );
}

/** Step 3 while the payment is looked up. */
function PaymentLoading(): ReactNode {
  return (
    <div aria-hidden={true} className="flex flex-col gap-6">
      <Skeleton className="h-44 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
    </div>
  );
}

/**
 * The page around the steps. Desktop: back link, title, steps on the left,
 * the hold timer and summary on the right. Mobile: back button, timer pill
 * and progress bar on top, « Étape N sur 3 », then the step as its own screen.
 */
function Layout({
  step,
  startsAt,
  durationMinutes,
  price,
  fee = null,
  heldUntil,
  released = false,
  onBack,
  children,
}: {
  step: Step;
  startsAt: Date;
  durationMinutes: number;
  price: number | null;
  fee?: FeeLine | null;
  heldUntil: Date | null;
  released?: boolean;
  /** Mobile back: the previous step; else back to the Consultation page. */
  onBack?: () => void;
  children: ReactNode;
}): ReactNode {
  const t = useTranslations('Consultation.reservation');
  const tSummary = useTranslations('Consultation.reservation.summary');

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 pt-1 pb-8.5 lg:px-7 lg:pt-10 lg:pb-20">
      {/* Mobile head. */}
      <div className="sticky top-0 z-10 -mx-5 flex flex-col gap-3.5 bg-white px-5 pt-4 pb-1 lg:hidden">
        <div className="flex items-center justify-between">
          {onBack ? (
            <button type="button" onClick={onBack} aria-label={t('back')} className="flex size-10 items-center justify-center rounded-full border border-fog-light">
              <ChevronLeft aria-hidden={true} className="size-4.5 text-ink" strokeWidth={2.2} />
            </button>
          ) : (
            <Link href="/services/consultation" aria-label={t('back')} className="flex size-10 items-center justify-center rounded-full border border-fog-light">
              <ChevronLeft aria-hidden={true} className="size-4.5 text-ink" strokeWidth={2.2} />
            </Link>
          )}
          <HoldTimer heldUntil={heldUntil} startsAt={startsAt} compact={true} />
        </div>
        <div aria-hidden={true} className="flex gap-1.5">
          {[1, 2, 3].map((n) => (
            <span key={n} className="relative h-1 flex-1 overflow-hidden rounded-full bg-fog-light">
              <span
                className={cn('absolute inset-0 origin-left rounded-full bg-rouge transition-transform duration-300 ease-out-expo', n <= step ? 'scale-x-100' : 'scale-x-0')}
              />
            </span>
          ))}
        </div>
      </div>
      <p className={cn(LABEL_CLASS, 'pt-7 pb-2 text-rouge lg:hidden')}>{t('stepOf', { step })}</p>

      {/* Desktop head. */}
      <Link href="/services/consultation" className="hidden items-center gap-2 self-start text-body-sm font-semibold text-ink lg:flex">
        <ArrowLeft aria-hidden={true} className="size-4" strokeWidth={2.2} />
        {t('back')}
      </Link>
      <h1 className="sr-only font-heading text-h2 leading-tight font-extrabold tracking-tight text-ink lg:not-sr-only lg:pt-4 lg:pb-8">{t('title')}</h1>

      <div className="flex flex-1 flex-col lg:flex-row lg:items-start lg:gap-12">
        <div className="flex flex-1 flex-col gap-4">{children}</div>
        <aside className="hidden w-105 shrink-0 flex-col gap-3 lg:flex">
          <HoldTimer heldUntil={heldUntil} startsAt={startsAt} />
          <BookingSummary startsAt={startsAt} durationMinutes={durationMinutes} price={price} fee={fee} released={released} />
          <p className="flex items-center justify-center gap-2 pt-1 text-caption leading-4 text-slate">
            <ShieldCheck aria-hidden={true} className="size-3.5" strokeWidth={2.2} />
            {tSummary('secured')}
          </p>
        </aside>
      </div>
    </div>
  );
}

/** No slot in the address and nothing held: back to the slots. */
function MissingSlot(): ReactNode {
  const t = useTranslations('Consultation.reservation.missing');
  return (
    <div className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-4 px-5 py-20 text-center">
      <h1 className="font-heading text-h3 leading-8.5 font-extrabold tracking-tight text-ink">{t('title')}</h1>
      <p className="text-body leading-6 text-slate">{t('lead')}</p>
      <Link href="/services/consultation" className="flex h-12 items-center rounded-full bg-rouge px-7 font-heading text-body font-bold text-white">
        {t('cta')}
      </Link>
    </div>
  );
}

/** The page's shape while the booking loads. */
function ReservationSkeleton(): ReactNode {
  const t = useTranslations('Consultation.reservation');
  return (
    <div role="status" className="mx-auto flex w-full max-w-7xl animate-skeleton-in flex-col gap-4 px-5 pt-6 lg:px-7 lg:pt-10">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-10 w-full rounded-full lg:h-4 lg:w-32" />
      <Skeleton aria-hidden={true} className="h-9 w-64 lg:h-11 lg:w-160" />
      <div aria-hidden={true} className="flex gap-12 pt-4">
        <div className="flex flex-1 flex-col gap-4">
          <Skeleton className="h-130 rounded-3xl" />
          <Skeleton className="hidden h-20 rounded-3xl lg:block" />
          <Skeleton className="hidden h-20 rounded-3xl lg:block" />
        </div>
        <Skeleton className="hidden h-120 w-105 shrink-0 rounded-3xl lg:block" />
      </div>
    </div>
  );
}
