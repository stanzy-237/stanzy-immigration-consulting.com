import type { ReactNode } from 'react';

/**
 * The Accompagnement page's drawn illustrations, in the brand's colours:
 * a maple leaf, and a path of milestones up to the permanent residence.
 * Decorative: hidden from assistive technology.
 */
export function MapleLeaf({ className }: { className?: string }): ReactNode {
  return (
    <svg viewBox="0 0 64 64" aria-hidden={true} className={className} fill="currentColor">
      <path d="M32 2l5.2 10.4 6.3-3.2-2.3 13.1 8.6-9.1 1.9 5.8 9.3-1.8-3.2 9.8 4.2 2.1-13.5 11 1.9 5.3-13.4-2.2.6 14.8h-4.8l.6-14.8-13.4 2.2 1.9-5.3-13.5-11 4.2-2.1-3.2-9.8 9.3 1.8 1.9-5.8 8.6 9.1-2.3-13.1 6.3 3.2z" />
    </svg>
  );
}

/** A winding road with milestones, from the first step to a flag at the top. */
export function JourneyArt({ className }: { className?: string }): ReactNode {
  return (
    <svg viewBox="0 0 320 240" aria-hidden={true} className={className} fill="none">
      <path
        d="M20 220 C 90 220, 70 160, 140 160 S 200 100, 250 100 S 300 50, 300 30"
        className="stroke-white/25"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M20 220 C 90 220, 70 160, 140 160 S 200 100, 250 100 S 300 50, 300 30"
        className="stroke-white/70"
        strokeWidth="2"
        strokeDasharray="6 8"
        strokeLinecap="round"
      />
      {[
        [20, 220],
        [140, 160],
        [250, 100],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="11" className="fill-white" />
          <circle cx={x} cy={y} r="5" className="fill-rouge" />
        </g>
      ))}
      <path d="M300 30 V 4" className="stroke-white" strokeWidth="3" strokeLinecap="round" />
      <path d="M300 4 h 18 l -5 6 l 5 6 h -18 z" className="fill-rouge" />
    </svg>
  );
}

/** A stack of documents with a check: a Dossier ready for IRCC. */
export function DossierArt({ className }: { className?: string }): ReactNode {
  return (
    <svg viewBox="0 0 160 140" aria-hidden={true} className={className} fill="none">
      <rect x="34" y="18" width="84" height="104" rx="10" className="fill-ice-blue" transform="rotate(-8 76 70)" />
      <rect x="40" y="14" width="84" height="104" rx="10" className="fill-white stroke-fog-light" strokeWidth="2" />
      {[38, 52, 66, 80].map((y, index) => (
        <rect key={y} x="54" y={y} width={index === 3 ? 34 : 56} height="6" rx="3" className="fill-fog-light" />
      ))}
      <circle cx="118" cy="104" r="22" className="fill-rouge" />
      <path d="M108 104 l7 7 l13 -14" className="stroke-white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <MapleLeafAt x={54} y={20} />
    </svg>
  );
}

function MapleLeafAt({ x, y }: { x: number; y: number }): ReactNode {
  return (
    <g transform={`translate(${x} ${y}) scale(0.22)`} className="fill-rouge">
      <path d="M32 2l5.2 10.4 6.3-3.2-2.3 13.1 8.6-9.1 1.9 5.8 9.3-1.8-3.2 9.8 4.2 2.1-13.5 11 1.9 5.3-13.4-2.2.6 14.8h-4.8l.6-14.8-13.4 2.2 1.9-5.3-13.5-11 4.2-2.1-3.2-9.8 9.3 1.8 1.9-5.8 8.6 9.1-2.3-13.1 6.3 3.2z" />
    </g>
  );
}
