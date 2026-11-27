/* eslint-disable @next/next/no-img-element -- Satori draws plain <img>; next/image has no meaning in an ImageResponse. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';

import { categoryName } from '@/features/blog/lib/category-name';
import { getPublishedArticle } from '@/features/blog/server/blog-pages';
import { SHARE_IMAGE_SIZE } from '@/lib/share-metadata';

// Brand tokens (src/app/globals.css); the card is drawn by Satori, not Tailwind.
const NAVY = '#0D1F4E';
const NAVY_80 = '#1A3065';
const ROUGE = '#CC1627';
const SLATE = '#4A5568';
const ICE = '#E8EDF5';

const asset = (...path: string[]) => readFile(join(process.cwd(), ...path));
const dataUri = (bytes: Buffer, type: string) => `data:${type};base64,${bytes.toString('base64')}`;

/** The only cover formats Satori decodes; a WebP or AVIF upload would make the whole card fail. */
const DRAWABLE = new Set(['image/png', 'image/jpeg']);
const COVER_TIMEOUT_MS = 5000;
export const CARD_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=86400';

const typeFromName = (name: string) =>
  /\.png$/i.test(name) ? 'image/png' : /\.jpe?g$/i.test(name) ? 'image/jpeg' : null;

/**
 * The cover as a data URI Satori can draw, or null (the card then shows the
 * logo): a cover in `public/` is read from disk, an uploaded one (Blob storage)
 * is fetched here, so a failed fetch or an undrawable format never reaches Satori.
 */
export async function coverSource(coverUrl: string): Promise<string | null> {
  try {
    if (coverUrl.startsWith('/')) {
      const type = typeFromName(coverUrl);
      return type ? dataUri(await asset('public', coverUrl), type) : null;
    }
    const response = await fetch(coverUrl, { signal: AbortSignal.timeout(COVER_TIMEOUT_MS) });
    const type = response.headers.get('content-type')?.split(';')[0].trim() ?? '';
    if (!response.ok || !DRAWABLE.has(type)) return null;
    return dataUri(Buffer.from(await response.arrayBuffer()), type);
  } catch {
    return null;
  }
}

/**
 * An Article's share card (1200 × 630), the « Partage · /blog/[slug] · modèle »
 * design in Paper: the category, the title and the reading time on the left,
 * its 9:16 cover tilted on an ice-blue panel on the right. An unknown slug, or
 * an Article without a cover, still gets a card (the panel shows the logo).
 */
export async function articleShareImage(slug: string, locale: string): Promise<ImageResponse> {
  const [article, t, syne, jakarta, workSans, logo] = await Promise.all([
    getPublishedArticle(slug),
    getTranslations({ locale, namespace: 'Blog' }),
    asset('src/features/blog/assets/fonts/syne-extrabold.ttf'),
    asset('src/features/blog/assets/fonts/plus-jakarta-sans-bold.ttf'),
    asset('src/features/blog/assets/fonts/work-sans-regular.ttf'),
    asset('public/logo2.png'),
  ]);

  const title = article ? article.seoTitle || article.title : t('metaTitle');
  const eyebrow = article ? `Blog · ${categoryName(article.category, locale)}` : 'Blog';
  const meta = article ? `${t('readingMinutes', { minutes: article.readingMinutes })} · Stanzy` : 'Stanzy';
  const cover = article?.coverUrl ? await coverSource(article.coverUrl) : null;
  const logoSrc = dataUri(logo, 'image/png');

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#FFFFFF' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: 720,
            padding: '56px 24px 56px 72px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img src={logoSrc} width={96} height={88} alt="" style={{ objectFit: 'contain' }} />
            <div style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 18, letterSpacing: '0.08em', color: ROUGE, textTransform: 'uppercase' }}>
              {eyebrow}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div
              style={{
                fontFamily: 'Syne',
                fontSize: title.length > 60 ? 44 : 54,
                lineHeight: 1.08,
                letterSpacing: '-0.02em',
                color: NAVY,
                maxHeight: 300,
                overflow: 'hidden',
              }}
            >
              {title}
            </div>
            <div style={{ fontFamily: 'Work Sans', fontSize: 24, color: SLATE }}>{meta}</div>
          </div>
          <div style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 18, color: NAVY_80 }}>
            {`stanzy-immigration-consulting.com/${locale}/blog`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 480, backgroundColor: ICE }}>
          {cover ? (
            <img
              src={cover}
              width={288}
              height={512}
              alt=""
              style={{
                objectFit: 'cover',
                borderRadius: 24,
                border: '6px solid #FFFFFF',
                transform: 'rotate(4deg)',
                boxShadow: '0 24px 56px rgba(13,31,78,0.22)',
              }}
            />
          ) : (
            <img src={logoSrc} width={300} height={276} alt="" style={{ objectFit: 'contain' }} />
          )}
        </div>
      </div>
    ),
    {
      ...SHARE_IMAGE_SIZE,
      // Drawing takes seconds and share bots wait less than that: the CDN keeps
      // the card 5 minutes (like the Article, BLOG_CACHE_SECONDS) and serves the
      // last one for a day while it redraws.
      headers: { 'Cache-Control': CARD_CACHE_CONTROL },
      fonts: [
        { name: 'Syne', data: syne, weight: 800, style: 'normal' },
        { name: 'Plus Jakarta Sans', data: jakarta, weight: 700, style: 'normal' },
        { name: 'Work Sans', data: workSans, weight: 400, style: 'normal' },
      ],
    },
  );
}
