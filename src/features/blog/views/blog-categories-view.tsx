'use client';

import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState, type ReactNode } from 'react';

import { slugify } from '@/features/blog/lib/blog-schema';
import { Link } from '@/i18n/navigation';
import { api } from '@/trpc/react';

type Category = { id: string; slug: string; nameFr: string; nameEn: string };

const input =
  'h-10 w-full rounded-xl border-2 border-fog-light bg-white px-3 text-sm text-navy-deep focus:border-navy-deep focus:outline-none';
const label = 'mb-1 block text-xs font-semibold text-slate';

/** Shows the server's refusal code as a sentence; anything unexpected as a generic failure. */
function useErrorText() {
  const t = useTranslations('BlogDashboard.categories.errors');
  return (caught: unknown) => {
    const message = caught instanceof Error ? caught.message : '';
    return message === 'BLOG_SLUG_TAKEN' || message === 'BLOG_CATEGORY_IN_USE' ? t(message) : t('generic');
  };
}

function CategoryRow({ category }: { category: Category }): ReactNode {
  const t = useTranslations('BlogDashboard.categories');
  const errorText = useErrorText();
  const utils = api.useUtils();
  const update = api.blog.dashboard.categories.update.useMutation();
  const remove = api.blog.dashboard.categories.delete.useMutation();
  const [draft, setDraft] = useState(category);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const act = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await utils.blog.categories.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    }
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
          onClick={() => void act(() => remove.mutateAsync({ id: category.id }))}
          className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-rouge hover:bg-blush"
        >
          <Trash2 aria-hidden={true} className="size-4" />
          {t('delete')}
        </button>
        <button
          type="button"
          onClick={() => void act(() => update.mutateAsync({ id: category.id, slug: draft.slug, nameFr: draft.nameFr, nameEn: draft.nameEn }))}
          className="inline-flex h-10 items-center rounded-full bg-navy-deep px-4 text-sm font-semibold text-white hover:bg-navy-80"
        >
          {t('save')}
        </button>
      </div>
    </li>
  );
}

/** The Blog's categories: rename them in French and English, add new ones, remove unused ones. */
export function BlogCategoriesView(): ReactNode {
  const t = useTranslations('BlogDashboard.categories');
  const errorText = useErrorText();
  const utils = api.useUtils();
  const categories = api.blog.categories.useQuery();
  const create = api.blog.dashboard.categories.create.useMutation();
  const [draft, setDraft] = useState({ nameFr: '', nameEn: '', slug: '' });
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const add = async () => {
    setError(null);
    try {
      await create.mutateAsync(draft);
      setDraft({ nameFr: '', nameEn: '', slug: '' });
      setSlugTouched(false);
      await utils.blog.categories.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/tableau-de-bord/blog" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-deep hover:text-rouge">
        <ArrowLeft aria-hidden={true} className="size-4" />
        {t('back')}
      </Link>
      <h1 className="mb-6 font-heading text-3xl font-bold text-navy-deep">{t('title')}</h1>

      <ul className="flex flex-col gap-3">
        {categories.data?.map((category) => <CategoryRow key={category.id} category={category} />)}
      </ul>

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
            disabled={!draft.nameFr || !draft.nameEn || !draft.slug}
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
