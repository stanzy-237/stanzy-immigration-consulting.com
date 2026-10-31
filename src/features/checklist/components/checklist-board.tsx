'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowRight, Check, ClipboardList, ExternalLink, Info, LockKeyhole, PencilLine } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useCurrentAccount } from '@/features/auth/hooks/use-current-account';
import { withNext } from '@/features/auth/lib/safe-next-path';
import { DOCUMENT_GUIDES } from '@/features/checklist/data/document-guides';
import { useCad, usePeopleNames } from '@/features/checklist/hooks/use-checklist-labels';
import { useStoredChecklistAnswers, useStoredReady } from '@/features/checklist/hooks/use-stored-checklist';
import {
  buildChecklist,
  progressOf,
  type ChecklistPerson,
  type ChecklistPiece,
  type ChecklistSlot,
  type Need,
} from '@/features/checklist/lib/build-checklist';
import { checklistFees } from '@/features/checklist/lib/checklist-fees';
import type { ChecklistForm } from '@/features/checklist/lib/checklist-form';
import { GuideBlocks, GuideDialog } from '@/features/shared/components/guide-blocks';
import { Link } from '@/i18n/navigation';
import { toLocale } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

const FORM_PATH = '/outils/checklist';
const LIST_PATH = '/outils/checklist/liste';
const IRCC_DOCUMENTS = {
  fr: 'https://www.canada.ca/fr/immigration-refugies-citoyennete/services/immigrer-canada/entree-express/documents.html',
  en: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents.html',
} as const;

type Toggle = (key: string, ready: boolean) => void;

/** The documents to prepare for the answers given, each with its guide and a « Prêt » tick. */
export function ChecklistBoard(): ReactNode {
  const { account, pending } = useCurrentAccount();
  if (pending) return <ChecklistSkeleton />;
  if (account) {
    return (
      <QueryBoundary fallback={<ChecklistSkeleton />}>
        <SignedInChecklist />
      </QueryBoundary>
    );
  }
  return <VisitorChecklist />;
}

/** A visitor: answers and ticks in this browser, and a way to keep them in an Account. */
function VisitorChecklist(): ReactNode {
  const answers = useStoredChecklistAnswers();
  const [ready, setReady] = useStoredReady();
  if (!answers) return <EmptyChecklist />;
  const toggle: Toggle = (key, on) => setReady(on ? [...ready.filter((k) => k !== key), key] : ready.filter((k) => k !== key));
  return <ChecklistList answers={answers} ready={ready} onToggle={toggle} side={<SignInInvite />} />;
}

/** A User: the Account's answers (or this device's) and ticks, ticked at once and saved behind. */
function SignedInChecklist(): ReactNode {
  const t = useTranslations('Checklist.list');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const key = trpc.checklist.get.queryKey();
  const { data } = useSuspenseQuery(trpc.checklist.get.queryOptions());
  const local = useStoredChecklistAnswers();
  const setReady = useMutation(
    trpc.checklist.setReady.mutationOptions({
      onMutate: async ({ key: item, ready }) => {
        await queryClient.cancelQueries({ queryKey: key });
        const previous = queryClient.getQueryData(key);
        queryClient.setQueryData(key, (old) => {
          const others = (old?.ready ?? []).filter((k) => k !== item);
          return { answers: old?.answers ?? null, ready: ready ? [...others, item] : others };
        });
        return { previous };
      },
      onError: (_error, _input, context) => {
        queryClient.setQueryData(key, context?.previous);
        toast.add({ title: t('toastFailed'), type: 'error' });
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
    }),
  );

  const answers = data?.answers ?? local;
  if (!answers) return <EmptyChecklist />;
  return <ChecklistList answers={answers} ready={data?.ready ?? []} onToggle={(item, ready) => setReady.mutate({ key: item, ready })} />;
}

/**
 * The list, laid out like the calculators: each person's documents and the
 * fees on the left; on the right, sticky, the progress with a link to each
 * person (first on phones).
 */
function ChecklistList({
  answers,
  ready,
  onToggle,
  side,
}: {
  answers: ChecklistForm;
  ready: string[];
  onToggle: Toggle;
  side?: ReactNode;
}): ReactNode {
  const t = useTranslations('Checklist.list');
  const people = useMemo(() => buildChecklist(answers), [answers]);
  const readySet = useMemo(() => new Set(ready), [ready]);

  return (
    <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-3">
      <aside className="space-y-4 lg:sticky-below-nav lg:order-last">
        <ProgressCard people={people} ready={readySet} answers={answers} />
        {side}
      </aside>
      <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
        <p className="flex flex-wrap items-center gap-2 text-caption text-slate">
          <NeedBadge need="mandatory" />
          <NeedBadge need="recommended" />
          <span>{t('legend')}</span>
        </p>
        {people.map((person) => (
          <PersonCard key={person.id} person={person} ready={readySet} onToggle={onToggle} />
        ))}
        <FeesCard answers={answers} />
        <ChecklistDisclaimer />
      </div>
    </div>
  );
}

/** « Votre avancement »: the share ready, each person's count (a link to their block), the fees, and the way back to the form. */
function ProgressCard({ people, ready, answers }: { people: ChecklistPerson[]; ready: ReadonlySet<string>; answers: ChecklistForm }): ReactNode {
  const t = useTranslations('Checklist.list');
  const cad = useCad();
  const names = usePeopleNames(people);
  const progress = progressOf(people, ready);
  const percent = progress.total ? Math.round((progress.ready / progress.total) * 100) : 0;
  return (
    <section aria-labelledby="checklist-progress" className="rounded-2xl bg-navy-deep p-6 text-white shadow-lg">
      <h2 id="checklist-progress" className="font-label text-white/60">
        {t('progressTitle')}
      </h2>
      <p className="mt-3 font-heading text-6xl font-bold leading-none tabular-nums">
        {percent}
        <span className="text-3xl text-white/60"> %</span>
      </p>
      <div
        role="progressbar"
        aria-label={t('progressLabel')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/15"
      >
        <div className="h-full rounded-full bg-leaf-line transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-3 text-body-sm text-white/80">{t('progress', { ready: progress.ready, total: progress.total })}</p>
      <p className="text-body-sm text-white/60">{t('progressMandatory', { ready: progress.mandatoryReady, total: progress.mandatoryTotal })}</p>

      <p className="mt-6 font-label text-white/60">{t('side.people')}</p>
      <ul className="mt-2 flex flex-col gap-1">
        {people.map((person, i) => {
          const own = progressOf(person.slots, ready);
          const done = own.total > 0 && own.ready === own.total;
          return (
            <li key={person.id}>
              <a
                href={`#person-${person.id}`}
                aria-label={t('side.jump', { person: names[i]! })}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/10"
              >
                <span className="flex-1 truncate text-body-sm font-semibold">{names[i]}</span>
                <span className={cn('font-label tabular-nums', done ? 'text-leaf-line' : 'text-white/60')}>
                  {own.ready}/{own.total}
                </span>
              </a>
            </li>
          );
        })}
      </ul>

      <a
        href="#checklist-fees-card"
        className="mt-5 flex items-baseline justify-between gap-3 border-t border-white/10 pt-4 transition-colors hover:text-rose"
      >
        <span className="font-label text-white/60">{t('side.fees')}</span>
        <span className="font-heading text-xl font-bold tabular-nums">{cad(checklistFees(answers).total)}</span>
      </a>

      <Link
        href={FORM_PATH}
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border-2 border-white/20 font-heading text-body-sm font-bold text-white transition-colors hover:border-white"
      >
        <PencilLine aria-hidden={true} className="size-4" />
        {t('edit')}
      </Link>
    </section>
  );
}

/** « Passeports/titres de voyage », « Relevé d'emploi – Responsable QHSE ». */
function useSlotName(slot: ChecklistSlot): string {
  const t = useTranslations('Checklist.list.slots');
  return t(slot.slot, { label: slot.label ?? '' });
}

/** One person's block, as in IRCC's checklist: « {person} : documents justificatifs ». */
function PersonCard({ person, ready, onToggle }: { person: ChecklistPerson; ready: ReadonlySet<string>; onToggle: Toggle }): ReactNode {
  const t = useTranslations('Checklist.list');
  const [name] = usePeopleNames([person]) as [string];
  const headingId = `checklist-${person.id}`;
  const progress = progressOf(person.slots, ready);
  return (
    <section id={`person-${person.id}`} aria-labelledby={headingId} className="scroll-mt-28 overflow-hidden rounded-2xl border border-fog bg-white shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-fog-light bg-navy-deep px-5 py-4 sm:px-6">
        <h2 id={headingId} className="font-heading text-h4 font-bold text-white">
          {t('personTitle', { person: name })}
        </h2>
        <span className="font-label text-white/70">{t('personProgress', { ready: progress.ready, total: progress.total })}</span>
      </div>
      <ul className="divide-y divide-fog-light">
        {person.slots.map((slot) => (
          <SlotRow key={slot.key} slot={slot} person={name} ready={ready} onToggle={onToggle} />
        ))}
      </ul>
    </section>
  );
}

/** An IRCC slot: its status, its name (« * … (requis) »), and the documents that go in it. */
function SlotRow({ slot, person, ready, onToggle }: { slot: ChecklistSlot; person: string; ready: ReadonlySet<string>; onToggle: Toggle }): ReactNode {
  const t = useTranslations('Checklist.list');
  const name = useSlotName(slot);
  const done = slot.pieces.filter((piece) => ready.has(piece.key)).length;
  const complete = done === slot.pieces.length;
  return (
    <li className="px-5 py-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold',
            complete ? 'bg-leaf-tint text-leaf' : 'bg-off-white text-slate',
          )}
        >
          {complete ? <Check aria-hidden={true} className="size-3.5" /> : null}
          {complete ? t('slotReady') : t('slotPending')}
        </span>
        <h3 className="font-heading text-body font-bold text-navy-deep">
          {slot.required ? (
            <span aria-hidden={true} className="mr-1 text-rouge">
              *
            </span>
          ) : null}
          {name}
          {slot.required ? <span className="ml-1 font-body text-body-sm font-medium text-slate">{t('requiredTag')}</span> : null}
        </h3>
        <span className="ml-auto font-label text-slate">{t('slotCount', { ready: done, total: slot.pieces.length })}</span>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {slot.pieces.map((piece) => (
          <PieceRow key={piece.key} piece={piece} slot={name} person={person} ready={ready.has(piece.key)} onToggle={onToggle} />
        ))}
      </ul>
    </li>
  );
}

function NeedBadge({ need }: { need: Need }): ReactNode {
  const t = useTranslations('Checklist.list');
  return need === 'mandatory' ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-rose bg-blush px-2 py-0.5 text-xs font-bold text-rouge">
      <span aria-hidden={true}>★</span>
      {t('mandatory')}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-fog bg-ice-blue px-2 py-0.5 text-xs font-semibold text-steel-blue">
      {t('recommended')}
    </span>
  );
}

/** A document in a slot: its name opens its guide; « Prêt » ticks it. */
function PieceRow({
  piece,
  slot,
  person,
  ready,
  onToggle,
}: {
  piece: ChecklistPiece;
  slot: string;
  person: string;
  ready: boolean;
  onToggle: Toggle;
}): ReactNode {
  const t = useTranslations('Checklist.list');
  const guide = DOCUMENT_GUIDES[toLocale(useLocale())][piece.document];
  const [open, setOpen] = useState(false);
  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3 transition-colors sm:p-3.5',
        ready ? 'border-leaf-line bg-leaf-tint' : 'border-fog-light',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 text-left font-heading text-body-sm font-bold text-navy-deep underline-offset-4 hover:text-rouge hover:underline sm:text-body"
          >
            {guide.name}
            <Info aria-hidden={true} className="size-4 shrink-0 text-rouge" />
          </button>
          <NeedBadge need={piece.need} />
        </div>
        <p className="mt-1 text-body-sm leading-relaxed text-slate">{guide.summary}</p>
      </div>
      <label className="flex shrink-0 cursor-pointer items-center gap-2 pt-0.5 text-body-sm font-semibold text-navy-deep">
        <input
          type="checkbox"
          checked={ready}
          onChange={(event) => onToggle(piece.key, event.target.checked)}
          aria-label={t('readyFor', { name: guide.name, slot, person })}
          className="size-5 accent-leaf"
        />
        <span aria-hidden={true} className="hidden sm:inline">
          {t('ready')}
        </span>
      </label>
      <GuideDialog
        open={open}
        onOpenChange={setOpen}
        title={guide.name}
        closeLabel={t('closeGuide')}
        header={
          <span className="flex flex-wrap items-center gap-2 text-body-sm text-slate">
            <NeedBadge need={piece.need} />
            {slot} · {person}
          </span>
        }
      >
        <GuideBlocks blocks={guide.blocks} />
      </GuideDialog>
    </li>
  );
}

/** « Frais »: IRCC's fees for this family, as at the end of its checklist. */
function FeesCard({ answers }: { answers: ChecklistForm }): ReactNode {
  const t = useTranslations('Checklist.list.fees');
  const money = useCad();
  const { rows, total } = checklistFees(answers);
  return (
    <section id="checklist-fees-card" aria-labelledby="checklist-fees" className="scroll-mt-28 rounded-2xl border border-fog bg-white p-5 shadow-sm sm:p-6">
      <h2 id="checklist-fees" className="font-heading text-h4 font-bold text-navy-deep">
        {t('title')}
      </h2>
      <p className="mt-1 text-body-sm text-slate">{t('lead')}</p>
      {/* Phones: one stacked line per fee (name, then « 1 × 990,00 $ » and its total), the total in a band. */}
      <dl className="mt-4 overflow-hidden rounded-xl border border-fog-light sm:hidden">
        {rows.map((row) => (
          <div key={row.id} className="border-b border-fog-light px-4 py-3">
            <dt className="text-body-sm font-medium leading-snug text-navy-deep">{t(row.id)}</dt>
            <dd className="mt-1.5 flex items-baseline justify-between gap-3">
              <span className="text-caption tabular-nums text-slate">
                {row.quantity} × {money(row.unit)}
              </span>
              <span className="text-body-sm font-semibold tabular-nums text-navy-deep">{money(row.quantity * row.unit)}</span>
            </dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 bg-blush px-4 py-3.5">
          <dt className="font-heading text-body-sm font-bold text-navy-deep">{t('grandTotal')}</dt>
          <dd className="font-heading text-xl font-bold tabular-nums text-rouge">{money(total)}</dd>
        </div>
      </dl>
      {/* From tablets up: IRCC's four columns. */}
      <div className="mt-4 hidden overflow-hidden rounded-xl border border-fog-light sm:block">
        <table className="w-full text-body-sm">
          <thead className="bg-off-white">
            <tr>
              <th scope="col" className="px-3.5 py-2 text-left font-label text-slate">
                {t('request')}
              </th>
              <th scope="col" className="px-3.5 py-2 text-right font-label text-slate">
                {t('quantity')}
              </th>
              <th scope="col" className="px-3.5 py-2 text-right font-label text-slate">
                {t('unit')}
              </th>
              <th scope="col" className="px-3.5 py-2 text-right font-label text-slate">
                {t('total')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-fog-light">
                <th scope="row" className="px-3.5 py-2.5 text-left font-medium text-navy-deep">
                  {t(row.id)}
                </th>
                <td className="px-3.5 py-2.5 text-right tabular-nums text-slate">{row.quantity}</td>
                <td className="px-3.5 py-2.5 text-right tabular-nums text-slate">{money(row.unit)}</td>
                <td className="px-3.5 py-2.5 text-right font-semibold tabular-nums text-navy-deep">{money(row.quantity * row.unit)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-fog">
              <th scope="row" colSpan={3} className="px-3.5 py-3 text-left font-heading font-bold text-navy-deep">
                {t('grandTotal')}
              </th>
              <td className="px-3.5 py-3 text-right font-heading font-bold tabular-nums text-rouge">{money(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <Link
        href="/outils/budget"
        className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-body-sm font-semibold text-navy-deep underline underline-offset-2 hover:text-rouge"
      >
        {t('budgetLink')}
        <ArrowRight aria-hidden={true} className="size-4 shrink-0" />
      </Link>
    </section>
  );
}

function EmptyChecklist(): ReactNode {
  const t = useTranslations('Checklist.list');
  return (
    <section className="max-w-2xl rounded-2xl border-2 border-fog-light bg-white p-8">
      <span aria-hidden={true} className="grid size-12 place-items-center rounded-2xl bg-blush text-rouge">
        <ClipboardList className="size-6" />
      </span>
      <h2 className="mt-4 font-heading text-h4 font-bold text-navy-deep">{t('emptyTitle')}</h2>
      <p className="mt-2 text-body text-slate">{t('emptyText')}</p>
      <Link
        href={FORM_PATH}
        className="mt-6 inline-flex h-12 items-center rounded-full bg-rouge px-6 font-heading text-body font-bold text-white hover:bg-crimson"
      >
        {t('emptyCta')}
      </Link>
    </section>
  );
}

function SignInInvite(): ReactNode {
  const t = useTranslations('Checklist.list');
  return (
    <section aria-labelledby="checklist-sign-in" className="rounded-2xl border-2 border-fog-light bg-white p-5">
      <span aria-hidden={true} className="grid size-10 place-items-center rounded-xl bg-blush text-rouge">
        <LockKeyhole className="size-5" />
      </span>
      <h3 id="checklist-sign-in" className="mt-3 font-heading text-body font-bold text-navy-deep">
        {t('signInTitle')}
      </h3>
      <p className="mt-1 text-body-sm text-slate">{t('signInText')}</p>
      <Link
        href={withNext('/connexion', LIST_PATH)}
        className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-rouge font-heading text-body-sm font-bold text-white hover:bg-crimson"
      >
        {t('signIn')}
      </Link>
    </section>
  );
}

/** Where the list ends: IRCC's own checklist after the ITA is the reference. */
function ChecklistDisclaimer(): ReactNode {
  const t = useTranslations('Checklist.list');
  const irccUrl = IRCC_DOCUMENTS[toLocale(useLocale())];
  return (
    <p className="flex gap-2 text-body-sm leading-relaxed text-slate">
      <Check aria-hidden={true} className="mt-1 size-4 shrink-0 text-leaf" />
      <span>
        {t('disclaimer')}{' '}
        <a href={irccUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-navy-deep underline underline-offset-2">
          {t('irccLink')}
          <ExternalLink aria-hidden={true} className="size-3.5" />
        </a>
      </span>
    </p>
  );
}

/** The progress card and sections while the Account's checklist loads. */
export function ChecklistSkeleton(): ReactNode {
  const t = useTranslations('Checklist.list');
  return (
    <div role="status" className="grid grid-cols-1 items-start gap-7 lg:grid-cols-3">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-96 rounded-2xl lg:order-last" />
      <div className="flex flex-col gap-5 lg:col-span-2">
        <Skeleton aria-hidden={true} className="h-96 rounded-2xl" />
        <Skeleton aria-hidden={true} className="h-56 rounded-2xl" />
      </div>
    </div>
  );
}
