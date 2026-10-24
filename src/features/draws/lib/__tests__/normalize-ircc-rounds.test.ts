import { describe, expect, it } from 'vitest';

import { normalizeIrccRounds } from '@/features/draws/lib/normalize-ircc-rounds';

import feed from './fixtures/ee-rounds.json';

/**
 * Seam: IRCC's `ee_rounds_123_en.json` in, clean Tirages out. The fixture is a
 * trimmed copy of the real feed (one round per draw name, plus 91a/91b).
 */
const IRCC_ROUNDS = 'https://www.canada.ca/en/immigration-refugees-citizenship/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-rounds';

const clone = (): { classes: string; rounds: Record<string, string>[] } => structuredClone(feed);
const byRound = (round: string) => normalizeIrccRounds(feed).draws.find((d) => d.round === round);

describe('normalizeIrccRounds', () => {
  it('turns IRCC strings into numbers, an ISO date and a public notice link', () => {
    expect(byRound('450')).toEqual({
      round: '450',
      roundNumber: 450,
      date: '2026-10-16',
      typeLabel: 'French-Language proficiency 2026-Version 2',
      group: 'FRENCH',
      invitations: 5000,
      crsMin: 435,
      irccUrl: `${IRCC_ROUNDS}/invitations.html?q=450`,
      raw: feed.rounds[0],
    });
  });

  it('reads old-style notice links too', () => {
    expect(byRound('1')?.irccUrl).toBe(`${IRCC_ROUNDS}/invitations-1.html`);
  });

  it('keeps the split rounds 91a and 91b apart, both numbered 91', () => {
    expect(byRound('91a')).toMatchObject({ roundNumber: 91, group: 'GENERAL', invitations: 500 });
    expect(byRound('91b')).toMatchObject({ roundNumber: 91, group: 'PNP', crsMin: 902 });
  });

  it.each([
    ['448', 'PNP'],
    ['449', 'CEC'],
    ['388', 'FRENCH'],
    ['1', 'GENERAL'],
    ['294', 'GENERAL'],
    ['240', 'GENERAL'],
    ['159', 'GENERAL'],
    // "Canadian Work Experience" categories are not the Canadian Experience Class.
    ['440', 'CATEGORY'],
    ['444', 'CATEGORY'],
    ['293', 'CATEGORY'],
    ['447', 'CATEGORY'],
    ['441', 'CATEGORY'],
    ['430', 'CATEGORY'],
    ['285', 'CATEGORY'],
  ])('puts round %s in the %s group', (round, group) => {
    expect(byRound(round)?.group).toBe(group);
  });

  it('returns every round in the feed', () => {
    const result = normalizeIrccRounds(feed);
    expect(result.draws).toHaveLength(feed.rounds.length);
    expect(result.skipped).toEqual([]);
  });

  it('skips a corrupted round and keeps the rest', () => {
    const broken = clone();
    broken.rounds[1]!.drawCRS = 'n/a';
    broken.rounds[2]!.drawDate = '';

    const result = normalizeIrccRounds(broken);

    expect(result.draws).toHaveLength(feed.rounds.length - 2);
    expect(result.draws.map((d) => d.round)).not.toContain('449');
    expect(result.skipped).toEqual([
      { index: 1, reason: expect.any(String) },
      { index: 2, reason: expect.any(String) },
    ]);
  });

  it('throws when the feed is not shaped like IRCC rounds', () => {
    expect(() => normalizeIrccRounds({ data: [] })).toThrow();
    expect(() => normalizeIrccRounds('<html>')).toThrow();
  });
});
