import { describe, expect, it } from 'vitest';

import { predictNextDraws } from '@/features/draw-prediction/lib/predict-next-draws';
import type { DrawGroup } from '@/features/draws/lib/draw-type';
import type { DrawSummary } from '@/features/draws/lib/draw-summary';

/**
 * Seam: the Prédiction de tirage, one pure function from the stored Tirages
 * and the current instant to each group's next expected Tirage.
 *
 * Every expected date and score below is worked out by hand from the fixture
 * (calendar arithmetic and sorted lists in the comments), never by calling
 * the module's own helpers.
 */

const NOW = new Date('2026-10-27T10:00:00Z');
// 12 months before NOW: 2025-10-27. Older Tirages give no cadence.

const LABELS: Record<DrawGroup, string> = {
  GENERAL: 'No Program Specified',
  PNP: 'Provincial Nominee Program',
  CEC: 'Canadian Experience Class',
  FRENCH: 'French-Language proficiency 2026-Version 2',
  CATEGORY: 'Healthcare and social services occupations 2026-Version 1',
};

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

const HEALTH = 'Healthcare and social services occupations 2026-Version 1';
const TRADES = 'Trades Occupations, 2026-Version 3';
const STEM = 'STEM occupations 2026-Version 1';

/**
 * CEC: six Tirages in the last 12 months (plus one older), gaps
 * 08-05 →12→ 08-17 →14→ 08-31 →20→ 09-20 →14→ 10-04 →16→ 10-20.
 * PNP: four Tirages two weeks apart. FRENCH: one Tirage. GENERAL: only one,
 * 17 months ago. CATEGORY: four Tirages four weeks apart, the last on 09-02.
 */
const FIXTURE: DrawSummary[] = [
  draw('CEC', '2025-09-10', 560),
  draw('CEC', '2026-08-05', 540),
  draw('CEC', '2026-08-17', 518),
  draw('CEC', '2026-08-31', 530),
  draw('CEC', '2026-09-20', 509),
  draw('CEC', '2026-10-04', 522),
  draw('CEC', '2026-10-20', 515),
  draw('PNP', '2026-09-08', 760),
  draw('PNP', '2026-09-22', 781),
  draw('PNP', '2026-10-06', 772),
  draw('PNP', '2026-10-20', 790),
  draw('FRENCH', '2026-10-22', 410),
  draw('GENERAL', '2025-05-14', 480),
  draw('CATEGORY', '2026-06-10', 470, HEALTH),
  draw('CATEGORY', '2026-07-08', 433, TRADES),
  draw('CATEGORY', '2026-08-05', 462, HEALTH),
  draw('CATEGORY', '2026-09-02', 455, HEALTH),
].toReversed(); // newest first, as draws.list returns them

const predictionFor = (group: DrawGroup, draws = FIXTURE, now = NOW) =>
  predictNextDraws(draws, now).byGroup.find((p) => p.group === group);

describe('predictNextDraws — cadence', () => {
  it('puts the window between the lower and upper quartile gaps after the last Tirage, at least median ± 2 days', () => {
    // CEC gaps sorted: 12, 14, 14, 16, 20 (the 2025-09-10 one is over 12 months old).
    // Median 14. Lower half 12, 14 → Q1 13; upper half 16, 20 → Q3 18.
    // Never narrower than 14 ± 2: start min(13, 12) = 12, end max(18, 16) = 18.
    // Window: 10-20 + 12 = 11-01, 10-20 + 18 = 11-07.
    const cec = predictionFor('CEC')!;
    expect(cec).toMatchObject({
      windowStart: '2026-11-01',
      windowEnd: '2026-11-07',
      gapDays: 14,
      fallback: false,
      overdue: false,
      countInYear: 6,
    });
    expect(cec.lastDraw.date).toBe('2026-10-20');
  });

  it('uses the median gap ± 2 days when there are too few gaps for quartiles', () => {
    // PNP gaps 14, 14, 14: median 14. Window 10-20 + 12 = 11-01, 10-20 + 16 = 11-05.
    expect(predictionFor('PNP')).toMatchObject({ windowStart: '2026-11-01', windowEnd: '2026-11-05', gapDays: 14, countInYear: 4 });
  });

  it('never gives a single day, even for a perfectly regular group', () => {
    // GENERAL every 7 days, 4 gaps: Q1 = Q3 = 7, widened to 7 ± 2.
    // Window: 10-22 + 5 = 10-27 to 10-22 + 9 = 10-31.
    const draws = ['2026-09-24', '2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22'].map((date) => draw('GENERAL', date, 480));
    expect(predictionFor('GENERAL', draws)).toMatchObject({ windowStart: '2026-10-27', windowEnd: '2026-10-31' });
  });

  it('starts a window that is already under way today', () => {
    // GENERAL 10-14, 10-21: gap 7 → 10-21 + 5 = 10-26 to 10-21 + 9 = 10-30.
    // 10-26 is behind NOW (10-27): the window starts today and is not overdue.
    const draws = [draw('GENERAL', '2026-10-21', 480), draw('GENERAL', '2026-10-14', 485)];
    expect(predictionFor('GENERAL', draws)).toMatchObject({ windowStart: '2026-10-27', windowEnd: '2026-10-30', overdue: false });
  });

  it('shifts a window that has already passed so it starts today', () => {
    // CATEGORY gaps 28, 28, 28: window 09-02 + 26 = 09-28 to 09-02 + 30 = 10-02,
    // before 10-27. Shifted: 10-27 to 10-27 + 4 = 10-31.
    expect(predictionFor('CATEGORY')).toMatchObject({ windowStart: '2026-10-27', windowEnd: '2026-10-31', overdue: true });
  });

  it('gives a single-Tirage group a window from the other groups’ cadence', () => {
    // Every gap of the other groups: CEC 12, 14, 14, 16, 20; PNP 14, 14, 14;
    // CATEGORY 28, 28, 28. Sorted, the 6th of 11 is 14.
    // FRENCH window: 10-22 + 12 = 11-03 to 10-22 + 16 = 11-07.
    expect(predictionFor('FRENCH')).toMatchObject({
      windowStart: '2026-11-03',
      windowEnd: '2026-11-07',
      gapDays: 14,
      fallback: true,
      countInYear: 1,
    });
  });

  it('leaves out a group with no Tirage in the last 12 months', () => {
    expect(predictNextDraws(FIXTURE, NOW).byGroup.map((p) => p.group)).toEqual(['PNP', 'CEC', 'FRENCH', 'CATEGORY']);
  });

  it('predicts nothing before the first Tirage is stored', () => {
    expect(predictNextDraws([], NOW)).toEqual({ featured: null, byGroup: [] });
  });
});

describe('predictNextDraws — scores', () => {
  it('gives the min, max and median of the group’s last 5 cut-offs', () => {
    // CEC last 5, newest first: 515, 522, 509, 530, 518 (540 and 560 are older).
    // Sorted 509, 515, 518, 522, 530: median 518.
    expect(predictionFor('CEC')!.scores).toEqual({ min: 509, max: 530, median: 518, last: [515, 522, 509, 530, 518] });
  });

  it('takes the middle of the two middle cut-offs when there are four', () => {
    // PNP: 790, 772, 781, 760. Sorted 760, 772, 781, 790: median (772 + 781) / 2 = 776.5 → 777.
    expect(predictionFor('PNP')!.scores).toEqual({ min: 760, max: 790, median: 777, last: [790, 772, 781, 760] });
  });
});

describe('predictNextDraws — featured', () => {
  it('features the group whose window starts first', () => {
    // Starts: CATEGORY 10-27 (shifted), PNP 11-01, CEC 11-01, FRENCH 11-03.
    expect(predictNextDraws(FIXTURE, NOW).featured?.group).toBe('CATEGORY');
  });

  it('breaks a tie on the start date with the group that had more Tirages in 12 months', () => {
    // PNP 10-06, 10-20 and CEC 09-22, 10-06, 10-20: both gaps 14 → both windows 11-01 to 11-05.
    // CEC has 3 Tirages, PNP 2.
    const draws = [
      draw('PNP', '2026-10-20', 780),
      draw('CEC', '2026-10-20', 515),
      draw('PNP', '2026-10-06', 770),
      draw('CEC', '2026-10-06', 520),
      draw('CEC', '2026-09-22', 525),
    ];
    const { featured, byGroup } = predictNextDraws(draws, NOW);
    expect(byGroup.map((p) => [p.group, p.windowStart])).toEqual([
      ['PNP', '2026-11-01'],
      ['CEC', '2026-11-01'],
    ]);
    expect(featured?.group).toBe('CEC');
  });
});

describe('predictNextDraws — Catégorie type', () => {
  it('names the type most frequent among the last 3 Catégorie Tirages', () => {
    // Last 3: 09-02 Health, 08-05 Health, 07-08 Trades → Health, 2 of 3.
    const { category } = predictionFor('CATEGORY')!;
    expect(category).toMatchObject({ count: 2, of: 3 });
    expect(category!.draw.typeLabel).toBe(HEALTH);
    expect(category!.draw.date).toBe('2026-09-02');
  });

  it('falls back to the most recent type when the last 3 all differ', () => {
    // Last 3: 10-01 STEM, 09-03 Trades, 08-06 Health → STEM, the most recent.
    const draws = [
      draw('CATEGORY', '2026-10-01', 490, STEM),
      draw('CATEGORY', '2026-09-03', 440, TRADES),
      draw('CATEGORY', '2026-08-06', 470, HEALTH),
      draw('CATEGORY', '2026-07-09', 471, HEALTH),
    ];
    const { category } = predictionFor('CATEGORY', draws)!;
    expect(category).toMatchObject({ count: 1, of: 3 });
    expect(category!.draw.typeLabel).toBe(STEM);
  });

  it('names no type for the other groups', () => {
    expect(predictionFor('CEC')!.category).toBeNull();
  });
});
