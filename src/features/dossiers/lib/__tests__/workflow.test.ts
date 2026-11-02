import { describe, expect, it } from 'vitest';

import { SERVICE_TYPES } from '@/features/dossiers/data/workflows';
import {
  displayState,
  isLastStage,
  isStageOf,
  nextStage,
  previousStage,
  stageStatuses,
  stagePosition,
  stagesOf,
} from '@/features/dossiers/lib/workflow';

describe('the Workflow de service', () => {
  it('gives every service its own stages, each key once', () => {
    for (const service of SERVICE_TYPES) {
      const stages = stagesOf(service);
      expect(stages.length).toBeGreaterThan(1);
      expect(new Set(stages).size).toBe(stages.length);
    }
  });

  it('moves forward and back one stage at a time', () => {
    expect(nextStage('EDE', 'verification')).toBe('compte');
    expect(previousStage('EDE', 'compte')).toBe('verification');
  });

  it('has nothing after the last stage or before the first', () => {
    expect(nextStage('ACCOMPAGNEMENT', 'copr')).toBeNull();
    expect(isLastStage('ACCOMPAGNEMENT', 'copr')).toBe(true);
    expect(previousStage('ACCOMPAGNEMENT', 'evaluation')).toBeNull();
  });

  it('refuses a stage of another service', () => {
    expect(isStageOf('EDE', 'copr')).toBe(false);
    expect(() => nextStage('EDE', 'copr')).toThrow();
  });

  it('reads the stages before the start as « Déjà fait »', () => {
    // Niveau B: an Accompagnement opened at « Création du profil EE », now in the pool.
    const statuses = stageStatuses('ACCOMPAGNEMENT', 'bassin', 'profil-ee').map((s) => s.status);
    expect(statuses).toEqual([
      'skipped',
      'skipped',
      'skipped',
      'done',
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
  });

  it('lets the current stage move back before the start', () => {
    const statuses = stageStatuses('EDE', 'compte', 'envoi').map((s) => s.status);
    expect(statuses).toEqual(['skipped', 'current', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
  });
});

describe('how a Dossier reads', () => {
  it('is Terminé once open at its last stage, Clôturé once closed', () => {
    expect(displayState('EDE', 'envoi', 'OPEN')).toBe('OPEN');
    expect(displayState('EDE', 'rapport', 'OPEN')).toBe('DONE');
    expect(displayState('EDE', 'rapport', 'CLOSED')).toBe('CLOSED');
  });

  it('counts stages from 1', () => {
    expect(stagePosition('ACCOMPAGNEMENT', 'bassin')).toEqual({ position: 5, total: 10 });
  });
});
