import { describe, expect, it } from 'vitest';

import { predictNextDraws } from '@/features/draw-prediction/lib/predict-next-draws';
import type { DrawGroup } from '@/features/draws/lib/draw-type';
import type { DrawSummary } from '@/features/draws/lib/draw-summary';

/**
 * Seam: the Prédiction de tirage, one pure function from the stored Tirages
 * and the current instant to each group's next expected Tirage.
 *
 * Every expected date and score below is worked out by hand from the fixture
 * (calendar arithmetic, weekdays and sorted lists in the comments), never by
 * calling the module's own helpers.
 */

const NOW = new Date('2026-10-27T10:00:00Z'); // a Tuesday

const LABELS: Record<DrawGroup, string> = {
  GENERAL: 'No Program Specified',
  PNP: 'Provincial Nominee Program',
  CEC: 'Canadian Experience Class',
  FRENCH: 'French-Language proficiency 2026-Version 2',
  CATEGORY: 'Healthcare and social services occupations 2026-Version 1',
};
const HEALTH = 'Healthcare and social services occupations 2026-Version 1';
const TRADES = 'Trades Occupations, 2026-Version 3';
const STEM = 'STEM occupations 2026-Version 1';

let roundNumber = 300;
function draw(group: DrawGroup, date: string, crsMin: number, typeLabel = LABELS[group]): DrawSummary {
  roundNumber += 1;
  return {
    round: String(roundNumber),
    roundNumber,
    date,
    typeLabel,
    group,
    invitations: 1000,
    crsMin,
    irccUrl: null,
    crsChange: null,
    tieBreakAt: null,
  };
}

/**
 * PNP: every other Monday, 07-06 to 10-26. CEC: every other Tuesday, 07-28 to
 * 10-20. CATEGORY: every fourth Thursday, 06-04 to 10-22, mostly Santé.
 * FRENCH: irregular, on Wednesdays (05-06, 07-01, 08-19), Fridays (06-12,
 * 09-25, 10-16) and a Thursday (07-30). GENERAL: one Tirage 17 months ago.
 */
const FIXTURE: DrawSummary[] = [
  draw('GENERAL', '2025-05-14', 480),
  draw('PNP', '2026-07-06', 761),
  draw('PNP', '2026-07-20', 772),
  draw('PNP', '2026-08-03', 725),
  draw('PNP', '2026-08-17', 734),
  draw('PNP', '2026-08-31', 697),
  draw('PNP', '2026-09-14', 744),
  draw('PNP', '2026-09-28', 760),
  draw('PNP', '2026-10-12', 752),
  draw('PNP', '2026-10-26', 770),
  draw('CEC', '2026-07-28', 518),
  draw('CEC', '2026-08-11', 521),
  draw('CEC', '2026-08-25', 519),
  draw('CEC', '2026-09-08', 523),
  draw('CEC', '2026-09-22', 515),
  draw('CEC', '2026-10-06', 520),
  draw('CEC', '2026-10-20', 517),
  draw('FRENCH', '2026-05-06', 400),
  draw('FRENCH', '2026-06-12', 420),
  draw('FRENCH', '2026-07-01', 395),
  draw('FRENCH', '2026-07-30', 430),
  draw('FRENCH', '2026-08-19', 410),
  draw('FRENCH', '2026-09-25', 440),
  draw('FRENCH', '2026-10-16', 407),
  draw('CATEGORY', '2026-06-04', 470, HEALTH),
  draw('CATEGORY', '2026-07-02', 433, TRADES),
  draw('CATEGORY', '2026-07-30', 462, HEALTH),
  draw('CATEGORY', '2026-08-27', 491, STEM),
  draw('CATEGORY', '2026-09-24', 455, HEALTH),
  draw('CATEGORY', '2026-10-22', 448, HEALTH),
].toReversed(); // newest first, as draws.list returns them

const predictionFor = (group: DrawGroup, draws = FIXTURE, now = NOW) => {
  const found = predictNextDraws(draws, now).byGroup.find((p) => p.group === group);
  if (!found) throw new Error(`no prediction for ${group}`);
  return found;
};

describe('predictNextDraws — the date', () => {
  it('gives a regular group its usual weekday, one usual gap after its last Tirage', () => {
    // PNP: gaps all 14 days; last 10-26 (Monday) + 14 = 11-09, a Monday.
    expect(predictionFor('PNP').date).toEqual({
      precise: true,
      day: '2026-11-09',
      weekStart: '2026-11-09',
      weekEnd: '2026-11-15',
    });
    // CEC: last 10-20 (Tuesday) + 14 = 11-03, a Tuesday.
    expect(predictionFor('CEC').date).toMatchObject({ precise: true, day: '2026-11-03' });
  });

  it('gives an irregular group the week only, around its usual weekday', () => {
    // FRENCH gaps: 37, 19, 29, 20, 37, 21 → sorted 19 20 21 29 37 37, median 25.
    // 10-16 + 25 = 11-10 (Tuesday). Usual weekday: Wednesday 3, Friday 3, a
    // tie the most recent (10-16, a Friday) breaks → the Friday within 3 days
    // of 11-10 is 11-13, in the week of Monday 11-09.
    expect(predictionFor('FRENCH').date).toEqual({
      precise: false,
      day: '2026-11-13',
      weekStart: '2026-11-09',
      weekEnd: '2026-11-15',
    });
  });

  it('moves a passed date to the next usual weekday and says so', () => {
    // On Thursday 11-12, PNP's 11-09 has passed: the next Monday is 11-16.
    const late = predictionFor('PNP', FIXTURE, new Date('2026-11-12T10:00:00Z'));
    expect(late.overdue).toBe(true);
    expect(late.date).toMatchObject({ day: '2026-11-16', weekStart: '2026-11-16', weekEnd: '2026-11-22' });
    expect(predictionFor('PNP').overdue).toBe(false);
  });

  it('features the group expected first: CEC on 11-03 before PNP on 11-09', () => {
    expect(predictNextDraws(FIXTURE, NOW).featured?.group).toBe('CEC');
  });

  it('predicts only groups with a Tirage in the last 12 months', () => {
    expect(predictNextDraws(FIXTURE, NOW).byGroup.map((p) => p.group)).not.toContain('GENERAL');
  });
});

describe('predictNextDraws — the score', () => {
  it('centres on the median of the last 3 cut-offs, give or take 1.5 times the usual change', () => {
    // PNP last 3: 770, 752, 760 → median 760. Last 7 in order: 725 734 697
    // 744 760 752 770; changes 9 37 47 16 8 18 → sorted 8 9 16 18 37 47,
    // median 17; 1.5 × 17 = 25.5 → 26. Range 734–786.
    expect(predictionFor('PNP').scores).toMatchObject({ center: 760, low: 734, high: 786 });
  });

  it('never narrows the range below ± 4 points', () => {
    // CEC last 3: 517, 520, 515 → 517. Last 7 in order: 518 521 519 523 515
    // 520 517; changes 3 2 4 8 5 3 → sorted 2 3 3 4 5 8, median 3.5; 1.5 ×
    // 3.5 = 5.25 → 5. Range 512–522.
    expect(predictionFor('CEC').scores).toMatchObject({ center: 517, low: 512, high: 522 });
  });

  it('reads Catégorie from its most likely type only, not the whole group', () => {
    // Last 3 Catégorie: Santé 10-22, Santé 09-24, STIM 08-27 → Santé, 2 of 3.
    // Santé alone, newest first: 448, 455, 462, 470 → last 3 median 455;
    // in order 470 462 455 448, changes 8 7 7 → median 7; 1.5 × 7 = 10.5 → 11.
    // (Trades' 433 and STEM's 491 are left out.)
    const category = predictionFor('CATEGORY');
    expect(category.category).toMatchObject({ count: 2, of: 3 });
    expect(category.category?.draw.typeLabel).toBe(HEALTH);
    expect(category.scores).toMatchObject({ center: 455, low: 444, high: 466 });
  });
});

describe('predictNextDraws — reliability', () => {
  it('measures itself on the past year: a perfectly regular group finds every week and day', () => {
    // PNP replays: each Tirage from 08-03 on (two earlier ones give a gap),
    // predicted the day after the one before it: 7 replays, all exact.
    expect(predictionFor('PNP').reliability).toMatchObject({ level: 'high', sample: 7, weekRate: 1, dayRate: 1 });
  });

  it('rates an irregular group low', () => {
    // FRENCH replays: 07-01, 07-30, 08-19, 09-25, 10-16.
    expect(predictionFor('FRENCH').reliability).toMatchObject({ level: 'low', sample: 5 });
  });

  it('says nothing about reliability with fewer than 4 replays', () => {
    const recentOnly = FIXTURE.filter((d) => d.group !== 'PNP' || d.date >= '2026-09-14');
    // PNP 09-14, 09-28, 10-12, 10-26: only 10-12 and 10-26 have two earlier ones.
    expect(predictionFor('PNP', recentOnly).reliability).toBeNull();
  });
});
