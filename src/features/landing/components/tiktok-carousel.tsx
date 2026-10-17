'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import ByobuCarousel, {
  type ByobuItem,
} from '@/components/ui/ByobuCarousel';
import {
  formatViews,
  type TikTokVideoMeta,
} from '@/features/landing/server/fetch-tiktok-metadata';

type TikTokCarouselProps = {
  videos: ReadonlyArray<TikTokVideoMeta>;
  spinText: string;
  viewsLabel: string;
  prevLabel: string;
  nextLabel: string;
  ariaLabel: string;
};

type PanelSize = { width: number; height: number };

// Byobu panels are rendered at fixed pixel sizes; adapt them to the viewport
// so the carousel breathes on phones, tablets, and widescreens.
function usePanelSize(): PanelSize {
  const [size, setSize] = useState<PanelSize>({ width: 240, height: 380 });

  useEffect(() => {
    const measure = (): void => {
      const vw = window.innerWidth;
      // Phones: 1 panel visible; tablets: ~2 peek; desktop: 3 clean.
      const width = Math.max(170, Math.min(260, Math.round(vw * 0.22)));
      // Keep the 9:14-ish portrait ratio TikTok shoots.
      const height = Math.round((width * 14) / 9);
      setSize({ width, height });
    };
    measure();
    window.addEventListener('resize', measure);
    return (): void => window.removeEventListener('resize', measure);
  }, []);

  return size;
}

export function TikTokCarousel({
  videos,
  viewsLabel,
  ariaLabel,
}: TikTokCarouselProps): ReactNode {
  const { width, height } = usePanelSize();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const items: ByobuItem[] = videos.map((v: TikTokVideoMeta): ByobuItem => {
    const views = formatViews(v.views);
    const label = views
      ? `${v.title || 'TikTok'} · ${views} ${viewsLabel}`
      : v.title || 'TikTok';
    return {
      image: v.cover,
      alt: v.title || 'TikTok',
      label,
    };
  });

  return (
    <div className="flex flex-col items-stretch gap-6">
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-3xl"
        style={{ height: Math.min(height + 60, 540) }}
      >
        <ByobuCarousel
          items={items}
          panelWidth={width}
          panelHeight={height}
          autoplay
          autoplaySpeed={0.3}
          background="#F7F8FC"
          borderColor="rgba(13,31,78,0.08)"
          showLabels
          vignette
          ariaLabel={ariaLabel}
        />
      </div>
    </div>
  );
}
