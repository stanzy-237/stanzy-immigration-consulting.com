import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { ArticleCard } from '@/features/blog/components/article-card';
import { categoryName } from '@/features/blog/lib/category-name';
import { toBlogLocale } from '@/features/blog/lib/blog-schema';
import { getBlogCategories, getBlogList } from '@/features/blog/server/blog-pages';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { Link } from '@/i18n/navigation';

/** The Blog list's filters, as they come from the address (`?categorie=…&tag=…&page=…`). */
export type BlogListParams = { categorie?: string; tag?: string; page?: string };

/** `/blog` with the given filters; page 1 and empty filters stay out of the address. */
const blogHref = (params: { categorie?: string; tag?: string; page?: number }) => ({
  pathname: '/blog' as const,
  query: Object.fromEntries(
    Object.entries({ ...params, page: params.page && params.page > 1 ? String(params.page) : undefined }).filter(
      ([, value]) => value,
    ),
  ) as Record<string, string>,
});

const chip = 'inline-flex h-9 items-center rounded-full border-2 px-4 text-sm font-semibold no-underline transition-colors';
const chipIdle = `${chip} border-fog-light bg-white text-navy-deep hover:border-navy-deep`;
const chipActive = `${chip} border-navy-deep bg-navy-deep text-white`;

/**
 * The public Blog: published Articles newest first, filtered by category and
 * tag from the address, 12 to a page. Rendered on the server for search engines.
 */
export async function BlogListView({ locale: rawLocale, params }: { locale: string; params: BlogListParams }): Promise<ReactNode> {
  const locale = toBlogLocale(rawLocale);
  const t = await getTranslations({ locale, namespace: 'Blog' });
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const [list, categories] = await Promise.all([
    getBlogList({ locale, category: params.categorie, tag: params.tag, page }),
    getBlogCategories(),
  ]);
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const filtered = Boolean(params.categorie || params.tag);

  return (
    <>
      <SiteNav />
      <main>
        <header className="bg-linear-135 from-navy-deep to-navy-80 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-7">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-rouge/30 bg-rouge/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-rose">
              <span aria-hidden={true} className="size-1.5 rounded-full bg-rose" />
              {t('eyebrow')}
            </p>
            <h1 className="mb-3 font-heading text-4xl font-bold tracking-tight text-white sm:text-5xl">{t('title')}</h1>
            <p className="max-w-2xl text-base text-white/70">{t('subtitle')}</p>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-7 sm:py-12">
          <nav aria-label={t('filtersLabel')} className="mb-8 flex flex-wrap items-center gap-2">
            <Link href={blogHref({ tag: params.tag })} className={params.categorie ? chipIdle : chipActive} aria-current={params.categorie ? undefined : 'page'}>
              {t('allCategories')}
            </Link>
            {categories.map((category) => {
              const active = params.categorie === category.slug;
              return (
                <Link
                  key={category.slug}
                  href={blogHref({ categorie: category.slug, tag: params.tag })}
                  className={active ? chipActive : chipIdle}
                  aria-current={active ? 'page' : undefined}
                >
                  {categoryName(category, locale)}
                </Link>
              );
            })}
            {params.tag && (
              <Link href={blogHref({ categorie: params.categorie })} className={`${chip} gap-2 border-rose bg-blush text-rouge`} aria-label={t('clearTag', { tag: params.tag })}>
                {t('tagFilter', { tag: params.tag })}
                <X aria-hidden={true} className="size-4" />
              </Link>
            )}
          </nav>

          {list.items.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-fog-light bg-off-white px-6 py-14 text-center">
              <p className="text-base text-slate">{filtered ? t('empty') : t('emptyAll')}</p>
              {filtered && (
                <Link href="/blog" className="mt-4 inline-flex text-sm font-semibold text-rouge hover:text-crimson">
                  {t('showAll')}
                </Link>
              )}
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.items.map((article) => (
                <li key={article.slug}>
                  <ArticleCard article={article} locale={locale} />
                </li>
              ))}
            </ul>
          )}

          {pages > 1 && (
            <nav aria-label={t('pagination')} className="mt-10 flex items-center justify-center gap-4">
              {page > 1 && (
                <Link href={blogHref({ categorie: params.categorie, tag: params.tag, page: page - 1 })} aria-label={t('previous')} className="grid size-11 place-items-center rounded-full border-2 border-fog-light text-navy-deep hover:border-navy-deep">
                  <ChevronLeft aria-hidden={true} className="size-5" />
                </Link>
              )}
              <p className="text-sm font-semibold text-navy-deep">{t('pageOf', { page, pages })}</p>
              {page < pages && (
                <Link href={blogHref({ categorie: params.categorie, tag: params.tag, page: page + 1 })} aria-label={t('next')} className="grid size-11 place-items-center rounded-full border-2 border-fog-light text-navy-deep hover:border-navy-deep">
                  <ChevronRight aria-hidden={true} className="size-5" />
                </Link>
              )}
            </nav>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
