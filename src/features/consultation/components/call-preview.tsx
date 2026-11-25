'use client';

import { motion, useInView, useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { EASE_OUT } from '@/components/ui/reveal';
import { LABEL_CLASS } from '@/features/consultation/lib/styles';
import { cn } from '@/lib/utils';

const WORD_MS = 40;
const HOLD_MS = 3000;

/**
 * The hero's picture of a Consultation: Stanzy on a video call, captioned
 * (docs/design/consultation-motion.md, row « Hero »). It plays once on load,
 * then rests: Stanzy waves twice, each caption types word by word and holds,
 * and the last one stays. The « REC » dot and the chips' drift run only while
 * the hero is on screen. With reduced motion it is a still frame, last caption shown.
 */
export function CallPreview({ className }: { className?: string }): ReactNode {
  const t = useTranslations('Consultation.page.hero.call');
  const captions = t.raw('captions') as string[];
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const reduce = useReducedMotion();
  const playing = inView && !reduce;
  const caption = useTypedCaptions(captions, Boolean(reduce));

  return (
    <div ref={ref} className={cn('relative flex flex-col pt-1.5 pb-4.5 lg:pt-2 lg:pr-8 lg:pb-7', className)}>
      <div className="flex flex-col overflow-hidden rounded-2xl lg:border lg:border-white/12 lg:bg-navy-80 lg:shadow-2xl lg:shadow-ink-deep/45">
        <div className="hidden items-center justify-between border-b border-white/8 px-4 py-3 lg:flex">
          <RecLabel playing={playing} label={t('rec', { time: '00:12:45' })} />
          <p className="text-caption leading-4 text-fog">{t('where')}</p>
        </div>
        <div className="flex h-50 gap-2.5 lg:h-55 lg:px-3 lg:pt-3">
          {/* Stanzy's tile: the rouge arc is the Consultation's horizon. */}
          <div className="relative flex min-w-0 flex-3 items-end justify-center overflow-hidden rounded-2xl bg-ice-blue lg:rounded-xl">
            <div aria-hidden={true} className="absolute -inset-x-10 -bottom-37.5 h-55 rounded-full border-t-4 border-rouge lg:opacity-90" />
            <Image
              unoptimized={true}
              src={reduce ? '/stanzy/wave.svg' : '/stanzy/wave-twice.svg'}
              alt=""
              width={150}
              height={262}
              className="relative h-54 w-31 shrink-0 translate-y-13 lg:-mb-17.5 lg:h-65.5 lg:w-37.5 lg:translate-y-0"
            />
            <div className="absolute top-3 left-3 lg:hidden">
              <RecLabel playing={playing} label={t('recShort', { time: '12:45' })} compact={true} />
            </div>
            <p className="absolute bottom-2.5 left-2.5 hidden rounded-full bg-navy-deep/85 px-2.5 py-1 text-caption leading-4 font-semibold text-white lg:block">
              {t('stanzy')}
            </p>
            {/* Mobile: the visitor is a small tile over Stanzy's. */}
            <div className="absolute top-3 right-3 flex h-21 w-16 items-center justify-center rounded-lg border-2 border-white bg-ink-deep lg:hidden">
              <VisitorIcon className="size-10" />
            </div>
          </div>
          <div className="relative hidden min-w-0 flex-2 items-center justify-center overflow-hidden rounded-xl bg-ink-deep lg:flex">
            <svg aria-hidden={true} viewBox="0 0 96 96" className="size-24">
              <circle cx="48" cy="48" r="46" className="fill-navy-80" />
              <circle cx="48" cy="40" r="15" fill="none" className="stroke-ice-blue" strokeWidth="3.5" />
              <path d="M22 80c4-14 14-21 26-21s22 7 26 21" fill="none" className="stroke-ice-blue" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
            <p className="absolute bottom-2.5 left-2.5 rounded-full bg-white/12 px-2.5 py-1 text-caption leading-4 font-semibold text-white">
              {t('you')}
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2.5 px-4 pt-3 pb-3.5 lg:flex">
          <span aria-hidden={true} className="flex h-3.5 shrink-0 items-end gap-0.5">
            {['h-1.5', 'h-3.5', 'h-2.25'].map((h) => (
              <span key={h} className={cn('w-0.75 rounded-xs bg-rose', h)} />
            ))}
          </span>
          {/* Every caption keeps the line's height, so the card never jumps as words arrive. */}
          <p aria-hidden={true} className="min-h-5 text-body-sm leading-5 text-white">
            {caption}
          </p>
        </div>
      </div>
      <p className="sr-only">{captions.at(-1)}</p>

      <Chip index={0} playing={playing} place="top-19 right-0 hidden lg:block" className="rotate-3 gap-2.5 rounded-2xl px-3.5 py-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blush">
          <TrendIcon className="size-4.5" />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className={cn(LABEL_CLASS, 'text-slate')}>{t('crsLabel')}</span>
          <span className="font-heading text-body leading-5 font-extrabold text-ink">{t('crsValue')}</span>
        </span>
      </Chip>
      <Chip index={1} playing={playing} place="top-45.5 -left-5.5 hidden lg:block" className="-rotate-2 gap-2 rounded-full py-2 pr-3.5 pl-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-leaf">
          <svg aria-hidden={true} viewBox="0 0 24 24" className="size-3.5">
            <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" className="stroke-white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-body-sm leading-5 font-semibold text-ink">{t('admissible')}</span>
      </Chip>
      {/* Mobile: one chip, the score. */}
      <Chip index={0} playing={playing} place="bottom-0 -left-1.5 lg:hidden" className="-rotate-3 gap-2 rounded-lg px-3 py-2">
        <TrendIcon className="size-4" />
        <span className="font-heading text-body-sm leading-4.5 font-extrabold text-ink">
          {t('crsLabelShort')} {t('crsValue')}
        </span>
      </Chip>
    </div>
  );
}

/** Each caption typed word by word, held, then the next; the last one stays. */
function useTypedCaptions(captions: string[], reduce: boolean): string {
  const [line, setLine] = useState(0);
  const [words, setWords] = useState(0);
  const current = captions[line] ?? '';
  const total = current.split(' ').length;

  useEffect(() => {
    if (reduce) return;
    if (words < total) {
      const id = window.setTimeout(() => setWords((w) => w + 1), WORD_MS);
      return () => window.clearTimeout(id);
    }
    if (line < captions.length - 1) {
      const id = window.setTimeout(() => {
        setLine((l) => l + 1);
        setWords(0);
      }, HOLD_MS);
      return () => window.clearTimeout(id);
    }
  }, [reduce, words, total, line, captions.length]);

  if (reduce) return captions.at(-1) ?? '';
  return current.split(' ').slice(0, words).join(' ');
}

function RecLabel({ playing, label, compact = false }: { playing: boolean; label: string; compact?: boolean }): ReactNode {
  return (
    <span className={cn('flex items-center gap-2', compact && 'gap-1.5 rounded-full bg-navy-deep/85 px-2.5 py-1')}>
      <span
        aria-hidden={true}
        className={cn(
          'shrink-0 animate-rec rounded-full bg-rouge motion-reduce:animate-none',
          compact ? 'size-2' : 'size-2 ring-4 ring-rouge/25',
          !playing && 'paused',
        )}
      />
      <span className={cn(LABEL_CLASS, 'text-white')}>{label}</span>
    </span>
  );
}

/**
 * A floating note on the call: it pops in (scale 0.95 and fade, 120 ms after the one before), then drifts.
 * `place` positions it; `className` styles the note. Entrance, drift and tilt sit on three layers so
 * their transforms never fight.
 */
function Chip({
  index,
  playing,
  place,
  className,
  children,
}: {
  index: number;
  playing: boolean;
  place: string;
  className?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <motion.div
      aria-hidden={true}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.4 + index * 0.12 }}
      className={cn('absolute', place)}
    >
      <div className={cn('animate-drift motion-reduce:animate-none', !playing && 'paused')}>
        <div className={cn('flex origin-top-left items-center bg-white shadow-xl shadow-ink-deep/35', className)}>{children}</div>
      </div>
    </motion.div>
  );
}

function TrendIcon({ className }: { className?: string }): ReactNode {
  return (
    <svg aria-hidden={true} viewBox="0 0 24 24" className={cn('shrink-0', className)}>
      <path d="M4 16l5-5 4 4 7-8" fill="none" className="stroke-rouge" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 7h5v5" fill="none" className="stroke-rouge" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VisitorIcon({ className }: { className?: string }): ReactNode {
  return (
    <svg aria-hidden={true} viewBox="0 0 96 96" className={className}>
      <circle cx="48" cy="40" r="15" fill="none" className="stroke-ice-blue" strokeWidth="5" />
      <path d="M22 80c4-14 14-21 26-21s22 7 26 21" fill="none" className="stroke-ice-blue" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
