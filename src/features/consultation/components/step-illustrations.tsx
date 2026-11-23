'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useId, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * The Consultation's own spot illustrations (Paper, `Design system · Illustrations & Stanzy`):
 * navy 3.5 px strokes, a rouge accent, a tinted round ground. 160 × 160, sized by `className`.
 *
 * Their « · anim » layers move as docs/design/consultation-motion.md says: the phone's bubble,
 * the micro and the transcription lines breathe while `playing` (the illustration in view);
 * the plan's route draws once, then its flag tips and settles. Reduced motion: still.
 */
type Props = { className?: string; playing?: boolean };

export const LEAF =
  'M11.27 16.02L0 12.67L1.48 11.9L0.37 8.16L4.06 8.84L4.62 6.97L8.03 10.03L6.83 3.4L9.6 4.68L12 0L14.4 4.68L17.17 3.4L15.97 10.03L19.38 6.97L19.94 8.84L23.63 8.16L22.52 11.9L24 12.67L12.73 16.02L12.73 19.67L11.27 19.67Z';

/** A layer that breathes (2.5 s ease-in-out) while its illustration is in view. */
export const breathe = (playing: boolean) => cn('fill-box animate-breathe motion-reduce:animate-none', !playing && 'paused');

/** Avant: a phone with the maple leaf, paying, and a chat bubble. */
export function PhoneIllustration({ className, playing = false }: Props): ReactNode {
  return (
    <svg aria-hidden={true} viewBox="0 0 160 160" className={className}>
      <circle cx="80" cy="82" r="70" className="fill-ice-blue" />
      <path d="M14 118C46 146 118 146 148 100" fill="none" className="stroke-rouge" strokeWidth="5" strokeLinecap="round" />
      <g transform="rotate(-8 80 80)">
        <rect x="50" y="24" width="60" height="108" rx="13" className="fill-white stroke-navy-deep" strokeWidth="3.5" />
        <path d="M72 33h16" className="stroke-navy-deep" strokeWidth="3.5" strokeLinecap="round" />
        <path d={LEAF} transform="translate(62 52) scale(1.5)" className="fill-rouge" />
        {[63, 75, 87].map((cx) => (
          <circle key={cx} cx={cx} cy="104" r="4" className="fill-navy-deep" />
        ))}
        <circle cx="99" cy="104" r="4" fill="none" className="stroke-navy-deep" strokeWidth="2.5" />
      </g>
      <g className={breathe(playing)}>
        <rect x="100" y="18" width="46" height="32" rx="12" className="fill-mtn stroke-navy-deep" strokeWidth="3.5" />
        <path d="M110 50l-4 9 12-9" className="fill-mtn stroke-navy-deep" strokeWidth="3.5" strokeLinejoin="round" />
        {[113, 123, 133].map((cx) => (
          <circle key={cx} cx={cx} cy="34" r="3" className="fill-navy-deep" />
        ))}
      </g>
    </svg>
  );
}

/** Pendant: Stanzy on a laptop's screen, the micro live. */
export function CallIllustration({ className, playing = false }: Props): ReactNode {
  return (
    <svg aria-hidden={true} viewBox="0 0 160 160" className={className}>
      <circle cx="80" cy="82" r="70" className="fill-leaf-tint" />
      <rect x="26" y="40" width="108" height="72" rx="10" className="fill-navy-deep stroke-navy-deep" strokeWidth="3.5" />
      <rect x="32" y="46" width="96" height="60" rx="6" className="fill-ice-blue" />
      <circle cx="80" cy="68" r="11" className="fill-stanzy-skin stroke-navy-deep" strokeWidth="3" />
      <path d="M60 106c2-14 10-20 20-20s18 6 20 20" className="fill-rouge stroke-navy-deep" strokeWidth="3" />
      <path d="M18 116h124" className="stroke-navy-deep" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M66 116l4 8h20l4-8" className="fill-white stroke-navy-deep" strokeWidth="3.5" strokeLinejoin="round" />
      <circle cx="80" cy="43.5" r="2" className="fill-leaf" />
      <g className={breathe(playing)}>
        <circle cx="128" cy="40" r="17" className="fill-leaf stroke-navy-deep" strokeWidth="3.5" />
        <path d="M122 37v6M126 33v14M130 35v10M134 38v4" className="stroke-white" strokeWidth="2.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Après, and « L'enregistrement »: the recording, its transcription beside it. */
export function ReplayIllustration({ className, playing = false }: Props): ReactNode {
  return (
    <svg aria-hidden={true} viewBox="0 0 160 160" className={className}>
      <circle cx="80" cy="82" r="70" className="fill-iris-tint" />
      <path d="M12 116C44 144 116 146 150 100" fill="none" className="stroke-rouge" strokeWidth="5" strokeLinecap="round" />
      <rect x="22" y="34" width="92" height="64" rx="10" className="fill-navy-deep stroke-navy-deep" strokeWidth="3.5" />
      <circle cx="68" cy="66" r="16" className="fill-rouge" />
      <path d="M63 58v16l13-8z" className="fill-white" />
      <rect x="30" y="88" width="76" height="4" rx="2" className="fill-navy-80" />
      <rect x="30" y="88" width="30" height="4" rx="2" className="fill-rouge" />
      <rect x="72" y="70" width="66" height="58" rx="10" className="fill-white stroke-navy-deep" strokeWidth="3.5" />
      <path d="M82 84h40M82 94h46M82 104h32M82 114h40" className={cn('stroke-iris', breathe(playing))} strokeWidth="3.2" strokeLinecap="round" />
      <path d={LEAF} transform="translate(118 108) scale(0.6)" className="fill-rouge" />
    </svg>
  );
}

const ROUTE = 'M46 100 C 56 84, 64 78, 72 82 S 88 100, 96 92 S 106 70, 112 64';

/** « Un plan d'action »: a route of steps up to a flag. Once in view, the route draws (600 ms), then the flag tips 6°. */
export function PlanIllustration({ className, playing = false }: Props): ReactNode {
  const mask = useId();
  const reduce = useReducedMotion();
  return (
    <svg aria-hidden={true} viewBox="0 0 160 160" className={className}>
      <defs>
        <mask id={mask}>
          <motion.path
            d={ROUTE}
            fill="none"
            stroke="white"
            strokeWidth="8"
            strokeLinecap="round"
            initial={{ pathLength: reduce ? 1 : 0 }}
            animate={playing ? { pathLength: 1 } : undefined}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </mask>
      </defs>
      <circle cx="80" cy="82" r="70" className="fill-ice-blue" />
      <path d="M18 112C40 146 120 146 142 112" fill="none" className="stroke-rouge" strokeWidth="4" strokeLinecap="round" />
      <rect x="28" y="40" width="104" height="78" rx="10" className="fill-white stroke-navy-deep" strokeWidth="3.5" />
      <path d={ROUTE} mask={`url(#${mask})`} fill="none" className="stroke-rouge" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="1 8" />
      <circle cx="46" cy="100" r="6.5" className="fill-navy-deep" />
      <circle cx="72" cy="82" r="6.5" className="fill-white stroke-navy-deep" strokeWidth="3.5" />
      <circle cx="96" cy="92" r="6.5" className="fill-white stroke-navy-deep" strokeWidth="3.5" />
      {/* The flag pivots on its pole's foot. */}
      <motion.g
        style={{ originX: '112px', originY: '66px' }}
        initial={{ rotate: 0 }}
        animate={playing ? { rotate: [0, 6, 0] } : undefined}
        transition={{ delay: 0.6, duration: 0.5, ease: 'easeOut' }}
      >
        <path d="M112 66V34" fill="none" className="stroke-navy-deep" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M112 34h24l-6 8 6 8h-24z" className="fill-rouge stroke-navy-deep" strokeWidth="3" strokeLinejoin="round" />
      </motion.g>
      <circle cx="34" cy="40" r="13" className="fill-leaf stroke-white" strokeWidth="3" />
      <path d="M28 40.5l4 4 8-8.5" fill="none" className="stroke-white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** « Vos documents, triés »: a folder with the maple leaf. */
export function FolderIllustration({ className }: Props): ReactNode {
  return (
    <svg aria-hidden={true} viewBox="0 0 160 160" className={className}>
      <circle cx="80" cy="82" r="70" className="fill-ice-blue" />
      <path d="M12 116C44 144 116 146 150 100" fill="none" className="stroke-rouge" strokeWidth="5" strokeLinecap="round" />
      <path d="M26 50h36l8 10h64v60a8 8 0 0 1-8 8H34a8 8 0 0 1-8-8z" className="fill-navy-deep stroke-navy-deep" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M26 66h108v54a8 8 0 0 1-8 8H34a8 8 0 0 1-8-8z" className="fill-white stroke-navy-deep" strokeWidth="3.5" strokeLinejoin="round" />
      <path d={LEAF} transform="translate(66 82) scale(1.15)" className="fill-rouge" />
    </svg>
  );
}
