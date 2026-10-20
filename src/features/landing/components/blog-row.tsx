import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import type { ReactNode } from 'react';

import { Link } from '@/i18n/navigation';

import { ARTICLES, type Article } from '@/features/landing/data/articles';

type LargeCardProps = {
  article: Article;
  featured: boolean;
  title: string;
  excerpt: string | null;
  category: string;
  reading: string;
  cta: string;
  cardAriaLabel: string;
  imageAlt: string;
};

function LargeCard({
  article,
  featured,
  title,
  excerpt,
  category,
  reading,
  cta,
  cardAriaLabel,
  imageAlt,
}: LargeCardProps): ReactNode {
  
  return (
    <Link
      href={`/blog/${article.slug}`}
      aria-label={cardAriaLabel}
      className={
        'group relative flex h-full w-full flex-col overflow-hidden rounded-[20px] border-[1.5px] border-[#E2E8F0] bg-white no-underline transition-all duration-200 ease-out ' +
        'hover:-translate-y-[3px] hover:border-navy-deep hover:shadow-[0_12px_36px_rgba(13,31,78,0.10)]'
      }
    >
      {/* Gradient top bar on hover */}
      <span
        aria-hidden={true}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[3px] rounded-t-[20px] bg-[linear-gradient(90deg,#CC1627,#0D1F4E)] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />
      {/* Image wrap — shrink-0 so the body gets any extra height the card
          absorbs from the 2-row span. */}
      <div
        className={
          'relative w-full shrink-0 overflow-hidden ' +
          (featured ? 'h-[280px]' : 'h-[160px]')
        }
      >
        <Image
          src={article.image}
          alt={imageAlt}
          fill
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="object-cover transition-transform duration-[380ms] ease-out group-hover:scale-105"
          unoptimized
        />
        {/* Darkening overlay for category pill contrast */}
        <span
          aria-hidden={true}
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(13,31,78,0.35)_0%,transparent_60%)]"
        />
        {/* Category pill */}
        <span className="absolute bottom-3 left-3.5 inline-flex items-center gap-[5px] rounded-full bg-white/90 px-3 py-1 font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-navy-deep backdrop-blur-[6px]">
          <span
            aria-hidden={true}
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-rouge"
          />
          {category}
        </span>
      </div>

      {/* Body */}
      <div
        className={
          'flex flex-1 flex-col ' +
          (featured ? 'px-6 pb-6 pt-[22px]' : 'px-5 pb-5 pt-[18px]')
        }
      >
        {/* Meta */}
        <div className="mb-3 flex items-center gap-2.5">
          <span className="text-[12px] text-[#4A5568]">{article.date}</span>
          <span
            aria-hidden={true}
            className="h-[3px] w-[3px] shrink-0 rounded-full bg-[#CBD5E0]"
          />
          <span className="text-[12px] text-[#4A5568]">{reading}</span>
        </div>
        {/* Title */}
        <h3
          className={
            'font-heading font-bold leading-[1.3] text-navy-deep transition-colors duration-150 group-hover:text-rouge ' +
            (featured ? 'text-[18px]' : 'text-[15px]')
          }
        >
          {title}
        </h3>
        {/* Excerpt — featured only, and hidden on mobile to match the
            compact rhythm of the other two large cards. */}
        {featured && excerpt ? (
          <p className="mt-2.5 hidden flex-1 text-[14px] leading-[1.65] text-[#4A5568] md:block">
            {excerpt}
          </p>
        ) : null}
        {/* Footer */}
        <div className="mt-[18px] flex items-center justify-between border-t border-[#E8EDF5] pt-4">
          <div className="flex items-center gap-2">
            <span
              aria-hidden={true}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0D1F4E,#CC1627)] font-sans text-[10px] font-bold text-white"
            >
              {article.authorInitials}
            </span>
            <span className="text-[12px] font-medium text-[#4A5568]">
              {article.authorName}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-rouge transition-[gap] duration-150 group-hover:gap-2">
            {cta}
            <ArrowRight className="h-[13px] w-[13px]" strokeWidth={2.5} />
          </span>
        </div>
      </div>
    </Link>
  );
}

type SmallCardProps = {
  article: Article;
  title: string;
  category: string;
  reading: string;
  imageAlt: string;
};

function SmallCard({
  article,
  title,
  category,
  reading,
  imageAlt,
}: SmallCardProps): ReactNode {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border-[1.5px] border-[#E2E8F0] bg-white p-4 no-underline transition-all duration-200 ease-out hover:-translate-y-[2px] hover:border-navy-deep hover:shadow-[0_8px_24px_rgba(13,31,78,0.09)]"
    >
      {/* Left accent bar on hover */}
      <span
        aria-hidden={true}
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px] rounded-l-2xl bg-[linear-gradient(to_bottom,#CC1627,#0D1F4E)] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[10px]">
        <Image
          src={article.image}
          alt={imageAlt}
          fill
          sizes="56px"
          className="object-cover"
          unoptimized
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-rouge">
          {category}
        </p>
        <p className="mt-1 truncate text-[13px] font-semibold leading-[1.35] text-navy-deep transition-colors duration-150 group-hover:text-rouge">
          {title}
        </p>
        <p className="mt-1 text-[11px] text-[#4A5568]">
          {article.date} · {reading}
        </p>
      </div>
    </Link>
  );
}

export function BlogRow(): ReactNode {
  const t = useTranslations('Home.BlogRow');
  const tCat = useTranslations('Home.BlogRow.Categories');
  const tArt = useTranslations('Home.BlogRow.Articles');

  const large = ARTICLES.filter((a: Article): boolean => a.size === 'lg');
  const small = ARTICLES.filter((a: Article): boolean => a.size === 'sm');

  return (
    <section
      aria-labelledby="blog-row-title"
      className="bg-white px-7 py-[88px]"
    >
      <div className="mx-auto max-w-[1280px]">
        {/* Header: eyebrow + title on the left, "See all" button on the right. */}
        <div className="mb-12 flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div className="flex-1">
            <div className="mb-[18px] inline-flex items-center gap-2 rounded-full border-[1.5px] border-[#CBD5E0] bg-[#E8EDF5] px-3.5 py-[5px]">
              <span
                aria-hidden={true}
                className="h-1 w-[18px] shrink-0 self-center rounded-full bg-navy-deep"
              />
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-deep">
                {t('eyebrow')}
              </span>
            </div>
            <h2
              id="blog-row-title"
              className="font-heading text-[clamp(32px,4vw,50px)] font-bold leading-[1.05] tracking-[-0.03em] text-navy-deep"
            >
              {t('titleLead')}
              <br />
              <span className="text-rouge">{t('titleAccent')}</span>
            </h2>
          </div>
          <div className="shrink-0 pb-1.5">
            <Link
              href="/blog"
              className="group inline-flex h-[42px] items-center gap-2 rounded-full border-[1.5px] border-[#CBD5E0] bg-transparent pl-[18px] pr-2.5 font-sans text-[13px] font-semibold text-navy-deep no-underline transition-all duration-200 hover:border-navy-deep hover:bg-[#F7F8FC]"
            >
              {t('seeAll')}
              <span
                aria-hidden={true}
                className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-navy-deep transition-all duration-200 group-hover:rotate-45 group-hover:bg-rouge"
              >
                <ArrowUpRight className="h-[13px] w-[13px] text-white" strokeWidth={2.5} />
              </span>
            </Link>
          </div>
        </div>

        {/* Main grid: 1-col mobile, 2-col ≥md, 1.2fr/1fr with featured spanning 2 rows at lg+. */}
        <ul className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-[1.2fr_1fr] lg:grid-rows-2">
          {large.map(
            (article: Article, i: number): ReactNode => (
              <li
                key={article.slug}
                className={i === 0 ? 'lg:row-span-2' : ''}
              >
                <LargeCard
                  article={article}
                  featured={i === 0}
                  title={tArt(article.titleKey)}
                  excerpt={
                    article.excerptKey ? tArt(article.excerptKey) : null
                  }
                  category={tCat(article.categoryKey)}
                  reading={
                    i === 0
                      ? t('readingMinutes', {
                          minutes: article.readingMinutes,
                        })
                      : t('readingMinutesShort', {
                          minutes: article.readingMinutes,
                        })
                  }
                  cta={i === 0 ? t('readFull') : t('read')}
                  imageAlt={tArt(article.imageAltKey)}
                  cardAriaLabel={t('cardAriaLabel', {
                    title: tArt(article.titleKey),
                  })}
                />
              </li>
            ),
          )}
        </ul>

        {/* Small grid: 3 compact rows below the main grid. */}
        <ul className="mt-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {small.map(
            (article: Article): ReactNode => (
              <li key={article.slug}>
                <SmallCard
                  article={article}
                  title={tArt(article.titleKey)}
                  category={tCat(article.categoryKey)}
                  reading={t('readingMinutesShort', {
                    minutes: article.readingMinutes,
                  })}
                  imageAlt={tArt(article.imageAltKey)}
                />
              </li>
            ),
          )}
        </ul>
      </div>
    </section>
  );
}
