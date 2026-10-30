'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Check, ClipboardList, ExternalLink, Info, LockKeyhole, PencilLine } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useCurrentAccount } from '@/features/auth/hooks/use-current-account';
import { withNext } from '@/features/auth/lib/safe-next-path';
import { DOCUMENT_GUIDES } from '@/features/checklist/data/document-guides';
import { useStoredChecklistAnswers, useStoredReady } from '@/features/checklist/hooks/use-stored-checklist';
import {
  buildChecklist,
  progressOf,
  type ChecklistItem,
  type ChecklistSection,
  type Need,
} from '@/features/checklist/lib/build-checklist';
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
  return (
    <>
      <ChecklistList answers={answers} ready={ready} onToggle={toggle} />
      <SignInInvite />
    </>
  );
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

function ChecklistList({ answers, ready, onToggle }: { answers: ChecklistForm; ready: string[]; onToggle: Toggle }): ReactNode {
  const t = useTranslations('Checklist.list');
  const sections = useMemo(() => buildChecklist(answers), [answers]);
  const readySet = useMemo(() => new Set(ready), [ready]);
  const progress = progressOf(sections, readySet);
  const percent = progress.total ? Math.round((progress.ready / progress.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="checklist-progress" className="rounded-2xl border-2 border-fog-light bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="checklist-progress" className="font-heading text-h4 font-bold text-navy-deep">
              {t('progressTitle')}
            </h2>
            <p className="mt-1 text-body-sm text-slate">{t('progress', { ready: progress.ready, total: progress.total })}</p>
            <p className="text-body-sm text-slate">
              {t('progressMandatory', { ready: progress.mandatoryReady, total: progress.mandatoryTotal })}
            </p>
          </div>
          <Link
            href={FORM_PATH}
            className="inline-flex h-10 items-center gap-2 rounded-full border-2 border-fog-light px-4 font-heading text-body-sm font-bold text-navy-deep transition-colors hover:border-navy-deep"
          >
            <PencilLine aria-hidden={true} className="size-4" />
            {t('edit')}
          </Link>
        </div>
        <div
          role="progressbar"
          aria-label={t('progressLabel')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-4 h-2.5 overflow-hidden rounded-full bg-fog-light"
        >
          <div className="h-full rounded-full bg-leaf transition-all duration-300" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-4 flex flex-wrap items-center gap-2 text-caption text-slate">
          <NeedBadge need="mandatory" />
          <NeedBadge need="recommended" />
          <span>{t('legend')}</span>
        </p>
      </section>

      {sections.map((section) => (
        <SectionCard key={section.id} section={section} ready={readySet} onToggle={onToggle} />
      ))}
    </div>
  );
}

function SectionCard({ section, ready, onToggle }: { section: ChecklistSection; ready: ReadonlySet<string>; onToggle: Toggle }): ReactNode {
  const t = useTranslations('Checklist.list');
  const headingId = `checklist-${section.id}`;
  const done = section.items.filter((item) => ready.has(item.key)).length;
  return (
    <section aria-labelledby={headingId} className="rounded-2xl border border-fog bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id={headingId} className="font-heading text-h4 font-bold text-navy-deep">
          {t(`sections.${section.id}`)}
        </h2>
        <span className="shrink-0 font-label text-slate">{t('sectionProgress', { ready: done, total: section.items.length })}</span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {section.items.map((item) => (
          <DocumentRow key={item.key} item={item} ready={ready.has(item.key)} onToggle={onToggle} />
        ))}
      </ul>
    </section>
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

/** Whose document, and how many: « Conjoint(e) », « Enfants × 2 », « × 3 ». */
function WhoChip({ item }: { item: ChecklistItem }): ReactNode {
  const t = useTranslations('Checklist.list');
  if (item.who === 'you' && !item.count) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-off-white px-2 py-0.5 text-xs font-semibold text-navy-deep">
      {item.who === 'you' ? null : t(`who.${item.who}`)}
      {item.count ? <span>{t('count', { count: item.count })}</span> : null}
    </span>
  );
}

function DocumentRow({ item, ready, onToggle }: { item: ChecklistItem; ready: boolean; onToggle: Toggle }): ReactNode {
  const t = useTranslations('Checklist.list');
  const guide = DOCUMENT_GUIDES[toLocale(useLocale())][item.document];
  const [open, setOpen] = useState(false);
  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3.5 transition-colors sm:p-4',
        ready ? 'border-leaf-line bg-leaf-tint' : 'border-fog-light',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 text-left font-heading text-body font-bold text-navy-deep underline-offset-4 hover:text-rouge hover:underline"
          >
            {guide.name}
            <Info aria-hidden={true} className="size-4 shrink-0 text-rouge" />
          </button>
          <NeedBadge need={item.need} />
          <WhoChip item={item} />
        </div>
        <p className="mt-1 text-body-sm leading-relaxed text-slate">{guide.summary}</p>
      </div>
      <label className="flex shrink-0 cursor-pointer items-center gap-2 pt-0.5 text-body-sm font-semibold text-navy-deep">
        <input
          type="checkbox"
          checked={ready}
          onChange={(event) => onToggle(item.key, event.target.checked)}
          aria-label={t('readyLabel', { name: guide.name, who: t(`who.${item.who}`) })}
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
          <span className="flex flex-wrap items-center gap-2">
            <NeedBadge need={item.need} />
            <WhoChip item={item} />
          </span>
        }
      >
        <GuideBlocks blocks={guide.blocks} />
      </GuideDialog>
    </li>
  );
}

function EmptyChecklist(): ReactNode {
  const t = useTranslations('Checklist.list');
  return (
    <section className="mx-auto max-w-xl rounded-2xl border-2 border-fog-light bg-white p-8 text-center">
      <span aria-hidden={true} className="mx-auto grid size-12 place-items-center rounded-2xl bg-blush text-rouge">
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
    <section className="mt-5 flex flex-col items-start gap-4 rounded-2xl border-2 border-fog-light bg-white p-5 sm:flex-row sm:items-center sm:p-6">
      <span aria-hidden={true} className="grid size-11 shrink-0 place-items-center rounded-xl bg-blush text-rouge">
        <LockKeyhole className="size-5" />
      </span>
      <div className="flex-1">
        <h2 className="font-heading text-body font-bold text-navy-deep">{t('signInTitle')}</h2>
        <p className="mt-1 text-body-sm text-slate">{t('signInText')}</p>
      </div>
      <Link
        href={withNext('/connexion', LIST_PATH)}
        className="inline-flex h-11 shrink-0 items-center rounded-full bg-navy-deep px-5 font-heading text-body-sm font-bold text-white hover:bg-navy-80"
      >
        {t('signIn')}
      </Link>
    </section>
  );
}

/** Where the list ends: IRCC's own checklist after the ITA is the reference. */
export function ChecklistDisclaimer(): ReactNode {
  const t = useTranslations('Checklist.list');
  const irccUrl = IRCC_DOCUMENTS[toLocale(useLocale())];
  return (
    <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-slate">
      <Check aria-hidden={true} className="size-4 text-leaf" />
      {t('disclaimer')}
      <a href={irccUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-navy-deep underline underline-offset-2">
        {t('irccLink')}
        <ExternalLink aria-hidden={true} className="size-3.5" />
      </a>
    </p>
  );
}

/** The progress card and sections while the Account's checklist loads. */
export function ChecklistSkeleton(): ReactNode {
  const t = useTranslations('Checklist.list');
  return (
    <div role="status" className="flex flex-col gap-5">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-40 rounded-2xl" />
      <Skeleton aria-hidden={true} className="h-72 rounded-2xl" />
      <Skeleton aria-hidden={true} className="h-56 rounded-2xl" />
    </div>
  );
}
