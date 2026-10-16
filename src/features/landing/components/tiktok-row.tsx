import { ArrowUpRight, Eye, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import type { ReactNode } from 'react';

import { TikTokGlyph } from '@/features/landing/components/brand-icons';
import {
  TIKTOK_VIDEOS,
  type TikTokVideo,
} from '@/features/landing/data/tiktok-videos';
import { cn } from '@/lib/utils';

const CHANNEL_HREF: string = 'https://www.tiktok.com/@stanzycanada';

// Six-card variant of the four organic-radius cards from the MagicPath
// design: three per row, radii cycle so each card still breaks the grid.
const CARD_RADII: ReadonlyArray<string> = [
  'rounded-[20px_20px_60px_20px]',
  'rounded-[20px_20px_20px_60px]',
  'rounded-[60px_20px_20px_20px]',
  'rounded-[20px_60px_20px_20px]',
  'rounded-[20px_20px_60px_20px]',
  'rounded-[20px_60px_20px_20px]',
] as const;

export function TikTokRow(): ReactNode {
  const t = useTranslations('Home.TikTok');
  const tVideos = useTranslations('Home.TikTok.Videos');

  return (
    <section
      aria-labelledby="tiktok-title"
      className="bg-[#F7F8FC] px-7 py-20"
    >
      <div className="mx-auto max-w-[1280px]">
        <header className="mb-14 flex items-start justify-between gap-10 max-lg:flex-col">
          <div className="basis-[55%]">
            <div className="mb-[18px] inline-flex items-center gap-[7px]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-black text-white">
                <TikTokGlyph className="h-4 w-4" />
              </span>
              <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#4A5568]">
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
            <p className="max-w-[380px] text-[17px] leading-[1.65] text-[#4A5568]">
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

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TIKTOK_VIDEOS.map(
            (v: TikTokVideo, i: number): ReactNode => (
              <li key={v.key}>
                <TikTokCard
                  video={v}
                  title={tVideos(v.titleKey)}
                  tags={tVideos(v.tagsKey)}
                  spinText={t('spinText')}
                  radiusClass={CARD_RADII[i] ?? CARD_RADII[0]}
                />
              </li>
            ),
          )}
        </ul>
      </div>
    </section>
  );
}

type TikTokCardProps = {
  video: TikTokVideo;
  title: string;
  tags: string;
  spinText: string;
  radiusClass: string;
};

function TikTokCard({
  video,
  title,
  tags,
  spinText,
  radiusClass,
}: TikTokCardProps): ReactNode {
  return (
    <a
      href={video.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={title}
      className={cn(
        'group relative block h-[320px] overflow-hidden shadow-[0_8px_24px_rgba(13,31,78,0.08)] transition-all hover:-translate-y-[5px] hover:scale-[1.02] hover:shadow-[0_20px_48px_rgba(13,31,78,0.22)]',
        radiusClass,
      )}
    >
      <Image
        src={video.thumbnail}
        alt=""
        fill
        sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
        unoptimized
        className="object-cover transition-transform duration-[350ms] ease-out group-hover:scale-[1.07]"
      />
      <div
        aria-hidden={true}
        className="absolute inset-0 bg-gradient-to-t from-navy-deep/[0.88] via-navy-deep/20 to-transparent"
      />
      {/* Top-left TikTok badge */}
      <span
        aria-hidden={true}
        className="absolute left-3 top-3 flex h-[22px] w-[22px] items-center justify-center rounded-md bg-black/85 text-white"
      >
        <TikTokGlyph className="h-[13px] w-[13px]" />
      </span>
      {/* Hover play circle */}
      <span
        aria-hidden={true}
        className="pointer-events-none absolute left-1/2 top-1/2 flex h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2 scale-0 items-center justify-center rounded-full bg-white/90 opacity-0 transition-all duration-200 group-hover:scale-100 group-hover:opacity-100"
      >
        <Play className="text-rouge ml-[3px] h-5 w-5" fill="currentColor" />
      </span>
      {/* Spinning text badge on featured card */}
      {video.spinner ? (
        <SpinningBadge text={spinText} />
      ) : null}
      {/* Bottom caption */}
      <div className="absolute inset-x-0 bottom-0 px-[18px] pb-[18px] pt-4">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 backdrop-blur-md">
          <Eye className="h-2.5 w-2.5 text-white" />
          <span className="text-[11px] font-semibold text-white">TikTok</span>
        </div>
        <p className="text-[14px] font-semibold leading-[1.35] text-white">
          {title}
        </p>
        <p className="mt-1 text-[11px] text-white/50">{tags}</p>
      </div>
    </a>
  );
}

function SpinningBadge({ text }: { text: string }): ReactNode {
  return (
    <span
      aria-hidden={true}
      className="pointer-events-none absolute right-3.5 top-3.5 h-[72px] w-[72px]"
    >
      <svg
        viewBox="0 0 72 72"
        className="h-[72px] w-[72px]"
        style={{ animation: 'tt-spin-text 10s linear infinite' }}
      >
        <defs>
          <path
            id="tt-spin-path"
            d="M36,36 m-26,0 a26,26 0 1,1 52,0 a26,26 0 1,1 -52,0"
          />
        </defs>
        <text
          fill="white"
          fontSize="7.5"
          fontFamily="Work Sans, sans-serif"
          letterSpacing="1.8"
        >
          <textPath href="#tt-spin-path">{text}</textPath>
        </text>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        <Play className="h-4 w-4 text-white" fill="currentColor" />
      </span>
      <style>{`@keyframes tt-spin-text { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}
