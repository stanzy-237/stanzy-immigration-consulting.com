'use client';

import { Check, Circle, CircleDot, SkipForward } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import type { ServiceType } from '@/features/dossiers/data/workflows';
import {
  displayState,
  stagePosition,
  stageStatuses,
  type DisplayState,
  type StageStatus,
} from '@/features/dossiers/lib/workflow';

const ICONS: Record<StageStatus, ReactNode> = {
  skipped: <SkipForward aria-hidden={true} className="size-3.5" />,
  done: <Check aria-hidden={true} className="size-3.5" />,
  current: <CircleDot aria-hidden={true} className="size-3.5" />,
  upcoming: <Circle aria-hidden={true} className="size-3.5" />,
};

const DOT: Record<StageStatus, string> = {
  skipped: 'bg-fog-light text-slate',
  done: 'bg-leaf-tint text-leaf',
  current: 'bg-rouge text-white',
  upcoming: 'bg-white text-slate-mute ring-2 ring-fog-light',
};

/**
 * A Dossier's stages from first to last, with the current one marked and the
 * ones before its starting stage read « Déjà fait ». The same for the Client
 * and the consultant; a closed Dossier shows where it stopped.
 */
export function StageStepper({
  service,
  stage,
  startStage,
}: {
  service: ServiceType;
  stage: string;
  startStage: string;
}): ReactNode {
  const t = useTranslations('Dossiers');
  const stages = stageStatuses(service, stage, startStage);

  return (
    <ol aria-label={t('stepperLabel')} className="grid gap-1">
      {stages.map(({ key, status }, index) => (
        <li
          key={key}
          aria-current={status === 'current' ? 'step' : undefined}
          className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${status === 'current' ? 'bg-blush' : ''}`}
        >
          <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${DOT[status]}`}>
            {ICONS[status]}
          </span>
          <span
            className={`min-w-0 flex-1 text-sm ${status === 'current' ? 'font-semibold text-navy-deep' : status === 'upcoming' ? 'text-slate' : 'text-navy-deep'}`}
          >
            <span className="text-slate-mute">{index + 1}. </span>
            {t(`stages.${service}.${key}` as never)}
          </span>
          <span className="shrink-0 text-xs font-semibold text-slate">{t(`stageStatus.${status}`)}</span>
        </li>
      ))}
    </ol>
  );
}

const PILL: Record<DisplayState, string> = {
  OPEN: 'bg-ice-blue text-navy-deep',
  DONE: 'bg-leaf-tint text-leaf',
  CLOSED: 'bg-fog-light text-slate',
};

/** En cours, Terminé (open at its last stage) or Clôturé. */
export function DossierStatePill({
  dossier,
}: {
  dossier: { service: ServiceType; stage: string; state: 'OPEN' | 'CLOSED' };
}): ReactNode {
  const t = useTranslations('Dossiers');
  const state = displayState(dossier.service, dossier.stage, dossier.state);
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${PILL[state]}`}>
      {t(`state.${state}`)}
    </span>
  );
}

/** « Étape 5 sur 10 · Dans le bassin ». */
export function StageSummary({ service, stage }: { service: ServiceType; stage: string }): ReactNode {
  const t = useTranslations('Dossiers');
  const { position, total } = stagePosition(service, stage);
  return (
    <>
      <span className="text-slate">{t('progress', { current: position, total })} · </span>
      {t(`stages.${service}.${stage}` as never)}
    </>
  );
}
