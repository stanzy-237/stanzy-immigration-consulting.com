import type { ReactNode } from 'react';

/**
 * Phones: keeps the score in view while the visitor scrolls the questions.
 * Hidden from assistive technology; the announced score is the result card's.
 */
export function PhoneScoreBar({
  label,
  score,
  outOf,
}: {
  label: string;
  score: number | null;
  outOf?: string;
}): ReactNode {
  return (
    <div
      aria-hidden={true}
      className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t border-white/10 bg-navy-deep px-5 py-3 text-white shadow-lg lg:hidden"
    >
      <span className="font-label text-white/60">{label}</span>
      <span className="font-heading text-h3 font-bold">
        {score ?? '—'}
        {outOf ? <span className="ml-1 text-body-sm font-normal text-white/60">{outOf}</span> : null}
      </span>
    </div>
  );
}
