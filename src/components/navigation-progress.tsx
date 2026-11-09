'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { isPageNavigation } from '@/lib/page-navigation';

/** A page that arrives sooner than this never shows the bar: no flash on fast changes. */
const SHOW_AFTER_MS = 150;
/** How long the bar fills the width once the page is in place, then how long it fades: both `duration-200` below. */
const FILL_MS = 200;
const FADE_MS = 200;
/** A change that never lands (cancelled, failed) stops showing after this. */
const GIVE_UP_MS = 15_000;

type Phase = 'idle' | 'loading' | 'done' | 'fading';

/**
 * A thin rouge bar along the top of the screen while the next page loads,
 * started by a click on a link to another page of the app. It rushes ahead
 * then crawls (it can't know how long the page takes), fills the width once
 * the new URL is in place, and fades. With reduced motion it only fades.
 * A change made from code (`router.push` after a form) doesn't start it;
 * the page's `loading.tsx` skeleton still shows.
 */
export function NavigationProgress(): ReactNode {
  // useSearchParams needs a Suspense boundary, or it would hold back static pages.
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}

function Bar(): ReactNode {
  const t = useTranslations('Common');
  const pathname = usePathname();
  const url = `${pathname}?${useSearchParams().toString()}`;
  const [phase, setPhase] = useState<Phase>('idle');
  /** The click's pending timers: showing the bar, and giving up on it. */
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** The URL on screen, for timers set by an earlier render. */
  const shownUrl = useRef(url);
  useEffect(() => {
    shownUrl.current = url;
  }, [url]);

  // The new page is in place: fill, fade, done (set while rendering, as React advises).
  const [settledUrl, setSettledUrl] = useState(url);
  if (url !== settledUrl) {
    setSettledUrl(url);
    if (phase === 'loading') setPhase('done');
  }

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const link = { href: anchor.href, target: anchor.target, download: anchor.hasAttribute('download') };
      if (!isPageNavigation(event, link, new URL(window.location.href))) return;
      clear();
      const from = shownUrl.current;
      timers.current = [
        // Already arrived: never shown.
        setTimeout(() => shownUrl.current === from && setPhase('loading'), SHOW_AFTER_MS),
        setTimeout(() => setPhase((current) => (current === 'loading' ? 'idle' : current)), GIVE_UP_MS),
      ];
    };
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      clear();
    };
  }, []);

  useEffect(() => {
    if (phase === 'done') {
      const fade = setTimeout(() => setPhase('fading'), FILL_MS);
      return () => clearTimeout(fade);
    }
    if (phase === 'fading') {
      const end = setTimeout(() => setPhase('idle'), FADE_MS);
      return () => clearTimeout(end);
    }
  }, [phase]);

  if (phase === 'idle') return null;
  return (
    <div
      role="progressbar"
      aria-label={t('pageLoading')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={phase === 'loading' ? undefined : 100}
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-rouge',
        phase === 'loading'
          ? // From nothing (on mount) to 85 %, quickly at first, then crawling.
            'scale-x-85 transition-transform duration-8000 ease-out-expo starting:scale-x-0'
          : 'scale-x-100 transition duration-200 ease-out',
        phase === 'fading' && 'opacity-0',
        // Reduced motion: no sweep, the full bar fades in and out.
        'motion-reduce:scale-x-100 motion-reduce:transition-opacity motion-reduce:duration-200 motion-reduce:starting:opacity-0',
      )}
    />
  );
}
