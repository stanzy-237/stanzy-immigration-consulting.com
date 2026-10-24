import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { RULES_VERSIONS, type RulesVersion } from '@/features/shared/lib/rules-version';

/**
 * Before the 2026-11-03 rules take effect, lets the visitor score under the
 * current rules or preview the upcoming ones. Renders nothing once the
 * latest rules are in force. `hint` says what changes for this calculator.
 */
export function RulesChoice({
  name,
  inForce,
  rules,
  onChange,
  hint,
}: {
  name: string;
  inForce: RulesVersion;
  rules: RulesVersion;
  onChange: (rules: RulesVersion) => void;
  hint: string;
}): ReactNode {
  const t = useTranslations('Calculators.rulesChoice');
  const choices = RULES_VERSIONS.filter((version) => version >= inForce);
  if (choices.length < 2) return null;

  return (
    <fieldset className="rounded-2xl border border-fog bg-white p-4">
      <legend className="px-1 font-label text-slate">{t('legend')}</legend>
      <div className="flex flex-wrap gap-4">
        {choices.map((version) => (
          <label key={version} className="flex items-center gap-2 text-body-sm font-semibold text-navy-deep">
            <input
              type="radio"
              name={name}
              value={version}
              checked={rules === version}
              onChange={() => onChange(version)}
              className="accent-rouge"
            />
            {version === inForce ? t('current') : t('upcoming')}
          </label>
        ))}
      </div>
      <p className="mt-2 text-body-sm text-slate">{hint}</p>
    </fieldset>
  );
}
