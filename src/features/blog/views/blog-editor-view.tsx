'use client';

import { ArrowLeft, Eye, ImagePlus, PencilLine, Trash2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Image from 'next/image';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArticleBody } from '@/features/blog/components/article-body';
import { RichTextEditor } from '@/features/blog/components/rich-text-editor';
import { SEO_DESCRIPTION_LIMIT, SEO_TITLE_LIMIT, slugify, toBlogLocale, type BlogLocale } from '@/features/blog/lib/blog-schema';
import { categoryName } from '@/features/blog/lib/category-name';
import { missingForPublish } from '@/features/blog/lib/publish-check';
import { EMPTY_ARTICLE, isOptimisableImage, renderArticle, safeImageSrc, type ArticleDoc } from '@/features/blog/lib/render-article';
import { uploadBlogImage } from '@/features/blog/lib/upload-image';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/trpc/react';

type Form = {
  title: string;
  slug: string;
  locale: BlogLocale;
  content: ArticleDoc;
  categoryId: string;
  tagsText: string;
  excerpt: string;
  coverUrl: string | null;
  coverAlt: string;
  seoTitle: string;
  seoDescription: string;
};

const EMPTY_FORM: Form = {
  title: '',
  slug: '',
  locale: 'fr',
  content: EMPTY_ARTICLE,
  categoryId: '',
  tagsText: '',
  excerpt: '',
  coverUrl: null,
  coverAlt: '',
  seoTitle: '',
  seoDescription: '',
};

const input =
  'h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm text-navy-deep focus:border-navy-deep focus:outline-none aria-invalid:border-rouge';
const textarea =
  'w-full rounded-xl border-2 border-fog-light bg-white px-3.5 py-2.5 text-sm text-navy-deep focus:border-navy-deep focus:outline-none';
const label = 'mb-1.5 block text-sm font-semibold text-navy-deep';
const hint = 'mt-1 text-xs text-slate';
const panel = 'rounded-2xl border border-fog-light bg-white p-5 shadow-sm';

const tagsOf = (text: string) =>
  text
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

/** A label with its field, its hint and, when it has one, its error. */
function Field({
  id,
  name,
  hintText,
  error,
  children,
}: {
  id: string;
  name: string;
  hintText?: string;
  error?: string | null;
  children: ReactNode;
}): ReactNode {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {name}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-semibold text-rouge">
          {error}
        </p>
      ) : (
        hintText && <p className={hint}>{hintText}</p>
      )}
    </div>
  );
}

/**
 * The Blog section's editor, for a new Article (no `id`) or an existing one:
 * title and address, the rich-text body, its settings (language, category,
 * tags, excerpt, cover, search fields) and its status actions.
 */
export function BlogEditorView({ id }: { id?: string }): ReactNode {
  const t = useTranslations('BlogDashboard');
  const tEditor = useTranslations('BlogDashboard.editor');
  const tPublic = useTranslations('Blog');
  const format = useFormatter();
  const router = useRouter();
  const utils = api.useUtils();
  const uid = useId();
  const ids = (name: string) => `${uid}-${name}`;

  const article = api.blog.dashboard.get.useQuery({ id: id ?? '' }, { enabled: Boolean(id) });
  const categories = api.blog.categories.useQuery();
  const knownTags = api.blog.dashboard.tags.useQuery();
  const create = api.blog.dashboard.create.useMutation();
  const update = api.blog.dashboard.update.useMutation();
  const publish = api.blog.dashboard.publish.useMutation();
  const unpublish = api.blog.dashboard.unpublish.useMutation();
  const remove = api.blog.dashboard.delete.useMutation();

  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [publishedAt, setPublishedAt] = useState<Date | null>(null);
  const [slugTouched, setSlugTouched] = useState(Boolean(id));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);

  // Load the stored Article once; later refetches don't overwrite typing.
  const data = article.data;
  if (id && data && loadedId !== data.id) {
    setLoadedId(data.id);
    setForm({
      title: data.title,
      slug: data.slug,
      locale: toBlogLocale(data.locale),
      content: data.content as ArticleDoc,
      categoryId: data.categoryId,
      tagsText: data.tags.join(', '),
      excerpt: data.excerpt ?? '',
      coverUrl: data.coverUrl,
      coverAlt: data.coverAlt ?? '',
      seoTitle: data.seoTitle ?? '',
      seoDescription: data.seoDescription ?? '',
    });
    setStatus(data.status);
    setPublishedAt(data.publishedAt);
  }

  // Leaving with unsaved changes asks first: closing the tab, and following
  // any link in the page (the sidebar, « Retour », « Voir le site »).
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const confirmLink = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (link && !window.confirm(tEditor('leaveWarning'))) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', confirmLink, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', confirmLink, true);
    };
  }, [dirty, tEditor]);

  const change = (patch: Partial<Form>) => {
    setForm((current) => ({ ...current, ...patch }));
    setDirty(true);
    setSaved(false);
    setError(null);
  };

  const setTitle = (title: string) => change(slugTouched ? { title } : { title, slug: slugify(title) });

  /** Saves the form; resolves to the Article's id, or null when the save was refused. */
  const save = async (): Promise<string | null> => {
    setSlugError(null);
    setError(null);
    const payload = {
      title: form.title,
      slug: form.slug,
      locale: form.locale,
      content: form.content,
      categoryId: form.categoryId,
      tags: tagsOf(form.tagsText),
      excerpt: form.excerpt,
      coverUrl: form.coverUrl,
      coverAlt: form.coverAlt,
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
    };
    try {
      const result = id ? await update.mutateAsync({ id, ...payload }) : await create.mutateAsync(payload);
      setDirty(false);
      setSaved(true);
      void utils.blog.dashboard.invalidate();
      if (!id) router.replace(`/tableau-de-bord/blog/${result.id}`);
      return result.id;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      if (message === 'BLOG_SLUG_TAKEN') setSlugError(tEditor('errors.BLOG_SLUG_TAKEN'));
      else if (message.includes('BLOG_SLUG_INVALID')) setSlugError(tEditor('errors.BLOG_SLUG_INVALID'));
      else setError(tEditor('errors.generic'));
      return null;
    }
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const missing = missingForPublish({ ...form, coverAlt: form.coverAlt || null });
  const [publishBlocked, setPublishBlocked] = useState(false);

  const onPublish = () =>
    run(async () => {
      if (missing.length > 0) {
        setPublishBlocked(true);
        return;
      }
      setPublishBlocked(false);
      const savedId = await save();
      if (!savedId) return;
      await publish.mutateAsync({ id: savedId });
      setStatus('PUBLISHED');
      setPublishedAt((current) => current ?? new Date());
      void utils.blog.dashboard.invalidate();
    });

  const onUnpublish = () =>
    run(async () => {
      if (!id) return;
      await unpublish.mutateAsync({ id });
      setStatus('DRAFT');
      void utils.blog.dashboard.invalidate();
    });

  const onDelete = () =>
    run(async () => {
      if (!id) return;
      try {
        await remove.mutateAsync({ id });
        void utils.blog.dashboard.invalidate();
        setDirty(false);
        router.replace('/tableau-de-bord/blog');
      } catch {
        setError(tEditor('errors.BLOG_DELETE_PUBLISHED'));
      } finally {
        setDeleting(false);
      }
    });

  const onCover = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      change({ coverUrl: await uploadBlogImage(file) });
    } catch {
      setError(tEditor('uploadError'));
    } finally {
      setUploading(false);
    }
  };

  if (id && article.isError) {
    return <p className="rounded-2xl bg-white p-6 text-slate">{tEditor('notFound')}</p>;
  }
  if (id && !data) return <p className="text-slate">{t('loading')}</p>;

  const chosenCategory = categories.data?.find((category) => category.id === form.categoryId);
  const rendered = renderArticle(form.content);
  const unusedTags = (knownTags.data ?? []).filter((tag) => !tagsOf(form.tagsText).map(slugify).includes(tag));

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/tableau-de-bord/blog" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-deep hover:text-rouge">
        <ArrowLeft aria-hidden={true} className="size-4" />
        {tEditor('back')}
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold text-navy-deep sm:text-3xl">
            {id ? tEditor('editTitle') : tEditor('newTitle')}
          </h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
              status === 'PUBLISHED' ? 'bg-leaf-tint text-leaf' : 'bg-honey-tint text-honey'
            }`}
          >
            {t(`status.${status}`)}
          </span>
          {status === 'PUBLISHED' && publishedAt && (
            <span className="text-xs text-slate">
              {tEditor('publishedOn', {
                date: format.dateTime(publishedAt, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
              })}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty && <span className="text-xs font-semibold text-honey">{tEditor('unsaved')}</span>}
          {saved && !dirty && <span className="text-xs font-semibold text-leaf">{tEditor('saved')}</span>}
          <button
            type="button"
            onClick={() => setPreviewing((on) => !on)}
            className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-fog-light px-4 text-sm font-semibold text-navy-deep hover:border-navy-deep"
          >
            {previewing ? <PencilLine aria-hidden={true} className="size-4" /> : <Eye aria-hidden={true} className="size-4" />}
            {previewing ? tEditor('closePreview') : tEditor('preview')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(async () => void (await save()))}
            className="inline-flex h-11 items-center rounded-full border-2 border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white disabled:opacity-60"
          >
            {status === 'PUBLISHED' ? tEditor('save') : tEditor('saveDraft')}
          </button>
          {status === 'PUBLISHED' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onUnpublish()}
              className="inline-flex h-11 items-center rounded-full bg-navy-deep px-5 text-sm font-semibold text-white hover:bg-navy-80 disabled:opacity-60"
            >
              {tEditor('unpublish')}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onPublish()}
              className="inline-flex h-11 items-center rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-60"
            >
              {tEditor('publish')}
            </button>
          )}
        </div>
      </div>

      {publishBlocked && missing.length > 0 && (
        <p role="alert" className="mb-4 rounded-xl border border-rose bg-blush px-4 py-3 text-sm font-semibold text-rouge">
          {tEditor('mustPublish', { missing: missing.map((key) => tEditor(`missing.${key}`)).join(', ') })}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-rose bg-blush px-4 py-3 text-sm font-semibold text-rouge">
          {error}
        </p>
      )}

      {previewing ? (
        <article lang={form.locale} className="mx-auto max-w-3xl rounded-2xl bg-white px-5 py-8 shadow-sm sm:px-10">
          {chosenCategory && (
            <p className="inline-flex rounded-full bg-blush px-3 py-1 text-xs font-semibold uppercase tracking-widest text-rouge">
              {categoryName(chosenCategory, form.locale)}
            </p>
          )}
          <h1 className="mt-4 font-heading text-3xl font-bold leading-tight text-navy-deep sm:text-4xl">{form.title}</h1>
          <p className="mt-3 text-sm text-slate">{tPublic('readingMinutes', { minutes: rendered.readingMinutes })}</p>
          {form.coverUrl && safeImageSrc(form.coverUrl) && (
            <div className="relative mt-6 aspect-video w-full overflow-hidden rounded-2xl bg-ice-blue">
              <Image src={form.coverUrl} alt={form.coverAlt} fill sizes="768px" unoptimized={!isOptimisableImage(form.coverUrl)} className="object-cover" />
            </div>
          )}
          <div className="mt-6">
            <ArticleBody html={rendered.html} />
          </div>
          {tagsOf(form.tagsText).length > 0 && (
            <ul className="mt-8 flex flex-wrap gap-2 border-t border-fog-light pt-6">
              {tagsOf(form.tagsText).map((tag) => (
                <li key={tag} className="rounded-full border-2 border-fog-light px-3.5 py-1.5 text-sm font-semibold text-navy-deep">
                  #{slugify(tag)}
                </li>
              ))}
            </ul>
          )}
        </article>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-5 lg:col-span-2">
            <div className={`${panel} flex flex-col gap-4`}>
              <Field id={ids('title')} name={tEditor('titleLabel')}>
                <input id={ids('title')} className={input} value={form.title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <Field
                id={ids('slug')}
                name={tEditor('slugLabel')}
                error={slugError}
                hintText={
                  status === 'PUBLISHED'
                    ? tEditor('slugPublishedWarning')
                    : tEditor('slugHint', { locale: form.locale, slug: form.slug || '…' })
                }
              >
                <input
                  id={ids('slug')}
                  className={input}
                  value={form.slug}
                  aria-invalid={slugError ? true : undefined}
                  aria-describedby={slugError ? `${ids('slug')}-error` : undefined}
                  onChange={(e) => {
                    setSlugTouched(true);
                    change({ slug: e.target.value });
                  }}
                />
              </Field>
            </div>
            <div>
              <p className={label}>{tEditor('bodyLabel')}</p>
              <RichTextEditor
                key={loadedId ?? 'new'}
                initial={form.content}
                onChange={(content) => change({ content })}
                onUploadError={() => setError(tEditor('uploadError'))}
              />
            </div>
          </div>

          <aside className="flex flex-col gap-5">
            <section aria-label={tEditor('settings')} className={`${panel} flex flex-col gap-4`}>
              <Field id={ids('locale')} name={tEditor('language')}>
                <select
                  id={ids('locale')}
                  className={input}
                  value={form.locale}
                  onChange={(e) => change({ locale: e.target.value === 'en' ? 'en' : 'fr' })}
                >
                  <option value="fr">{tEditor('languages.fr')}</option>
                  <option value="en">{tEditor('languages.en')}</option>
                </select>
              </Field>
              <Field id={ids('category')} name={tEditor('category')}>
                <select
                  id={ids('category')}
                  className={input}
                  value={form.categoryId}
                  onChange={(e) => change({ categoryId: e.target.value })}
                >
                  <option value="">{tEditor('chooseCategory')}</option>
                  {categories.data?.map((category) => (
                    <option key={category.id} value={category.id}>
                      {categoryName(category, form.locale)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id={ids('tags')} name={tEditor('tags')} hintText={tEditor('tagsHint')}>
                <input id={ids('tags')} className={input} value={form.tagsText} onChange={(e) => change({ tagsText: e.target.value })} />
              </Field>
              {unusedTags.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-slate">{tEditor('tagSuggestions')}</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {unusedTags.map((tag) => (
                      <li key={tag}>
                        <button
                          type="button"
                          onClick={() => change({ tagsText: [...tagsOf(form.tagsText), tag].join(', ') })}
                          className="rounded-full border border-fog-light px-2.5 py-1 text-xs font-semibold text-navy-deep hover:border-navy-deep"
                        >
                          #{tag}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <Field id={ids('excerpt')} name={tEditor('excerpt')} hintText={tEditor('excerptHint')}>
                <textarea id={ids('excerpt')} rows={3} className={textarea} value={form.excerpt} onChange={(e) => change({ excerpt: e.target.value })} />
              </Field>
            </section>

            <section aria-label={tEditor('cover')} className={`${panel} flex flex-col gap-3`}>
              <p className={label}>{tEditor('cover')}</p>
              {form.coverUrl && safeImageSrc(form.coverUrl) && (
                <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-ice-blue">
                  <Image src={form.coverUrl} alt={form.coverAlt} fill sizes="320px" unoptimized={!isOptimisableImage(form.coverUrl)} className="object-cover" />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => coverInput.current?.click()}
                  className="inline-flex h-10 items-center gap-2 rounded-full border-2 border-fog-light px-4 text-sm font-semibold text-navy-deep hover:border-navy-deep disabled:opacity-60"
                >
                  <ImagePlus aria-hidden={true} className="size-4" />
                  {uploading ? tEditor('uploading') : form.coverUrl ? tEditor('replaceCover') : tEditor('uploadCover')}
                </button>
                {form.coverUrl && (
                  <button
                    type="button"
                    onClick={() => change({ coverUrl: null, coverAlt: '' })}
                    className="inline-flex h-10 items-center rounded-full px-3 text-sm font-semibold text-rouge hover:text-crimson"
                  >
                    {tEditor('removeCover')}
                  </button>
                )}
              </div>
              <input
                ref={coverInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="hidden"
                tabIndex={-1}
                aria-hidden={true}
                onChange={(e) => {
                  void onCover(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <Field id={ids('coverUrl')} name={tEditor('coverUrl')} hintText={tEditor('coverUrlHint')}>
                <input
                  id={ids('coverUrl')}
                  className={input}
                  value={form.coverUrl ?? ''}
                  placeholder="https://…"
                  onChange={(e) => change({ coverUrl: e.target.value.trim() || null })}
                />
              </Field>
              {form.coverUrl && (
                <Field id={ids('coverAlt')} name={tEditor('coverAlt')}>
                  <input id={ids('coverAlt')} className={input} value={form.coverAlt} onChange={(e) => change({ coverAlt: e.target.value })} />
                </Field>
              )}
            </section>

            <section aria-label={tEditor('seo')} className={`${panel} flex flex-col gap-4`}>
              <p className={label}>{tEditor('seo')}</p>
              <Field
                id={ids('seoTitle')}
                name={tEditor('seoTitle')}
                hintText={`${tEditor('seoTitleHint')} ${tEditor('counter', { count: form.seoTitle.length, limit: SEO_TITLE_LIMIT })}`}
              >
                <input id={ids('seoTitle')} className={input} value={form.seoTitle} onChange={(e) => change({ seoTitle: e.target.value })} />
              </Field>
              <Field
                id={ids('seoDescription')}
                name={tEditor('seoDescription')}
                hintText={`${tEditor('seoDescriptionHint')} ${tEditor('counter', { count: form.seoDescription.length, limit: SEO_DESCRIPTION_LIMIT })}`}
              >
                <textarea
                  id={ids('seoDescription')}
                  rows={3}
                  className={textarea}
                  value={form.seoDescription}
                  onChange={(e) => change({ seoDescription: e.target.value })}
                />
              </Field>
            </section>

            {id && status === 'DRAFT' && (
              <button
                type="button"
                onClick={() => setDeleting(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold text-rouge hover:bg-blush"
              >
                <Trash2 aria-hidden={true} className="size-4" />
                {tEditor('delete')}
              </button>
            )}
          </aside>
        </div>
      )}

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent className="gap-5 p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">{tEditor('deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-slate">
              {tEditor('deleteConfirmBody', { title: form.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">{tEditor('cancel')}</AlertDialogCancel>
            <button
              type="button"
              onClick={() => void onDelete()}
              className="rounded-full bg-rouge px-5 py-2 text-sm font-semibold text-white hover:bg-crimson"
            >
              {tEditor('confirmDelete')}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
