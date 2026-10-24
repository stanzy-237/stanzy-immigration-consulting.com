import { TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, type ReactNode } from 'react';

import type { CrsProfile, RulesVersion } from '@/features/crs/lib/compute-crs';
import { scoreHints } from '@/features/crs/lib/score-hints';

/** "How to raise my score": the changes worth most, with the points each adds. */
export function ScoreHints({ profile, rules }: { profile: CrsProfile; rules: RulesVersion }): ReactNode {
  const t = useTranslations('Crs.hints');
  const hints = useMemo(() => scoreHints(profile, rules), [profile, rules]);
  if (hints.length === 0) return null;

  return (
    <section aria-labelledby="crs-hints-title" className="rounded-2xl border border-fog bg-white p-5">
      <h2 id="crs-hints-title" className="flex items-center gap-2 font-heading text-h4 font-bold text-navy-deep">
        <TrendingUp aria-hidden={true} className="size-4 text-rouge" />
        {t('title')}
      </h2>
      <ul className="mt-3 space-y-2">
        {hints.map((hint) => (
          <li key={hint.kind} className="flex items-baseline justify-between gap-3 text-body-sm text-slate">
            <span>{t(hint.kind)}</span>
            <strong className="shrink-0 font-heading text-rouge">{t('gain', { points: hint.gain })}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
