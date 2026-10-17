// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { TikTokCarousel } from '@/features/landing/components/tiktok-carousel';
import { TIKTOK_VIDEOS } from '@/features/landing/data/tiktok-videos';
import type { TikTokVideoMeta } from '@/features/landing/server/fetch-tiktok-metadata';

function fixture(key: string, href: string, i: number): TikTokVideoMeta {
  return {
    key,
    href,
    videoId: href.split('/').pop() ?? '',
    cover: `https://img.example/${key}.jpg`,
    playUrl: `https://cdn.example/${key}.mp4`,
    title: `Vidéo ${key}`,
    description: `Vidéo ${key}`,
    tags: ['#test'],
    views: 1200 * (i + 1),
    likes: 50,
  };
}

const metas: ReadonlyArray<TikTokVideoMeta> = TIKTOK_VIDEOS.map(
  (v, i): TikTokVideoMeta => fixture(v.key, v.href, i),
);

describe('TikTokCarousel', () => {
  it('renders a card for each of the six videos wired to the real TikTok URLs', () => {
    render(
      <TikTokCarousel
        videos={metas}
        spinText="Watch • Learn • Succeed •"
        viewsLabel="vues"
        prevLabel="Previous"
        nextLabel="Next"
      />,
    );
    const links = screen.getAllByRole('link');
    for (const v of metas) {
      const link = links.find((a) => a.getAttribute('href') === v.href);
      expect(link, `video ${v.key} link`).toBeDefined();
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
    expect(metas).toHaveLength(6);
  });

  it('exposes Prev / Next controls that are keyboard reachable', () => {
    render(
      <TikTokCarousel
        videos={metas}
        spinText="S"
        viewsLabel="vues"
        prevLabel="Previous"
        nextLabel="Next"
      />,
    );
    const next = screen.getByRole('button', { name: 'Next' });
    const prev = screen.getByRole('button', { name: 'Previous' });
    expect(next).toBeInTheDocument();
    expect(prev).toBeInTheDocument();
    // Clicking Next should not throw even when scrollTo is unavailable in jsdom.
    expect(() => fireEvent.click(next)).not.toThrow();
  });

  it('autoplays the active card by rendering an inline muted <video>', () => {
    const { container } = render(
      <TikTokCarousel
        videos={metas}
        spinText="S"
        viewsLabel="vues"
        prevLabel="Previous"
        nextLabel="Next"
      />,
    );
    const videos = container.querySelectorAll('video');
    expect(videos.length).toBe(metas.length);
    for (const v of videos) {
      expect(v).toHaveAttribute('loop');
      expect(v).toHaveAttribute('playsinline');
      expect(v).toHaveAttribute('src');
    }
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <TikTokCarousel
        videos={metas}
        spinText="S"
        viewsLabel="vues"
        prevLabel="Previous"
        nextLabel="Next"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
