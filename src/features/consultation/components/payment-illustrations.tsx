'use client';

import type { ReactNode } from 'react';

import { breathe, LEAF } from '@/features/consultation/components/step-illustrations';

/**
 * The payment screens' illustrations (Paper, `Paiement v2`): same family as
 * step-illustrations (navy 3.5 px strokes, rouge accent, tinted ground). The
 * phone of `1 Validez sur le téléphone` is `PhoneIllustration`. Only the
 * verification's ring breathes (docs/design/consultation-motion.md, Payment);
 * Refusé and En attente stay still.
 */
type Props = { className?: string; playing?: boolean };

/** 2 Page SasPay: a secure browser page with the leaf, an arrow out to it. */
export function SecurePageIllustration({ className }: Props): ReactNode {
  return (
    <svg aria-hidden={true} viewBox="0 0 160 160" className={className}>
      <circle cx="80" cy="82" r="70" className="fill-ice-blue" />
      <path d="M12 112C44 142 116 144 150 98" fill="none" className="stroke-rouge" strokeWidth="5" strokeLinecap="round" />
      <rect x="22" y="38" width="112" height="86" rx="12" className="fill-white stroke-navy-deep" strokeWidth="3.5" />
      <path d="M22 58h112" className="stroke-navy-deep" strokeWidth="3.5" />
      <circle cx="34" cy="48" r="3" className="fill-rouge" />
      <circle cx="44" cy="48" r="3" className="fill-navy-deep" />
      <circle cx="54" cy="48" r="3" className="fill-navy-deep" />
      <rect x="64" y="43" width="58" height="10" rx="5" className="fill-ice-blue" />
      <path d="M70 50.5v-2.5a2.5 2.5 0 0 1 5 0v2.5" fill="none" className="stroke-leaf" strokeWidth="1.8" />
      <rect x="68.5" y="49.5" width="8" height="5" rx="1" className="fill-leaf" />
      <path d={LEAF} transform="translate(62 70) scale(1.4)" className="fill-rouge" />
      <rect x="48" y="104" width="60" height="10" rx="5" className="fill-navy-deep" />
      <circle cx="128" cy="36" r="18" className="fill-orange-money stroke-navy-deep" strokeWidth="3.5" />
      <path d="M121 43l13-13M124 30h10v10" fill="none" className="stroke-white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 3 Vérification: a shield with the leaf and a green check, a dashed ring around it. */
export function VerifyingIllustration({ className, playing = true }: Props): ReactNode {
  return (
    <svg aria-hidden={true} viewBox="0 0 160 160" className={className}>
      <circle cx="80" cy="82" r="70" className="fill-ice-blue" />
      <ellipse
        cx="80"
        cy="84"
        rx="66"
        ry="22"
        transform="rotate(-14 80 84)"
        fill="none"
        className={`stroke-rouge ${breathe(playing)}`}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="10 9"
      />
      <path d="M80 22l42 16v30c0 28-18 48-42 60-24-12-42-32-42-60V38z" className="fill-white stroke-navy-deep" strokeWidth="3.5" strokeLinejoin="round" />
      <path d={LEAF} transform="translate(57 50) scale(1.9)" className="fill-rouge" />
      <circle cx="116" cy="112" r="17" className="fill-leaf stroke-navy-deep" strokeWidth="3.5" />
      <path d="M108 112.5l5.5 5.5 10-11" fill="none" className="stroke-white" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 4 Refusé: the phone greyed, a rouge cross, and a coin at « 0 ». */
export function RefusedIllustration({ className }: Props): ReactNode {
  return (
    <svg aria-hidden={true} viewBox="0 0 160 160" className={className}>
      <circle cx="80" cy="82" r="70" className="fill-blush" />
      <g transform="rotate(-8 80 80)">
        <rect x="50" y="24" width="60" height="108" rx="13" className="fill-white stroke-navy-deep" strokeWidth="3.5" />
        <path d="M72 33h16" className="stroke-navy-deep" strokeWidth="3.5" strokeLinecap="round" />
        <path d={LEAF} transform="translate(62 52) scale(1.5)" className="fill-rouge opacity-30" />
        <rect x="60" y="98" width="40" height="12" rx="6" className="fill-fog-light" />
      </g>
      <circle cx="118" cy="40" r="18" className="fill-rouge stroke-navy-deep" strokeWidth="3.5" />
      <path d="M111.5 33.5l13 13M124.5 33.5l-13 13" className="stroke-white" strokeWidth="3.8" strokeLinecap="round" />
      <circle cx="40" cy="118" r="20" className="fill-white stroke-navy-deep" strokeWidth="3.5" />
      <circle cx="40" cy="118" r="14" fill="none" className="stroke-leaf" strokeWidth="2" strokeDasharray="3 3" />
      <ellipse cx="40" cy="118" rx="5" ry="7.5" fill="none" className="stroke-leaf" strokeWidth="3.2" />
    </svg>
  );
}

/** 5 Toujours en attente: a plane on its dashed way, a clock. */
export function OnTheWayIllustration({ className }: Props): ReactNode {
  return (
    <svg aria-hidden={true} viewBox="0 0 160 160" className={className}>
      <circle cx="80" cy="82" r="70" className="fill-honey-tint" />
      <path d="M20 132C44 130 62 120 76 104" fill="none" className="stroke-rouge" strokeWidth="4" strokeLinecap="round" strokeDasharray="9 8" />
      <path
        transform="translate(70 44) scale(0.95) translate(-232 -141)"
        d="M273.011 203.742L270.29 201.083L271.318 188.259L257.167 174.431L241.031 203.343L236.679 199.622L246.822 163.791L234.301 151.024C234.301 151.024 232.53 143.008 232.636 141.951C232.742 140.894 241.31 142.448 241.31 142.448L255.462 156.277L291.198 147.58L295.008 151.303L265.264 166.918L278.334 181.285L291.34 180.697L294.604 183.354L280.002 190.893L273.011 203.742Z"
        className="fill-navy-deep"
      />
      <circle cx="40" cy="52" r="20" className="fill-white stroke-navy-deep" strokeWidth="3.5" />
      <path d="M40 42v10l7 4" fill="none" className="stroke-honey" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
