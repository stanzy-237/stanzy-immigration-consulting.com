'use client';

import { useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** One half of a tile, showing the top or the bottom of `text`. */
function Half({ text, side, className }: { text: string; side: 'top' | 'bottom'; className?: string }): ReactNode {
  return (
    <div
      className={cn(
        'absolute inset-x-0 h-12 overflow-hidden bg-navy-deep backface-hidden sm:h-16',
        side === 'top' ? 'top-0 rounded-t-xl' : 'bottom-0 rounded-b-xl',
        className,
      )}
    >
      {/* Joined by hand: `cn` would drop the custom sizes next to `text-white`. */}
      <span
        className={`absolute inset-x-0 flex h-24 items-center justify-center font-heading text-h2 leading-none font-bold text-white tabular-nums sm:h-32 sm:text-display ${
          side === 'top' ? 'top-0' : 'bottom-0'
        }`}
      >
        {text}
      </span>
    </div>
  );
}

/**
 * A flip-clock tile: when `text` changes, the old top half folds down and the
 * new bottom half falls into place. Without motion it simply changes. The
 * halves are drawn for the eye only; screen readers get `text` once.
 */
export function FlipTile({ text, className }: { text: string; className?: string }): ReactNode {
  const [shown, setShown] = useState(text);
  const [previous, setPrevious] = useState(text);
  if (text !== shown) {
    setPrevious(shown);
    setShown(text);
  }
  const flipping = previous !== shown;

  return (
    <div className={cn('relative h-24 rounded-xl shadow-md perspective-normal sm:h-32', className)}>
      <div aria-hidden={true}>
        <Half text={shown} side="top" />
        {/* Until the new bottom half lands, the old one stays underneath it. */}
        <Half text={flipping ? previous : shown} side="bottom" className="motion-reduce:hidden" />
        <Half text={shown} side="bottom" className="hidden motion-reduce:block" />
        {flipping && (
          <>
            <Half key={`top-${shown}`} text={previous} side="top" className="z-10 origin-bottom animate-flip-top motion-reduce:hidden" />
            <Half key={`bottom-${shown}`} text={shown} side="bottom" className="z-10 origin-top animate-flip-bottom motion-reduce:hidden" />
          </>
        )}
        <div className="absolute inset-x-0 top-1/2 z-20 h-px bg-ink-deep/60" />
      </div>
      <span className="sr-only">{text}</span>
    </div>
  );
}
