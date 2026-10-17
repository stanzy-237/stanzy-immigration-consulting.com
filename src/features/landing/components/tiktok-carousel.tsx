'use client';

import { ChevronLeft, ChevronRight, Eye, Play } from 'lucide-react';
import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { TikTokGlyph } from '@/features/landing/components/brand-icons';
import {
  formatViews,
  type TikTokVideoMeta,
} from '@/features/landing/server/fetch-tiktok-metadata';
import { cn } from '@/lib/utils';

type TikTokCarouselProps = {
  videos: ReadonlyArray<TikTokVideoMeta>;
  spinText: string;
  viewsLabel: string;
  prevLabel: string;
  nextLabel: string;
};

const CARD_RADII: ReadonlyArray<string> = [
  'rounded-[20px_20px_60px_20px]',
  'rounded-[20px_20px_20px_60px]',
  'rounded-[60px_20px_20px_20px]',
  'rounded-[20px_60px_20px_20px]',
  'rounded-[20px_20px_60px_20px]',
  'rounded-[20px_60px_20px_20px]',
] as const;

export function TikTokCarousel({
  videos,
  spinText,
  viewsLabel,
  prevLabel,
  nextLabel,
}: TikTokCarouselProps): ReactNode {
  const scroller = useRef<HTMLUListElement | null>(null);
  const items = useRef<Array<HTMLLIElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const groupId = useId();

  // Scroll the carousel so the given index is the leftmost card.
  const scrollToIndex = useCallback((i: number): void => {
    const el = items.current[i];
    const container = scroller.current;
    if (!el || !container) return;
    if (typeof container.scrollTo === 'function') {
      container.scrollTo({ left: el.offsetLeft, behavior: 'smooth' });
    } else {
      container.scrollLeft = el.offsetLeft;
    }
  }, []);

  // Track which card is centred using scroll position.
  useEffect(() => {
    const container = scroller.current;
    if (!container) return;
    let frame = 0;
    const onScroll = (): void => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame((): void => {
        const centre = container.scrollLeft + container.clientWidth / 2;
        let best = 0;
        let bestDist = Infinity;
        items.current.forEach((el: HTMLLIElement | null, i: number): void => {
          if (!el) return;
          const mid = el.offsetLeft + el.offsetWidth / 2;
          const d = Math.abs(mid - centre);
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        });
        setActiveIndex(best);
      });
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return (): void => {
      container.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const prev = (): void => scrollToIndex(Math.max(0, activeIndex - 1));
  const next = (): void => scrollToIndex(Math.min(videos.length - 1, activeIndex + 1));

  const navDisabled = useMemo(
    (): { prev: boolean; next: boolean } => ({
      prev: activeIndex === 0,
      next: activeIndex >= videos.length - 1,
    }),
    [activeIndex, videos.length],
  );

  return (
    <div className="relative">
      {/* Controls */}
      <div className="pointer-events-none absolute inset-y-0 -left-2 z-20 flex items-center max-md:hidden">
        <button
          type="button"
          onClick={prev}
          disabled={navDisabled.prev}
          aria-label={prevLabel}
          aria-controls={groupId}
          className="bg-navy-deep text-white pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-opacity disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
      <div className="pointer-events-none absolute inset-y-0 -right-2 z-20 flex items-center max-md:hidden">
        <button
          type="button"
          onClick={next}
          disabled={navDisabled.next}
          aria-label={nextLabel}
          aria-controls={groupId}
          className="bg-navy-deep text-white pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-opacity disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <ul
        id={groupId}
        ref={scroller}
        aria-live="polite"
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {videos.map((v: TikTokVideoMeta, i: number): ReactNode => (
          <li
            key={v.key}
            ref={(el: HTMLLIElement | null): void => {
              items.current[i] = el;
            }}
            className="snap-center shrink-0 basis-full sm:basis-1/2 lg:basis-[calc(33.333%-11px)]"
          >
            <TikTokCard
              video={v}
              active={i === activeIndex}
              radiusClass={CARD_RADII[i] ?? CARD_RADII[0]}
              spinText={spinText}
              viewsLabel={viewsLabel}
            />
          </li>
        ))}
      </ul>

      {/* Mobile dot indicators */}
      <div className="mt-5 flex justify-center gap-1.5 md:hidden">
        {videos.map((v: TikTokVideoMeta, i: number): ReactNode => (
          <button
            key={v.key}
            type="button"
            onClick={(): void => scrollToIndex(i)}
            aria-label={`${i + 1}`}
            className={cn(
              'h-1.5 rounded-full transition-all',
              i === activeIndex ? 'bg-rouge w-6' : 'bg-navy-deep/20 w-2',
            )}
          />
        ))}
      </div>
    </div>
  );
}

type TikTokCardProps = {
  video: TikTokVideoMeta;
  active: boolean;
  radiusClass: string;
  spinText: string;
  viewsLabel: string;
};

function TikTokCard({
  video,
  active,
  radiusClass,
  spinText,
  viewsLabel,
}: TikTokCardProps): ReactNode {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Play the active card with sound; mute and pause the rest. Browsers
  // block unmuted autoplay without a user gesture, so we fall back to
  // muted autoplay and expose a mute toggle on the card.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (active) {
      el.muted = false;
      const started = el.play();
      if (started && typeof started.catch === 'function') {
        started.catch((): void => {
          // Unmuted autoplay refused — retry muted so at least the frames play.
          el.muted = true;
          const muted = el.play();
          if (muted && typeof muted.catch === 'function') {
            muted.catch((): void => {});
          }
        });
      }
    } else {
      el.muted = true;
      el.pause();
      el.currentTime = 0;
    }
  }, [active]);

  const views = formatViews(video.views);
  const title = video.title || video.description || 'TikTok';
  const tagList = video.tags.slice(0, 3).join(' ');

  return (
    <a
      href={video.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={title}
      className={cn(
        'group relative block aspect-[9/14] h-full w-full overflow-hidden shadow-[0_8px_24px_rgba(13,31,78,0.08)] transition-all hover:shadow-[0_20px_48px_rgba(13,31,78,0.22)]',
        radiusClass,
        active ? 'scale-100' : 'scale-[0.97] opacity-80',
      )}
    >
      {video.playUrl ? (
        <video
          ref={videoRef}
          src={video.playUrl}
          poster={video.cover}
          muted={!active}
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <Image
          src={video.cover}
          alt=""
          fill
          sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
          unoptimized
          className="object-cover"
        />
      )}

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

      {/* Spinning badge only on the active playing card */}
      {active ? <SpinningBadge text={spinText} /> : null}

      {/* Bottom caption */}
      <div className="absolute inset-x-0 bottom-0 px-[18px] pb-[18px] pt-4">
        {views ? (
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 backdrop-blur-md">
            <Eye className="h-2.5 w-2.5 text-white" />
            <span className="text-[11px] font-semibold text-white">
              {views} {viewsLabel}
            </span>
          </div>
        ) : null}
        <p className="line-clamp-2 text-[14px] font-semibold leading-[1.35] text-white">
          {title}
        </p>
        {tagList ? (
          <p className="mt-1 text-[11px] text-white/60">{tagList}</p>
        ) : null}
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
