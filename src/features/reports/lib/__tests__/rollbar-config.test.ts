import { afterEach, describe, expect, it } from 'vitest';

import { forgetRollbarItems, recentRollbarItems, rememberRollbarItem } from '@/features/reports/lib/recent-errors';
import { pathOf } from '@/features/reports/lib/report-schema';
import {
  baseRollbarConfig,
  REPLAY_OPTIONS,
  rollbarOccurrenceUrl,
  rollbarPerson,
  safeUrl,
  sanitizeItem,
  SCRUB_FIELDS,
} from '@/features/reports/lib/rollbar-config';

afterEach(() => forgetRollbarItems());

describe('what Rollbar may know (#160)', () => {
  it('knows the Account by its id and role only', () => {
    expect(rollbarPerson({ id: 'acc_1', role: 'MEMBER' })).toEqual({ id: 'acc_1', role: 'MEMBER' });
    expect(rollbarPerson(null)).toEqual({ id: null, role: undefined });
    const config = baseRollbarConfig('token');
    expect(config).toMatchObject({ enabled: true, captureEmail: false, captureUsername: false, captureIp: false, scrubRequestBody: true });
    expect(config.scrubFields).toEqual(expect.arrayContaining(['password', 'email', 'phone', 'signature', 'wrappedKey']));
    // An error's own text survives: these names are scrubbed everywhere.
    expect(SCRUB_FIELDS).not.toContain('message');
  });

  it('sends nothing without a token', () => {
    expect(baseRollbarConfig(undefined).enabled).toBe(false);
  });

  it('records a replay with every text and value masked, and no image, PDF page or frame', () => {
    expect(REPLAY_OPTIONS).toMatchObject({ maskAllInputs: true, maskTextSelector: '*', inlineImages: false, recordCanvas: false });
    expect(REPLAY_OPTIONS.sampling.mousemove).toBe(false);
    expect(REPLAY_OPTIONS.blockSelector).toEqual(expect.stringContaining('canvas'));
    expect(REPLAY_OPTIONS.blockSelector).toEqual(expect.stringContaining('img'));
    expect(REPLAY_OPTIONS.blockSelector).toEqual(expect.stringContaining('iframe'));
    expect(REPLAY_OPTIONS.maskTextFn('Aminata Diallo')).toBe('••••••• ••••••');
    expect(REPLAY_OPTIONS.maskInputFn('secret')).toBe('••••••');
  });

  it('keeps addresses without their query string or a private link’s token', () => {
    expect(safeUrl('https://site.com/fr/reinitialiser-mot-de-passe?token=abc#x')).toBe('https://site.com/fr/reinitialiser-mot-de-passe');
    expect(safeUrl('/fr/services/offre/abcdef0123/commande')).toBe('/fr/services/offre/[token]/commande');

    const item = {
      request: { url: 'https://site.com/fr/services/offre/tok123?ref=mail', query_string: 'ref=mail' },
      context: '/fr/outils?q=passport',
      body: { telemetry: [{ body: { from: '/fr?a=1', to: '/fr/services/offre/tok123' } }] },
    };
    sanitizeItem(item);
    expect(item).toEqual({
      code_version: 'local',
      request: { url: 'https://site.com/fr/services/offre/[token]' },
      context: '/fr/outils',
      body: { telemetry: [{ body: { from: '/fr', to: '/fr/services/offre/[token]' } }] },
    });
  });

  it('remembers the tab’s last five Rollbar items, newest first, for a report', () => {
    for (const uuid of ['a', 'b', 'c', 'd', 'e', 'f', 'b', undefined]) rememberRollbarItem(uuid);
    expect(recentRollbarItems()).toEqual(['b', 'f', 'e', 'd', 'c']);
    expect(rollbarOccurrenceUrl('u-1')).toBe('https://rollbar.com/occurrence/uuid/?uuid=u-1');
    expect(pathOf('https://site.com/fr/mon-espace?onglet=factures#x')).toBe('/fr/mon-espace');
  });
});
