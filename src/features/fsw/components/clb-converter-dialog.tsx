'use client';

import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toLevelChoice, type LevelChoice } from '@/features/fsw/lib/fsw-form';
import { LanguageFields } from '@/features/shared/components/language-fields';
import { TEST_SPECS } from '@/features/shared/data/language-tests';
import { emptyLanguage, toLanguageResult, type LanguageForm } from '@/features/shared/lib/language-form';
import { ABILITIES, clbLevelFor, type Ability } from '@/features/shared/lib/language-levels';

export type ConvertedLevels = { official: 'fr' | 'en'; levels: Record<Ability, LevelChoice> };

/** The test's four results as levels, or null until all four are typed and possible. */
function convert(form: LanguageForm): ConvertedLevels | null {
  const result = toLanguageResult(form);
  if (!result) return null;
  const levels = {} as Record<Ability, LevelChoice>;
  for (const ability of ABILITIES) {
    const level = clbLevelFor(result.test, ability, result.scores[ability]);
    if (level === null) return null;
    levels[ability] = toLevelChoice(level);
  }
  return { official: TEST_SPECS[result.test].language, levels };
}

/**
 * "Je ne connais pas mon NCLC/CLB": the visitor types their test results and
 * the dialog fills the four level choices with IRCC's conversion.
 */
export function ClbConverterDialog({
  onApply,
  onClose,
}: {
  onApply: (converted: ConvertedLevels) => void;
  onClose: () => void;
}): ReactNode {
  const t = useTranslations('Fsw.converter');
  const [form, setForm] = useState<LanguageForm>(emptyLanguage);
  const converted = convert(form);

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent showCloseButton={false} className="max-h-dvh gap-5 overflow-y-auto p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-h4 font-bold text-navy-deep">{t('title')}</DialogTitle>
          <DialogDescription className="text-body-sm text-slate">{t('description')}</DialogDescription>
        </DialogHeader>
        <LanguageFields slot="firstLanguage" value={form} onChange={setForm} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-fog px-5 py-2.5 text-body-sm font-semibold text-navy-deep transition-colors hover:bg-ice-blue"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={!converted}
            onClick={() => converted && onApply(converted)}
            className="rounded-full bg-rouge px-5 py-2.5 text-body-sm font-semibold text-white transition-colors hover:bg-crimson disabled:opacity-50"
          >
            {t('apply')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
