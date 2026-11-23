/** Press feedback on every tappable thing (docs/design/consultation.md, Motion): scale(0.97), 150 ms, none with reduced motion. */
export const PRESS = 'transition-transform duration-150 ease-standard active:scale-97 motion-reduce:active:scale-100';

/** The small uppercase label above a block (« AVANT », « 01 · VOTRE ADMISSIBILITÉ »). */
export const LABEL_CLASS = 'font-label text-label leading-3.5 font-bold tracking-wide uppercase';

/** A section's title, h3 on mobile, h2 on desktop. */
export const SECTION_TITLE_CLASS = 'font-heading text-h3 leading-8 font-extrabold tracking-tight text-ink lg:text-h2 lg:leading-11';

/** `--ease-out-expo` (globals.css) for `motion`: a fast start that settles gently. */
export const EASE_OUT_EXPO = [0.19, 1, 0.22, 1] as const;
