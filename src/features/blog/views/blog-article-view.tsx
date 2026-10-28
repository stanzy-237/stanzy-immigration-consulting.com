import { ArrowLeft } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { ArticleBody } from '@/features/blog/components/article-body';
import { categoryName } from '@/features/blog/lib/category-name';
import { toBlogLocale } from '@/features/blog/lib/blog-schema';
import { getPublishedArticle } from '@/features/blog/server/blog-pages';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { Link } from '@/i18n/navigation';

/** A published Article's page; a draft or an unknown slug is the site's 404. */
export async function BlogArticleView({ locale: rawLocale, slug }: { locale: string; slug: string }): Promise<ReactNode> {
  const locale = toBlogLocale(rawLocale);
  const article = await getPublishedArticle(slug);
  if (!article) notFound();

  const t = await getTranslations({ locale, namespace: 'Blog' });
  const format = await getFormatter({ locale });

  return (
    <>
      <SiteNav />
      <main className="bg-white">
        <article className="mx-auto max-w-3xl px-4 py-10 sm:px-7 sm:py-14" lang={article.locale}>
          <Link href="/blog" className="mb-8 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-deep hover:text-rouge">
            <ArrowLeft aria-hidden={true} className="size-4" />
            {t('backToBlog')}
          </Link>
          <header>
            <Link
              href={{ pathname: '/blog', query: { categorie: article.category.slug } }}
              className="inline-flex items-center gap-1.5 rounded-full bg-blush px-3 py-1 text-xs font-semibold uppercase tracking-widest text-rouge"
            >
              <span aria-hidden={true} className="size-1.5 shrink-0 rounded-full bg-rouge" />
              {categoryName(article.category, locale)}
            </Link>
            <h1 className="mt-4 font-heading text-3xl font-bold leading-tight tracking-tight text-navy-deep sm:text-4xl">
              {article.title}
            </h1>
            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate">
              <span>{t('by', { author: article.authorName })}</span>
              <span aria-hidden={true} className="size-1 rounded-full bg-fog" />
              <time dateTime={article.publishedAt.toISOString()}>
                {format.dateTime(article.publishedAt, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
              </time>
              <span aria-hidden={true} className="size-1 rounded-full bg-fog" />
              <span>{t('readingMinutes', { minutes: article.readingMinutes })}</span>
              {article.locale !== locale && (
                <span className="rounded-full bg-ice-blue px-2 py-0.5 text-xs font-semibold text-navy-deep">{t('inFrench')}</span>
              )}
            </p>
          </header>

          {article.coverUrl && (
            <div className="relative mt-8 aspect-video w-full overflow-hidden rounded-2xl bg-ice-blue">
              <Image src={article.coverUrl} alt={article.coverAlt ?? ''} fill priority sizes="(min-width: 768px) 768px, 100vw" className="object-cover" />
            </div>
          )}

          <div className="mt-8">
            <ArticleBody html={article.html} />
          </div>

          {article.tags.length > 0 && (
            <footer className="mt-10 border-t border-fog-light pt-6">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate">{t('tags')}</h2>
              <ul className="flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <li key={tag}>
                    <Link
                      href={{ pathname: '/blog', query: { tag } }}
                      className="inline-flex h-9 items-center rounded-full border-2 border-fog-light px-3.5 text-sm font-semibold text-navy-deep hover:border-navy-deep"
                    >
                      #{tag}
                    </Link>
                  </li>
                ))}
              </ul>
            </footer>
          )}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
