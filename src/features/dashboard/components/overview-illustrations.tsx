import type { ReactNode } from 'react';

/**
 * The Aperçu's four spot illustrations (Paper, `Design system · Illustrations
 * & Stanzy`: « À traiter », « Compte à rebours », « Dossier », « Encaissé »):
 * navy 3.5 px strokes, a rouge accent, a tinted round ground. 160 × 160,
 * sized by `className`.
 */
type Props = { className?: string };

const LEAF =
  'M11.27 16.02L0 12.67L1.48 11.9L0.37 8.16L4.06 8.84L4.62 6.97L8.03 10.03L6.83 3.4L9.6 4.68L12 0L14.4 4.68L17.17 3.4L15.97 10.03L19.38 6.97L19.94 8.84L23.63 8.16L22.52 11.9L24 12.67L12.73 16.02L12.73 19.67L11.27 19.67Z';
const SWOOSH = 'M12 116C44 144 116 146 150 100';

/** « À traiter »: a tray of papers with a rouge « ! » badge, drawn for the navy card. */
export function ToHandleIllustration({ className }: Props): ReactNode {
  return (
    <svg aria-hidden={true} viewBox="0 0 160 160" className={className}>
      <circle cx="80" cy="82" r="70" className="fill-navy-80" />
      <path d={SWOOSH} fill="none" className="stroke-rouge" strokeWidth="5" strokeLinecap="round" />
      <rect x="46" y="30" width="58" height="66" rx="6" transform="rotate(-9 75 63)" className="fill-ice-blue stroke-navy-deep" strokeWidth="3.5" />
      <rect x="56" y="36" width="58" height="66" rx="6" className="fill-white stroke-navy-deep" strokeWidth="3.5" />
      <path d="M68 54h34M68 66h26M68 78h30" className="stroke-navy-deep" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M26 92h32l8 14h28l8-14h32v26a8 8 0 0 1-8 8H34a8 8 0 0 1-8-8z" className="fill-white stroke-navy-deep" strokeWidth="3.5" strokeLinejoin="round" />
      <circle cx="122" cy="40" r="15" className="fill-rouge stroke-white" strokeWidth="3" />
      <path d="M122 32v9" className="stroke-white" strokeWidth="4" strokeLinecap="round" />
      <circle cx="122" cy="48" r="2.4" className="fill-white" />
    </svg>
  );
}

/** « Compte à rebours »: the calendar with the leaf and a clock. */
export function CountdownIllustration({ className }: Props): ReactNode {
  return (
    <svg aria-hidden={true} viewBox="0 0 160 160" className={className}>
      <circle cx="80" cy="82" r="70" className="fill-ice-blue" />
      <path d={SWOOSH} fill="none" className="stroke-rouge" strokeWidth="5" strokeLinecap="round" />
      <g transform="rotate(-6 80 80)">
        <rect x="36" y="34" width="84" height="88" rx="12" className="fill-white stroke-navy-deep" strokeWidth="3.5" />
        <path d="M36 58h84" className="stroke-navy-deep" strokeWidth="3.5" />
        <rect x="38" y="36" width="80" height="20" rx="9" className="fill-rouge" />
        <path d="M56 26v16M100 26v16" className="stroke-navy-deep" strokeWidth="3.5" strokeLinecap="round" />
        <path d={LEAF} transform="translate(62 68) scale(1.5)" className="fill-rouge" />
        <rect x="52" y="104" width="52" height="8" rx="4" className="fill-ice-blue" />
      </g>
      <circle cx="124" cy="112" r="20" className="fill-white stroke-navy-deep" strokeWidth="3.5" />
      <path d="M124 101v11l7 4" fill="none" className="stroke-honey" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** « Dossier »: a folder with the maple leaf. */
export function DossierIllustration({ className }: Props): ReactNode {
  return (
    <svg aria-hidden={true} viewBox="0 0 160 160" className={className}>
      <circle cx="80" cy="82" r="70" className="fill-ice-blue" />
      <path d={SWOOSH} fill="none" className="stroke-rouge" strokeWidth="5" strokeLinecap="round" />
      <path d="M26 50h36l8 10h64v60a8 8 0 0 1-8 8H34a8 8 0 0 1-8-8z" className="fill-navy-deep stroke-navy-deep" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M26 66h108v54a8 8 0 0 1-8 8H34a8 8 0 0 1-8-8z" className="fill-white stroke-navy-deep" strokeWidth="3.5" strokeLinejoin="round" />
      <path d={LEAF} transform="translate(66 82) scale(1.15)" className="fill-rouge" />
    </svg>
  );
}

/** « Encaissé »: two banknotes with the leaf, a stack of coins, a rouge arrow going up. */
export function CollectedIllustration({ className }: Props): ReactNode {
  return (
    <svg aria-hidden={true} viewBox="0 0 160 160" className={className}>
      <circle cx="80" cy="82" r="70" className="fill-ice-blue" />
      <path d={SWOOSH} fill="none" className="stroke-rouge" strokeWidth="5" strokeLinecap="round" />
      <rect x="24" y="56" width="84" height="48" rx="7" transform="rotate(-10 66 80)" className="fill-ice-blue stroke-navy-deep" strokeWidth="3.5" />
      <rect x="32" y="66" width="84" height="48" rx="7" className="fill-white stroke-navy-deep" strokeWidth="3.5" />
      <circle cx="74" cy="90" r="13" fill="none" className="stroke-navy-deep" strokeWidth="3.5" />
      <path d={LEAF} transform="translate(66.5 81.5) scale(0.62)" className="fill-rouge" />
      <path d="M42 76v6M106 98v6" className="stroke-navy-deep" strokeWidth="3.5" strokeLinecap="round" />
      <ellipse cx="124" cy="112" rx="16" ry="6" className="fill-white stroke-navy-deep" strokeWidth="3.5" />
      <path d="M108 104v8M140 104v8" className="stroke-navy-deep" strokeWidth="3.5" />
      <ellipse cx="124" cy="104" rx="16" ry="6" className="fill-white stroke-navy-deep" strokeWidth="3.5" />
      <path d="M96 46l18-18" className="stroke-rouge" strokeWidth="5" strokeLinecap="round" />
      <path d="M102 28h12v12" fill="none" className="stroke-rouge" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
