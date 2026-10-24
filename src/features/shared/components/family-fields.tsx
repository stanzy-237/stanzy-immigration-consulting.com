import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { CheckField, SelectField } from '@/features/shared/components/calculator-fields';
import { isPartnered, MARITAL_STATUSES, type MaritalStatus } from '@/features/shared/lib/marital-status';

export type FamilyAnswers = {
  maritalStatus: MaritalStatus;
  spouseAccompanying: boolean;
  spouseIsCanadianCitizenOrPR: boolean;
};

/**
 * Marital status, and for a married or common-law candidate whether the
 * spouse comes along and is already a Canadian citizen or PR — the answers
 * both calculators use to decide whether spouse factors count.
 */
export function FamilyFields({
  value,
  onChange,
  note,
}: {
  value: FamilyAnswers;
  onChange: (next: FamilyAnswers) => void;
  note?: string;
}): ReactNode {
  const t = useTranslations('Calculators.family');
  return (
    <>
      <SelectField
        label={t('marital')}
        value={value.maritalStatus}
        options={MARITAL_STATUSES.map((m) => ({ value: m, label: t(`maritalOptions.${m}`) }))}
        onChange={(maritalStatus) => onChange({ ...value, maritalStatus })}
      />
      {isPartnered(value.maritalStatus) ? (
        <>
          <SelectField
            label={t('accompanying')}
            value={value.spouseAccompanying ? 'yes' : 'no'}
            options={[
              { value: 'no', label: t('accompanyingNo') },
              { value: 'yes', label: t('accompanyingYes') },
            ]}
            onChange={(v) => onChange({ ...value, spouseAccompanying: v === 'yes' })}
          />
          <CheckField
            label={t('citizenOrPR')}
            checked={value.spouseIsCanadianCitizenOrPR}
            onChange={(spouseIsCanadianCitizenOrPR) => onChange({ ...value, spouseIsCanadianCitizenOrPR })}
          />
          {note ? <p className="text-body-sm text-slate">{note}</p> : null}
        </>
      ) : null}
    </>
  );
}
