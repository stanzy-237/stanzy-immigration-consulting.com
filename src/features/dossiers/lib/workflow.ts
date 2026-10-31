import { WORKFLOWS, type ServiceType } from '@/features/dossiers/data/workflows';

export const stagesOf = (service: ServiceType): readonly string[] => WORKFLOWS[service];

export const isStageOf = (service: ServiceType, stage: string): boolean =>
  stagesOf(service).includes(stage);

/** The stage after `stage`, or null on the last one. */
export function nextStage(service: ServiceType, stage: string): string | null {
  const stages = stagesOf(service);
  const index = stages.indexOf(stage);
  if (index === -1) throw new Error(`Unknown stage ${stage} for ${service}`);
  return stages[index + 1] ?? null;
}

/** The stage before `stage`, or null on the first one. */
export function previousStage(service: ServiceType, stage: string): string | null {
  const stages = stagesOf(service);
  const index = stages.indexOf(stage);
  if (index === -1) throw new Error(`Unknown stage ${stage} for ${service}`);
  return index === 0 ? null : stages[index - 1]!;
}

export const isLastStage = (service: ServiceType, stage: string): boolean =>
  nextStage(service, stage) === null;

/**
 * How each stage reads on the Dossier's stepper: `skipped` before the stage it
 * opened at (« Déjà fait »), `done` from there up to the current one, then
 * `current` and `upcoming`. Moving back can put the current stage before the
 * start: the stages from it up to the start then read as `current`/`upcoming`.
 */
export type StageStatus = 'skipped' | 'done' | 'current' | 'upcoming';

export function stageStatuses(
  service: ServiceType,
  stage: string,
  startStage: string,
): { key: string; status: StageStatus }[] {
  const stages = stagesOf(service);
  const current = stages.indexOf(stage);
  const start = Math.min(stages.indexOf(startStage), current);
  return stages.map((key, index) => ({
    key,
    status:
      index === current ? 'current' : index > current ? 'upcoming' : index < start ? 'skipped' : 'done',
  }));
}
