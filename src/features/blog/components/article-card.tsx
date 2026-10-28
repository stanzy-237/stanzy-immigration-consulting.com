import { ArrowRight } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Image from 'next/image';
import type { ReactNode } from 'react';

import { categoryName } from '@/features/blog/lib/category-name';
import type { ArticleCard as Card } from '@/features/blog/server/blog-queries';
import { Link } from '@/i18n/navigation';

/** An Article in the Blog's list: cover, category, title, excerpt, date and reading time. */
export function ArticleCard({ article, locale }: { article: Card; locale: string }): ReactNode {
  const t = useTranslations('Blog');
  const format = useFormatter();

  return (
    <Link
      href={`/blog/${article.slug}`}
      aria-label={t('cardLabel', { title: article.title })}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border-2 border-fog-light bg-white no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-navy-deep hover:shadow-lg"
    >
      <div className="relative h-44 w-full shrink-0 overflow-hidden bg-ice-blue">
        {article.coverUrl && (
          <Image
            src={article.coverUrl}
            alt={article.coverAlt ?? ''}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        <span className="absolute bottom-3 left-3.5 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-navy-deep">
          <span aria-hidden={true} className="size-1.5 shrink-0 rounded-full bg-rouge" />
          {categoryName(article.category, locale)}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-5 pt-5 pb-5">
        <p className="mb-3 flex flex-wrap items-center gap-2.5 text-xs text-slate">
          <time dateTime={article.publishedAt.toISOString()}>
            {format.dateTime(article.publishedAt, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
          </time>
          <span aria-hidden={true} className="size-1 shrink-0 rounded-full bg-fog" />
          <span>{t('readingMinutes', { minutes: article.readingMinutes })}</span>
          {article.locale !== locale && (
            <span className="rounded-full bg-ice-blue px-2 py-0.5 font-semibold text-navy-deep">{t('inFrench')}</span>
          )}
        </p>
        <h2 className="font-heading text-lg font-bold leading-snug text-navy-deep transition-colors group-hover:text-rouge">
          {article.title}
        </h2>
        <p className="mt-2.5 flex-1 text-sm leading-relaxed text-slate">{article.excerpt}</p>
        <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-rouge transition-all group-hover:gap-2">
          {t('read')}
          <ArrowRight aria-hidden={true} className="size-3.5" strokeWidth={2.5} />
        </span>
      </div>
    </Link>
  );
}
