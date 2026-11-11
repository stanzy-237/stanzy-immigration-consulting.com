'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { toast } from '@/components/ui/toast';
import { InterestSteps } from '@/features/accompagnement/components/interest-form';
import type { InterestAnswers } from '@/features/accompagnement/lib/interest-schema';
import { fromProfile } from '@/features/crs/lib/crs-form';
import { useTRPC } from '@/trpc/client';

/**
 * The consultant corrects a Demande's declarations before deciding (#154):
 * the Client's five steps, opened on their answers. Saving recomputes the
 * Niveau and the CRS score; the Client's own answers stay on the page.
 */
export function InterestEdit({
  interest,
  onDone,
}: {
  interest: { id: string; answers: InterestAnswers };
  onDone: () => void;
}): ReactNode {
  const t = useTranslations('Accompagnement');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { answers } = interest;
  const save = useMutation(
    trpc.accompagnement.dashboard.updateAnswers.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.accompagnement.dashboard.pathKey() });
        toast.add({ title: t('dashboard.edit.saved'), type: 'success' });
        onDone();
      },
      onError: (error) => {
        const known = t.has(`errors.${error.message}`);
        void queryClient.invalidateQueries({ queryKey: trpc.accompagnement.dashboard.pathKey() });
        toast.add({ title: t(known ? `errors.${error.message}` : 'errors.UNKNOWN'), type: known ? 'warning' : 'error' });
      },
    }),
  );

  return (
    <section aria-labelledby="interest-edit" className="grid grid-cols-1 gap-4 rounded-2xl border-2 border-navy-deep bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="interest-edit" className="font-heading text-lg font-bold text-navy-deep">
            {t('dashboard.edit.title')}
          </h2>
          <p className="mt-1 text-sm text-slate">{t('dashboard.edit.hint')}</p>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-slate hover:text-navy-deep"
        >
          <X aria-hidden={true} className="size-4" />
          {t('dashboard.edit.cancel')}
        </button>
      </div>
      <InterestSteps
        initial={{
          situation: answers.checklist,
          source: { kind: 'own' },
          progress: answers.progress,
          work: answers.work,
          areas: answers.areas,
          crs: answers.crs ? fromProfile(answers.crs.profile) : null,
        }}
        pending={save.isPending}
        submitLabel={t('dashboard.edit.save')}
        onSubmit={(next) => save.mutate({ id: interest.id, answers: next })}
      />
    </section>
  );
}
