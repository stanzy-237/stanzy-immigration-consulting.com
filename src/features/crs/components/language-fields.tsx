import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { LANGUAGE_TESTS } from '@/features/crs/data/language-tests';
import { ABILITIES, clbLevelFor } from '@/features/crs/lib/compute-crs';
import { parseScore, type LanguageForm } from '@/features/crs/lib/crs-form';

import { NumberField, SelectField } from './crs-fields';

export type LanguageSlot = 'firstLanguage' | 'secondLanguage' | 'spouse';

/** One official-language test: which test, the four results, and the level each converts to. */
export function LanguageFields({
  slot,
  value,
  onChange,
  error,
}: {
  slot: LanguageSlot;
  value: LanguageForm;
  onChange: (value: LanguageForm) => void;
  error?: string;
}): ReactNode {
  const t = useTranslations('Crs.language');
  const short = t(`shortSlots.${slot}`);

  return (
    <div className="space-y-4">
      <SelectField
        label={t('test', { slot: t(`slots.${slot}`) })}
        value={value.test}
        options={(['none', ...LANGUAGE_TESTS] as const).map((test) => ({ value: test, label: t(`tests.${test}`) }))}
        onChange={(test) => onChange({ ...value, test })}
        hint={value.test === 'TEF' ? t('tefNote') : error}
      />
      {value.test === 'none' ? null : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ABILITIES.map((ability) => {
            const raw = value.scores[ability];
            const level = raw.trim() === '' ? undefined : clbLevelFor(value.test as Exclude<typeof value.test, 'none'>, ability, parseScore(raw));
            return (
              <div key={ability}>
                <NumberField
                  label={t('field', { slot: short, ability: t(`abilities.${ability}`) })}
                  value={raw}
                  onChange={(next) => onChange({ ...value, scores: { ...value.scores, [ability]: next } })}
                  error={level === null ? t('invalid') : undefined}
                />
                {typeof level === 'number' ? (
                  <p data-testid={`level-${slot}-${ability}`} className="mt-1 font-label text-xs font-semibold text-steel-blue">
                    {level === 0 ? t('belowFour') : t('level', { level })}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
