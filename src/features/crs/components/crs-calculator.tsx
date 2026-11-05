'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { toast } from '@/components/ui/toast';
import { useCurrentAccount } from '@/features/auth/hooks/use-current-account';
import { withNext } from '@/features/auth/lib/safe-next-path';
import { SaveSimulationDialog } from '@/features/crs/components/save-simulation-dialog';
import { SavedSimulations, SavedSimulationsSkeleton } from '@/features/crs/components/saved-simulations';
import { ScoreAdvice } from '@/features/crs/components/score-advice';
import { ScoreSummary } from '@/features/crs/components/score-summary';
import { useCrsDraft } from '@/features/crs/hooks/use-crs-draft';
import { computeCrs, type CrsProfile } from '@/features/crs/lib/compute-crs';
import { DEFAULT_FORM, fromProfile, toProfile, type CrsForm } from '@/features/crs/lib/crs-form';
import { CrsFields } from '@/features/shared/components/crs-fields';
import { PhoneScoreBar } from '@/features/shared/components/phone-score-bar';
import { RulesChoice } from '@/features/shared/components/rules-choice';
import { useCalculatorTracking } from '@/features/shared/hooks/use-calculator-tracking';
import { rulesInForceOn, type RulesVersion } from '@/features/shared/lib/rules-version';
import { useRouter } from '@/i18n/navigation';
import { track } from '@/lib/analytics';
import { useTRPC } from '@/trpc/client';

/**
 * The Calculateur CRS: the official questions, scored by the engine as the
 * visitor answers, with a result card that saves the simulation. `today`
 * decides which CRS rules apply; before 2026-11-03 the visitor can preview
 * the upcoming ones.
 */
export function CrsCalculator({ today = new Date() }: { today?: Date }): ReactNode {
  const t = useTranslations('Crs');
  const tSummary = useTranslations('Crs.summary');
  const format = useFormatter();
  const router = useRouter();
  const { account } = useCurrentAccount();
  const [form, setForm] = useCrsDraft();
  const inForce = rulesInForceOn(today);
  const [rules, setRules] = useState<RulesVersion>(inForce);
  const [naming, setNaming] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const save = useMutation(trpc.crs.save.mutationOptions());

  const result = useMemo(() => computeCrs(toProfile(form), { rules }), [form, rules]);
  const breakdown = result.ok ? result.breakdown : null;

  const markStarted = useCalculatorTracking('crs');
  const update = (next: CrsForm): void => {
    markStarted();
    setForm(next);
  };

  const onSave = (): void => {
    if (!account) {
      router.push(withNext('/connexion', '/outils/crs'));
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast.add({ title: tSummary('saveOffline'), type: 'warning' });
      return;
    }
    save.reset();
    setNaming(true);
  };

  const saveAs = (name: string): void => {
    save.mutate(
      { name, profile: toProfile(form), rules },
      {
        onSuccess: (saved) => {
          track('crs.saved', { total: saved.total });
          void queryClient.invalidateQueries({ queryKey: trpc.crs.list.queryKey() });
          setNaming(false);
          toast.add({ title: tSummary('saved'), type: 'success' });
        },
      },
    );
  };

  const openSaved = (profile: CrsProfile): void => update(fromProfile(profile));

  return (
    <div className="grid grid-cols-1 items-start gap-7 pb-20 lg:grid-cols-3 lg:pb-0">
      <PhoneScoreBar label={t('summary.total')} score={breakdown?.total ?? null} />
      <div className="min-w-0 space-y-4 lg:col-span-2">
        <p className="text-body-sm text-slate">
          {t('rulesNote', { date: format.dateTime(new Date(rules), { dateStyle: 'long', timeZone: 'UTC' }) })}
        </p>
        <RulesChoice
          name="crs-rules"
          inForce={inForce}
          rules={rules}
          onChange={setRules}
          hint={t('rulesHint')}
        />

        <CrsFields form={form} onChange={update} rules={rules} result={result} />
      </div>

      <div className="space-y-4 lg:sticky-below-nav">
        <ScoreSummary
          breakdown={breakdown}
          onSave={onSave}
          onReset={() => update(DEFAULT_FORM)}
          saving={save.isPending}
        />
        <ScoreAdvice profile={toProfile(form)} rules={rules} />
        {/* The User's own data on a static page: fetched in the browser, under a skeleton. */}
        {account ? (
          <QueryBoundary fallback={<SavedSimulationsSkeleton />}>
            <SavedSimulations onOpen={openSaved} />
          </QueryBoundary>
        ) : null}
        {naming ? (
          <SaveSimulationDialog
            open
            defaultName={t('summary.defaultName', { date: format.dateTime(today, { dateStyle: 'medium' }) })}
            saving={save.isPending}
            failed={save.isError}
            onSave={saveAs}
            onClose={() => setNaming(false)}
          />
        ) : null}
      </div>
    </div>
  );
}
