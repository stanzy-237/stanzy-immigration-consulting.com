import { ArrowUpRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { TikTokGlyph } from '@/features/landing/components/brand-icons';
import { TikTokCarousel } from '@/features/landing/components/tiktok-carousel';
import {
  TIKTOK_VIDEOS,
  type TikTokVideo,
} from '@/features/landing/data/tiktok-videos';
import { fetchTikTokMetadata } from '@/features/landing/server/fetch-tiktok-metadata';
import {
  entryToMeta,
  fetchTikTokManifest,
} from '@/features/landing/server/fetch-tiktok-manifest';

const CHANNEL_HREF: string = 'https://www.tiktok.com/@stanzycanada';

async function loadFallbackMetas() {
  const metas = [];
  for (const v of TIKTOK_VIDEOS as ReadonlyArray<TikTokVideo>) {
    metas.push(await fetchTikTokMetadata(v));
  }
  return metas;
}

export async function TikTokRow(): Promise<ReactNode> {
  const t = await getTranslations('Home.TikTok');

  // Primary path: the weekly GitHub Actions job uploads real MP4s + a
  // manifest to Vercel Blob. If that's absent (e.g. first deploy before
  // the cron has run), fall back to the live tikwm proxy per-video.
  const manifest = await fetchTikTokManifest();
  const metas = manifest
    ? manifest.videos.map(entryToMeta)
    : await loadFallbackMetas();

  return (
    <section aria-labelledby="tiktok-title" className="px-7 py-20">
      <div className="mx-auto max-w-[1280px]">
        <header className="mb-14 flex items-start justify-between gap-10 max-lg:flex-col">
          <div className="basis-[55%]">
            <div className="mb-[18px] inline-flex items-center gap-[7px]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-black text-white">
                <TikTokGlyph className="h-4 w-4" />
              </span>
              <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate">
                {t('eyebrow')}
              </span>
            </div>
            <h2
              id="tiktok-title"
              className="font-heading text-navy-deep text-[clamp(32px,4vw,52px)] font-bold leading-[1.05] tracking-[-0.03em]"
            >
              {t('titleLead')}{' '}
              <span className="text-rouge">{t('titleAccent')}</span>
              <br />
              {t('titleRest')}
            </h2>
          </div>
          <div className="flex flex-1 flex-col items-start justify-end gap-5 pt-2">
            <p className="max-w-[380px] text-[17px] leading-[1.65] text-slate">
              {t('subtitle')}
            </p>
            <a
              href={CHANNEL_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-navy-deep hover:bg-navy-80 inline-flex h-[46px] items-center gap-2.5 rounded-full pl-5 pr-2.5 font-heading text-[14px] font-bold text-white shadow-[0_4px_14px_rgba(13,31,78,0.2)] transition-all hover:-translate-y-[1px]"
            >
              <TikTokGlyph className="h-[18px] w-[18px]" />
              <span>{t('cta')}</span>
              <span
                aria-hidden={true}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15"
              >
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
            </a>
          </div>
        </header>

        <TikTokCarousel
          videos={metas}
          spinText={t('spinText')}
          viewsLabel={t('viewsLabel')}
          prevLabel={t('prev')}
          nextLabel={t('next')}
        />
      </div>
    </section>
  );
}
