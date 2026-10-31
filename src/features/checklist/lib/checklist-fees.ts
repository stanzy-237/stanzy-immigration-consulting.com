import { BIOMETRICS_FAMILY_CAP, OFFICIAL_FEES } from '@/features/budget/data/fees';
import { spouseComes, type ChecklistForm } from '@/features/checklist/lib/checklist-form';

export type FeeRow = {
  id: 'processing' | 'rprf' | 'biometrics' | 'biometricsFamily' | 'spouseProcessing' | 'spouseRprf' | 'childProcessing';
  quantity: number;
  unit: number;
};

/**
 * IRCC's fees for these answers, as its personal checklist lists them (CAD):
 * the principal applicant's, the spouse's, then the children's. Biometrics
 * are paid once, at the family rate when more than one person applies.
 */
export function checklistFees(form: ChecklistForm): { rows: FeeRow[]; total: number } {
  const withSpouse = spouseComes(form);
  const family = 1 + (withSpouse ? 1 : 0) + form.children > 1;
  const rows: FeeRow[] = [
    { id: 'processing', quantity: 1, unit: OFFICIAL_FEES.processing.amount },
    { id: 'rprf', quantity: 1, unit: OFFICIAL_FEES.rprf.amount },
    family
      ? { id: 'biometricsFamily', quantity: 1, unit: BIOMETRICS_FAMILY_CAP }
      : { id: 'biometrics', quantity: 1, unit: OFFICIAL_FEES.biometrics.amount },
    ...(withSpouse
      ? [
          { id: 'spouseProcessing', quantity: 1, unit: OFFICIAL_FEES.processing.amount } as const,
          { id: 'spouseRprf', quantity: 1, unit: OFFICIAL_FEES.rprf.amount } as const,
        ]
      : []),
    ...(form.children > 0 ? [{ id: 'childProcessing', quantity: form.children, unit: OFFICIAL_FEES.childProcessing.amount } as const] : []),
  ];
  return { rows, total: rows.reduce((sum, row) => sum + row.quantity * row.unit, 0) };
}
