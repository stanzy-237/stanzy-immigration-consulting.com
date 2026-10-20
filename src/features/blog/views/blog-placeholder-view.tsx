import { ArrowLeft, BookOpen, Hammer } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { ARTICLES, type Article } from '@/features/landing/data/articles';
import { Link } from '@/i18n/navigation';

export type BlogPlaceholderProps = {
  // When present, we render the article's title (from the ARTICLES catalog).
  // When absent, we render the generic "blog in development" copy.
  slug?: string;
};

export function BlogPlaceholderView({
  slug,
}: BlogPlaceholderProps): ReactNode {
  const t = useTranslations('BlogPlaceholder');
  const tArt = useTranslations('Home.BlogRow.Articles');

  const article: Article | undefined = slug
    ? ARTICLES.find((a: Article): boolean => a.slug === slug)
    : undefined;

  return (
    <>
      <SiteNav />
      <main>
        <section
          aria-labelledby="blog-placeholder-title"
          className="bg-off-white px-7 py-[120px]"
        >
          <div className="mx-auto flex max-w-[640px] flex-col items-center text-center">
            {/* Status pill */}
            <div className="mb-7 inline-flex items-center gap-[7px] rounded-full border-[1.5px] border-rose bg-blush px-3.5 py-[5px]">
              <Hammer className="h-3 w-3 text-rouge" strokeWidth={2.5} />
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-rouge">
                {t('status')}
              </span>
            </div>

            {/* Icon tile */}
            <span
              aria-hidden={true}
              className="mb-7 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_8px_28px_rgba(13,31,78,0.12)]"
            >
              <BookOpen
                className="h-8 w-8 text-navy-deep"
                strokeWidth={1.75}
              />
            </span>

            {/* Title — article title when a slug matches, generic otherwise. */}
            <h1
              id="blog-placeholder-title"
              className="font-heading text-[clamp(32px,4vw,48px)] font-bold leading-[1.08] tracking-[-0.03em] text-navy-deep"
            >
              {article ? tArt(article.titleKey) : t('title')}
            </h1>

            {/* Explainer copy */}
            <p className="mt-4 max-w-[520px] text-[17px] leading-[1.6] text-slate">
              {article ? t('articleDescription') : t('listingDescription')}
            </p>

            {/* Teaser for an unknown slug — reassure the visitor the URL isn't dead. */}
            {slug && !article ? (
              <p className="mt-3 max-w-[520px] text-[14px] italic leading-[1.6] text-slate">
                {t('unknownSlug', { slug })}
              </p>
            ) : null}

            {/* Back link */}
            <Link
              href="/"
              className="mt-10 inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-navy-deep bg-navy-deep px-5 font-heading text-[14px] font-semibold text-white transition-all hover:-translate-y-[1px] hover:border-rouge hover:bg-rouge"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
              {t('back')}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
