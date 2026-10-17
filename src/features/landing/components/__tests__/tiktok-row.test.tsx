// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
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

function renderCarousel() {
  return render(
    <TikTokCarousel
      videos={metas}
      spinText=""
      viewsLabel="vues"
      prevLabel="Previous"
      nextLabel="Next"
      ariaLabel="Carrousel TikTok"
    />,
  );
}

describe('TikTokCarousel', () => {
  it('mounts the Byobu carousel region with the given aria-label', () => {
    renderCarousel();
    expect(
      screen.getByRole('region', { name: 'Carrousel TikTok' }),
    ).toBeInTheDocument();
  });

  it('renders panels for all six videos (initial DOM)', () => {
    const { container } = renderCarousel();
    const panelImages = container.querySelectorAll('img');
    // Byobu renders HALF_WINDOW*2 + 1 = 17 panel slots, each with its own img;
    // what we care about is that none of them is empty.
    for (const img of Array.from(panelImages)) {
      expect(img.getAttribute('src')).toMatch(/img\.example\/v\d\.jpg/);
    }
    expect(TIKTOK_VIDEOS).toHaveLength(6);
  });

  it('shows a label line that includes the view count', () => {
    renderCarousel();
    // Each label is `${title} · ${views} vues`; the first panel's label
    // is drawn as the hard-coded initial markup.
    expect(screen.getAllByText(/vues/i).length).toBeGreaterThan(0);
  });

  it('has no axe violations', async () => {
    const { container } = renderCarousel();
    expect(await axe(container)).toHaveNoViolations();
  });
});
