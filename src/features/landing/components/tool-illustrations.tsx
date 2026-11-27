import type { ReactNode } from 'react';

/**
 * The tools' spot illustrations (Paper, `PWA · Visiteur · 2 Outils · Mobile`):
 * navy 3.5 px strokes, a rouge accent and swoosh, an ice-blue round ground.
 * 160 × 160, sized by `className`.
 */
type Props = { className?: string };

const NAVY = '#0D1F4E';
const ROUGE = '#CC1627';
const ICE = '#E8EDF5';
const FOG = '#CBD5E0';
const LEAF = '#15803D';
const MAPLE =
  'M11.27 16.02L0 12.67L1.48 11.9L0.37 8.16L4.06 8.84L4.62 6.97L8.03 10.03L6.83 3.4L9.6 4.68L12 0L14.4 4.68L17.17 3.4L15.97 10.03L19.38 6.97L19.94 8.84L23.63 8.16L22.52 11.9L24 12.67L12.73 16.02L12.73 19.67L11.27 19.67Z';

function Ground({ children, className }: { children: ReactNode; className?: string }): ReactNode {
  return (
    <svg aria-hidden={true} viewBox="0 0 160 160" className={className}>
      <circle cx="80" cy="82" r="70" fill={ICE} />
      <path d="M14 118C46 146 116 148 150 102" fill="none" stroke={ROUGE} strokeWidth="5" strokeLinecap="round" />
      {children}
    </svg>
  );
}

/** Calculateur CRS: a gauge with its score. */
export function CrsIllustration({ className }: Props): ReactNode {
  return (
    <Ground className={className}>
      <path d="M28 96A52 52 0 0 1 132 96" fill="none" stroke={NAVY} strokeWidth="22" strokeLinecap="round" />
      <path d="M28 96A52 52 0 0 1 132 96" fill="none" stroke="#FFFFFF" strokeWidth="15" strokeLinecap="round" />
      <path d="M28 96A52 52 0 0 1 99.2 47.7" fill="none" stroke={ROUGE} strokeWidth="15" />
      <path d="M107.6 39.1L104 46" fill="none" stroke={NAVY} strokeWidth="3" strokeLinecap="round" />
      <path d="M80 96L94 62" fill="none" stroke={NAVY} strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="80" cy="96" r="7" fill={NAVY} />
      <rect x="50" y="108" width="60" height="26" rx="13" fill="#FFFFFF" stroke={NAVY} strokeWidth="3.5" />
      <text x="80" y="126.5" textAnchor="middle" className="font-label" fontWeight="800" fontSize="16" fill={NAVY}>
        482
      </text>
    </Ground>
  );
}

/** 67 points: a checklist and the score's badge. */
export function SixtySevenIllustration({ className }: Props): ReactNode {
  const rows = [
    [46, 38, true],
    [60, 28, true],
    [74, 42, true],
    [88, 24, true],
    [102, 32, false],
    [116, 20, false],
  ] as const;
  return (
    <Ground className={className}>
      <rect x="38" y="26" width="76" height="102" rx="10" fill="#FFFFFF" stroke={NAVY} strokeWidth="3.5" />
      <rect x="60" y="19" width="32" height="13" rx="4" fill={NAVY} />
      {rows.map(([y, width, done]) => (
        <g key={y}>
          {done ? <circle cx="51" cy={y} r="5" fill={LEAF} /> : <circle cx="51" cy={y} r="5" fill="#FFFFFF" stroke={NAVY} strokeWidth="2.5" />}
          <rect x="61" y={y - 3} width={width} height="6" rx="3" fill={FOG} />
        </g>
      ))}
      <circle cx="116" cy="104" r="24" fill={ROUGE} stroke={NAVY} strokeWidth="3.5" />
      <text x="116" y="111.5" textAnchor="middle" className="font-label" fontWeight="800" fontSize="20" fill="#FFFFFF">
        67
      </text>
    </Ground>
  );
}

/** NCLC: test scores turned into a level. */
export function NclcIllustration({ className }: Props): ReactNode {
  const bars = [
    [54, 26, NAVY],
    [72, 21, NAVY],
    [90, 29, NAVY],
    [108, 18, ROUGE],
  ] as const;
  return (
    <Ground className={className}>
      <rect x="18" y="36" width="64" height="86" rx="9" fill="#FFFFFF" stroke={NAVY} strokeWidth="3.5" />
      {bars.map(([y, width, color]) => (
        <g key={y}>
          <circle cx="30" cy={y} r="4.5" fill={NAVY} />
          <rect x="40" y={y - 3} width="32" height="6" rx="3" fill={ICE} />
          <rect x="40" y={y - 3} width={width} height="6" rx="3" fill={color} />
        </g>
      ))}
      <path d="M87 79h12m-5-6 6 6-6 6" fill="none" stroke={ROUGE} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="104" y="48" width="44" height="60" rx="10" fill={NAVY} />
      <text x="126" y="66" textAnchor="middle" className="font-label" fontWeight="800" fontSize="9" fill={ICE}>
        NCLC
      </text>
      <text x="126" y="97" textAnchor="middle" className="font-label" fontWeight="800" fontSize="28" fill="#FFFFFF">
        7
      </text>
      <path d="M114 108v14l12-6 12 6v-14" fill={ROUGE} stroke={NAVY} strokeWidth="3" strokeLinejoin="round" />
    </Ground>
  );
}

/** CNP: an ID card with its code, under a magnifier. */
export function CnpIllustration({ className }: Props): ReactNode {
  return (
    <Ground className={className}>
      <rect x="18" y="36" width="100" height="74" rx="10" fill="#FFFFFF" stroke={NAVY} strokeWidth="3.5" />
      <circle cx="40" cy="57" r="7" fill={NAVY} />
      <path d="M28 78c2-8 6-11 12-11s10 3 12 11z" fill={ROUGE} stroke={NAVY} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M60 56h44M60 67h30" fill="none" stroke={NAVY} strokeWidth="3" strokeLinecap="round" />
      <path d={MAPLE} transform="translate(98 40) scale(0.5)" fill={ROUGE} />
      <rect x="28" y="86" width="64" height="16" rx="8" fill={ICE} />
      <text x="60" y="98" textAnchor="middle" className="font-label" fontWeight="800" fontSize="11" fill={NAVY}>
        21231
      </text>
      <circle cx="104" cy="94" r="21" fill="#FFFFFF" fillOpacity="0.55" stroke={NAVY} strokeWidth="4" />
      <path d="M119 109l16 16" fill="none" stroke={NAVY} strokeWidth="8" strokeLinecap="round" />
      <path d="M94 84a12 12 0 0 1 10-4" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
    </Ground>
  );
}

/** Après l'ITA: a stopwatch, the invitation and its 60 days. */
export function ItaIllustration({ className }: Props): ReactNode {
  return (
    <Ground className={className}>
      <rect x="62" y="28" width="20" height="10" rx="3" fill={NAVY} />
      <path d="M104 50l7-7" fill="none" stroke={NAVY} strokeWidth="5" strokeLinecap="round" />
      <circle cx="72" cy="84" r="44" fill="#FFFFFF" stroke={NAVY} strokeWidth="3.5" />
      <circle cx="72" cy="84" r="35" transform="rotate(-90 72 84)" fill="none" stroke={ROUGE} strokeWidth="6" strokeLinecap="round" strokeDasharray="150 220" />
      <path d="M72 55v5M101 84h-5M72 113v-5M43 84h5" fill="none" stroke={NAVY} strokeWidth="3" strokeLinecap="round" />
      <path d="M72 84V64M72 84l13 8" fill="none" stroke={NAVY} strokeWidth="4" strokeLinecap="round" />
      <circle cx="72" cy="84" r="4.5" fill={ROUGE} stroke={NAVY} strokeWidth="2" />
      <rect x="108" y="90" width="38" height="38" rx="7" fill="#FFFFFF" stroke={NAVY} strokeWidth="3.5" />
      <rect x="109.75" y="91.75" width="34.5" height="10" rx="5" fill={ROUGE} />
      <text x="127" y="122" textAnchor="middle" className="font-label" fontWeight="800" fontSize="16" fill={NAVY}>
        60
      </text>
      <rect x="110" y="24" width="34" height="24" rx="4" fill="#FFFFFF" stroke={NAVY} strokeWidth="3" />
      <path d="M111 26l16 12 16-12" fill="none" stroke={NAVY} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="127" cy="38" r="5" fill={ROUGE} />
    </Ground>
  );
}

/** Outil PDF: pages gathered into one light PDF. */
export function PdfIllustration({ className }: Props): ReactNode {
  return (
    <Ground className={className}>
      <rect x="16" y="52" width="36" height="46" rx="5" transform="rotate(-10 34 75)" fill="#FFFFFF" stroke={NAVY} strokeWidth="3" />
      <rect x="24" y="48" width="36" height="46" rx="5" transform="rotate(-2 42 71)" fill="#FFFFFF" stroke={NAVY} strokeWidth="3" />
      <rect x="32" y="46" width="36" height="46" rx="5" transform="rotate(7 50 69)" fill="#FFFFFF" stroke={NAVY} strokeWidth="3" />
      <path d="M42 60h16M42 68h12M42 76h16" transform="rotate(7 50 69)" fill="none" stroke={FOG} strokeWidth="3" strokeLinecap="round" />
      <path d="M74 78h12m-5-6 6 6-6 6" fill="none" stroke={ROUGE} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M94 32h30l16 16v64H94z" fill="#FFFFFF" stroke={NAVY} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M124 32v16h16" fill="none" stroke={NAVY} strokeWidth="3.5" strokeLinejoin="round" />
      <rect x="88" y="62" width="44" height="20" rx="5" fill={ROUGE} stroke={NAVY} strokeWidth="3" />
      <text x="110" y="76.5" textAnchor="middle" className="font-label" fontWeight="800" fontSize="11" fill="#FFFFFF">
        PDF
      </text>
      <path d="M104 92h26M104 100h18" fill="none" stroke={FOG} strokeWidth="3" strokeLinecap="round" />
      <rect x="92" y="116" width="52" height="20" rx="10" fill={LEAF} stroke={NAVY} strokeWidth="3" />
      <path d="M108 126h20m-6-5 6 5-6 5" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" transform="rotate(90 118 126)" />
    </Ground>
  );
}

/** Parcours: the road to PR, its stops ticked, the maple flag at the end. */
export function TimelineIllustration({ className }: Props): ReactNode {
  return (
    <Ground className={className}>
      <path d="M30 120C30 96 62 100 62 78S94 58 94 40" fill="none" stroke={NAVY} strokeWidth="10" strokeLinecap="round" />
      <path d="M30 120C30 96 62 100 62 78S94 58 94 40" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 8" />
      <circle cx="30" cy="120" r="9" fill={LEAF} stroke={NAVY} strokeWidth="3" />
      <circle cx="62" cy="80" r="9" fill={LEAF} stroke={NAVY} strokeWidth="3" />
      <circle cx="94" cy="44" r="9" fill="#FFFFFF" stroke={NAVY} strokeWidth="3" />
      <path d="M108 22v52" fill="none" stroke={NAVY} strokeWidth="4" strokeLinecap="round" />
      <path d="M110 24h30l-8 11 8 11h-30z" fill={ROUGE} stroke={NAVY} strokeWidth="3" strokeLinejoin="round" />
      <path d={MAPLE} transform="translate(116 28) scale(0.5)" fill="#FFFFFF" />
    </Ground>
  );
}

/** Dernier tirage: the round's ticket, its CRS, the invitation it sent. */
export function DrawIllustration({ className }: Props): ReactNode {
  return (
    <Ground className={className}>
      <rect x="24" y="44" width="92" height="64" rx="10" fill="#FFFFFF" stroke={NAVY} strokeWidth="3.5" />
      <path d="M24 64h92" fill="none" stroke={NAVY} strokeWidth="3" strokeDasharray="5 5" />
      <text x="70" y="59" textAnchor="middle" className="font-label" fontWeight="800" fontSize="11" fill={NAVY}>
        N° 453
      </text>
      <text x="70" y="95" textAnchor="middle" className="font-label" fontWeight="800" fontSize="24" fill={ROUGE}>
        477
      </text>
      <rect x="100" y="78" width="40" height="28" rx="4" fill="#FFFFFF" stroke={NAVY} strokeWidth="3" />
      <path d="M101 80l19 13 19-13" fill="none" stroke={NAVY} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="136" cy="76" r="9" fill={LEAF} stroke={NAVY} strokeWidth="2.5" />
      <path d="M132 76l3 3 5-6" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Ground>
  );
}

/** Prochain tirage: the calendar, a day circled, the trend going up. */
export function PredictionIllustration({ className }: Props): ReactNode {
  return (
    <Ground className={className}>
      <rect x="24" y="36" width="80" height="82" rx="10" fill="#FFFFFF" stroke={NAVY} strokeWidth="3.5" />
      <rect x="25.75" y="37.75" width="76.5" height="18" rx="8" fill={NAVY} />
      <path d="M44 28v16M84 28v16" fill="none" stroke={NAVY} strokeWidth="3.5" strokeLinecap="round" />
      <g fill={FOG}>
        <rect x="36" y="66" width="10" height="10" rx="2" />
        <rect x="52" y="66" width="10" height="10" rx="2" />
        <rect x="68" y="66" width="10" height="10" rx="2" />
        <rect x="36" y="84" width="10" height="10" rx="2" />
        <rect x="52" y="84" width="10" height="10" rx="2" />
        <rect x="36" y="102" width="10" height="10" rx="2" />
      </g>
      <circle cx="73" cy="89" r="10" fill="none" stroke={ROUGE} strokeWidth="3.5" />
      <path d="M100 118l14-18 10 8 18-26" fill="none" stroke={ROUGE} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M130 82h12v12" fill="none" stroke={ROUGE} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </Ground>
  );
}

/** Budget: a wallet, a banknote with the leaf, a coin. */
export function BudgetIllustration({ className }: Props): ReactNode {
  return (
    <Ground className={className}>
      <rect x="38" y="34" width="70" height="40" rx="6" transform="rotate(-12 73 54)" fill={ICE} stroke={NAVY} strokeWidth="3" />
      <path d={MAPLE} transform="translate(62 42) scale(0.9) rotate(-12 12 10)" fill={ROUGE} />
      <rect x="24" y="58" width="100" height="62" rx="12" fill={NAVY} />
      <path d="M24 74h100" fill="none" stroke={ICE} strokeOpacity="0.4" strokeWidth="2" />
      <rect x="92" y="80" width="40" height="26" rx="8" fill="#FFFFFF" stroke={NAVY} strokeWidth="3" />
      <circle cx="106" cy="93" r="5" fill={ROUGE} />
      <circle cx="132" cy="44" r="14" fill="#FFFFFF" stroke={NAVY} strokeWidth="3" />
      <text x="132" y="48.5" textAnchor="middle" className="font-label" fontWeight="800" fontSize="12" fill={NAVY}>
        $
      </text>
    </Ground>
  );
}

/** Checklist: the documents to gather, two already in, a pen. */
export function ChecklistIllustration({ className }: Props): ReactNode {
  const rows = [
    [50, true],
    [72, true],
    [94, false],
  ] as const;
  return (
    <Ground className={className}>
      <rect x="30" y="28" width="78" height="100" rx="10" fill="#FFFFFF" stroke={NAVY} strokeWidth="3.5" />
      {rows.map(([y, done]) => (
        <g key={y}>
          <rect x="42" y={y - 7} width="14" height="14" rx="3" fill={done ? LEAF : '#FFFFFF'} stroke={NAVY} strokeWidth="2.5" />
          {done ? <path d={`M45 ${y}l3 3 5-6`} fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /> : null}
          <rect x="62" y={y - 3} width="34" height="6" rx="3" fill={FOG} />
        </g>
      ))}
      <path d="M108 120l26-50 10 5-26 50-12 6z" fill={ROUGE} stroke={NAVY} strokeWidth="3" strokeLinejoin="round" />
      <path d="M131 76l10 5" fill="none" stroke={NAVY} strokeWidth="3" />
    </Ground>
  );
}
