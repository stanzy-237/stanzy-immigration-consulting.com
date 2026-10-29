'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { slugify } from '@/features/blog/lib/blog-schema';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { useTRPC } from '@/trpc/client';

type Category = { id: string; slug: string; nameFr: string; nameEn: string };

const input =
  'h-10 w-full rounded-xl border-2 border-fog-light bg-white px-3 text-sm text-navy-deep focus:border-navy-deep focus:outline-none';
const label = 'mb-1 block text-xs font-semibold text-slate';

/**
 * Runs a category change and says how it went: a toast when it worked, and
 * when it failed, except a taken slug, which the form shows under its fields.
 */
function useCategoryAction() {
  const t = useTranslations('BlogDashboard.categories');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return async (
    action: () => Promise<unknown>,
    done: 'added' | 'saved' | 'deleted',
  ): Promise<{ ok: boolean; fieldError: string | null }> => {
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: trpc.blog.categories.queryKey() });
      toast.add({ title: t(`toast.${done}`), type: done === 'deleted' ? 'deleted' : 'success' });
      return { ok: true, fieldError: null };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      if (message === 'BLOG_SLUG_TAKEN') return { ok: false, fieldError: t('errors.BLOG_SLUG_TAKEN') };
      toast.add({ title: message === 'BLOG_CATEGORY_IN_USE' ? t('errors.BLOG_CATEGORY_IN_USE') : t('errors.generic'), type: 'error' });
      return { ok: false, fieldError: null };
    }
  };
}

function CategoryRow({ category }: { category: Category }): ReactNode {
  const t = useTranslations('BlogDashboard.categories');
  const trpc = useTRPC();
  const run = useCategoryAction();
  const update = useMutation(trpc.blog.dashboard.categories.update.mutationOptions());
  const remove = useMutation(trpc.blog.dashboard.categories.delete.mutationOptions());
  const [draft, setDraft] = useState(category);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const act = async (action: () => Promise<unknown>, done: 'saved' | 'deleted') => {
    setError(null);
    setError((await run(action, done)).fieldError);
  };

  return (
    <li className="rounded-2xl border border-fog-light bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={`${id}-fr`} className={label}>{t('nameFr')}</label>
          <input id={`${id}-fr`} className={input} value={draft.nameFr} onChange={(e) => setDraft({ ...draft, nameFr: e.target.value })} />
        </div>
        <div>
          <label htmlFor={`${id}-en`} className={label}>{t('nameEn')}</label>
          <input id={`${id}-en`} className={input} value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} />
        </div>
        <div>
          <label htmlFor={`${id}-slug`} className={label}>{t('slug')}</label>
          <input id={`${id}-slug`} className={input} value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-rouge">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          disabled={remove.isPending}
          onClick={() => void act(() => remove.mutateAsync({ id: category.id }), 'deleted')}
          className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-rouge hover:bg-blush disabled:opacity-50"
        >
          <Trash2 aria-hidden={true} className="size-4" />
          {t('delete')}
        </button>
        <button
          type="button"
          disabled={update.isPending}
          onClick={() =>
            void act(() => update.mutateAsync({ id: category.id, slug: draft.slug, nameFr: draft.nameFr, nameEn: draft.nameEn }), 'saved')
          }
          className="inline-flex h-10 items-center rounded-full bg-navy-deep px-4 text-sm font-semibold text-white hover:bg-navy-80 disabled:opacity-50"
        >
          {t('save')}
        </button>
      </div>
    </li>
  );
}

function CategoryList(): ReactNode {
  const trpc = useTRPC();
  const { data: categories } = useSuspenseQuery(trpc.blog.categories.queryOptions());
  return (
    <ul className="flex flex-col gap-3">
      {categories.map((category) => (
        <CategoryRow key={category.id} category={category} />
      ))}
    </ul>
  );
}

/** Three category cards before they arrive. */
function CategoryListSkeleton(): ReactNode {
  const t = useTranslations('Common');
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">{t('loading')}</span>
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} aria-hidden={true} className="h-36 rounded-2xl" />
      ))}
    </div>
  );
}

/** The Blog's categories: rename them in French and English, add new ones, remove unused ones. */
export function BlogCategoriesView(): ReactNode {
  const t = useTranslations('BlogDashboard.categories');
  const trpc = useTRPC();
  const run = useCategoryAction();
  const create = useMutation(trpc.blog.dashboard.categories.create.mutationOptions());
  const [draft, setDraft] = useState({ nameFr: '', nameEn: '', slug: '' });
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const add = async () => {
    setError(null);
    const { ok, fieldError } = await run(() => create.mutateAsync(draft), 'added');
    setError(fieldError);
    if (ok) {
      setDraft({ nameFr: '', nameEn: '', slug: '' });
      setSlugTouched(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/blog" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-deep hover:text-rouge">
        <ArrowLeft aria-hidden={true} className="size-4" />
        {t('back')}
      </Link>
      <h1 className="mb-6 font-heading text-3xl font-bold text-navy-deep">{t('title')}</h1>

      <QueryBoundary fallback={<CategoryListSkeleton />}>
        <CategoryList />
      </QueryBoundary>

      <section aria-labelledby={`${id}-new`} className="mt-8 rounded-2xl border-2 border-dashed border-fog-light bg-white p-4">
        <h2 id={`${id}-new`} className="mb-3 font-heading text-lg font-bold text-navy-deep">{t('newCategory')}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor={`${id}-fr`} className={label}>{t('nameFr')}</label>
            <input
              id={`${id}-fr`}
              className={input}
              value={draft.nameFr}
              onChange={(e) => setDraft({ ...draft, nameFr: e.target.value, slug: slugTouched ? draft.slug : slugify(e.target.value) })}
            />
          </div>
          <div>
            <label htmlFor={`${id}-en`} className={label}>{t('nameEn')}</label>
            <input id={`${id}-en`} className={input} value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} />
          </div>
          <div>
            <label htmlFor={`${id}-slug`} className={label}>{t('slug')}</label>
            <input
              id={`${id}-slug`}
              className={input}
              value={draft.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setDraft({ ...draft, slug: e.target.value });
              }}
            />
          </div>
        </div>
        {error && <p role="alert" className="mt-2 text-sm font-semibold text-rouge">{error}</p>}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={!draft.nameFr || !draft.nameEn || !draft.slug || create.isPending}
            onClick={() => void add()}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-rouge px-4 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
          >
            <Plus aria-hidden={true} className="size-4" />
            {t('add')}
          </button>
        </div>
      </section>
    </div>
  );
}
