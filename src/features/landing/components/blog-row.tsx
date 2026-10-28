import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Image from 'next/image';
import type { ReactNode } from 'react';

// The blog's data types and naming only: no blog component crosses into landing (folder rule 3).
import { categoryName } from '@/features/blog/lib/category-name';
import type { ArticleCard } from '@/features/blog/server/blog-queries';
import { Link } from '@/i18n/navigation';

type CardProps = { article: ArticleCard; locale: string };

function useCardText(article: ArticleCard, locale: string) {
  const format = useFormatter();
  return {
    category: categoryName(article.category, locale),
    date: format.dateTime(article.publishedAt, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
  };
}

function LargeCard({ article, locale, featured }: CardProps & { featured: boolean }): ReactNode {
  const t = useTranslations('Home.BlogRow');
  const { category, date } = useCardText(article, locale);

  return (
    <Link
      href={`/blog/${article.slug}`}
      aria-label={t('cardAriaLabel', { title: article.title })}
      className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border-2 border-fog-light bg-white no-underline transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-navy-deep hover:shadow-lg"
    >
      <span
        aria-hidden={true}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.75 rounded-t-2xl bg-linear-90 from-rouge to-navy-deep opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />
      <div className={`relative w-full shrink-0 overflow-hidden bg-ice-blue ${featured ? 'h-70' : 'h-40'}`}>
        {article.coverUrl && (
          <Image
            src={article.coverUrl}
            alt={article.coverAlt ?? ''}
            fill
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover transition-transform duration-380 ease-out group-hover:scale-105"
          />
        )}
        <span
          aria-hidden={true}
          className="pointer-events-none absolute inset-0 bg-linear-to-t from-navy-deep/35 to-transparent to-60%"
        />
        <span className="absolute bottom-3 left-3.5 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 font-sans text-xs font-semibold uppercase tracking-widest text-navy-deep backdrop-blur-sm">
          <span aria-hidden={true} className="size-1.5 shrink-0 rounded-full bg-rouge" />
          {category}
        </span>
      </div>

      <div className={`flex flex-1 flex-col ${featured ? 'px-6 pt-5 pb-6' : 'px-5 pt-5 pb-5'}`}>
        <div className="mb-3 flex items-center gap-2.5">
          <span className="text-xs text-slate">{date}</span>
          <span aria-hidden={true} className="size-0.75 shrink-0 rounded-full bg-fog" />
          <span className="text-xs text-slate">
            {featured
              ? t('readingMinutes', { minutes: article.readingMinutes })
              : t('readingMinutesShort', { minutes: article.readingMinutes })}
          </span>
        </div>
        <h3
          className={`font-heading font-bold leading-snug text-navy-deep transition-colors duration-150 group-hover:text-rouge ${featured ? 'text-lg' : 'text-base'}`}
        >
          {article.title}
        </h3>
        {/* Excerpt: featured only, and hidden on phones to match the other two large cards. */}
        {featured && <p className="mt-2.5 hidden flex-1 text-sm leading-relaxed text-slate md:block">{article.excerpt}</p>}
        <div className="mt-4 flex items-center justify-end border-t border-ice-blue pt-4">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rouge transition-all duration-150 group-hover:gap-2">
            {featured ? t('readFull') : t('read')}
            <ArrowRight className="size-3.5" strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function SmallCard({ article, locale }: CardProps): ReactNode {
  const t = useTranslations('Home.BlogRow');
  const { category, date } = useCardText(article, locale);

  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border-2 border-fog-light bg-white p-4 no-underline transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-navy-deep hover:shadow-md"
    >
      <span
        aria-hidden={true}
        className="pointer-events-none absolute inset-y-0 left-0 w-0.75 rounded-l-2xl bg-linear-to-b from-rouge to-navy-deep opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />
      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-ice-blue">
        {article.coverUrl && (
          <Image src={article.coverUrl} alt={article.coverAlt ?? ''} fill sizes="56px" className="object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-sans text-xs font-semibold uppercase tracking-widest text-rouge">{category}</p>
        <p className="mt-1 truncate text-sm font-semibold leading-snug text-navy-deep transition-colors duration-150 group-hover:text-rouge">
          {article.title}
        </p>
        <p className="mt-1 text-xs text-slate">
          {date} · {t('readingMinutesShort', { minutes: article.readingMinutes })}
        </p>
      </div>
    </Link>
  );
}

/**
 * « Blog & Ressources » on the home page: the latest published Articles,
 * three large (the first featured) then up to three compact ones. Hidden
 * until the first Article is published.
 */
export function BlogRow({ articles, locale }: { articles: ArticleCard[]; locale: string }): ReactNode {
  const t = useTranslations('Home.BlogRow');
  if (articles.length === 0) return null;
  const large = articles.slice(0, 3);
  const small = articles.slice(3, 6);

  return (
    <section aria-labelledby="blog-row-title" className="bg-white px-5 py-14 md:px-7 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div className="flex-1">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-fog bg-ice-blue px-3.5 py-1.5">
              <span aria-hidden={true} className="h-1 w-4 shrink-0 self-center rounded-full bg-navy-deep" />
              <span className="font-sans text-xs font-semibold uppercase tracking-widest text-navy-deep">{t('eyebrow')}</span>
            </div>
            <h2
              id="blog-row-title"
              className="font-heading text-[clamp(32px,4vw,50px)] font-bold leading-none tracking-tight text-navy-deep"
            >
              {t('titleLead')}
              <br />
              <span className="text-rouge">{t('titleAccent')}</span>
            </h2>
          </div>
          <div className="shrink-0 pb-1.5">
            <Link
              href="/blog"
              className="group inline-flex h-11 items-center gap-2 rounded-full border-2 border-fog bg-transparent pr-2.5 pl-5 font-sans text-sm font-semibold text-navy-deep no-underline transition-all duration-200 hover:border-navy-deep hover:bg-off-white"
            >
              {t('seeAll')}
              <span
                aria-hidden={true}
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy-deep transition-all duration-200 group-hover:rotate-45 group-hover:bg-rouge"
              >
                <ArrowUpRight className="size-3.5 text-white" strokeWidth={2.5} />
              </span>
            </Link>
          </div>
        </div>

        {/* 1 column on phones, 2 from tablets; at lg the featured card spans both rows. */}
        <ul className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-rows-2">
          {large.map((article, i) => (
            <li key={article.slug} className={i === 0 ? 'lg:row-span-2' : ''}>
              <LargeCard article={article} locale={locale} featured={i === 0} />
            </li>
          ))}
        </ul>

        {small.length > 0 && (
          <ul className="mt-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-3">
            {small.map((article) => (
              <li key={article.slug}>
                <SmallCard article={article} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
