import { describe, expect, it, vi } from 'vitest';

const call = vi.hoisted(() => ({ getOrCreate: vi.fn(), update: vi.fn(), updateCallMembers: vi.fn() }));
vi.mock('@stream-io/node-sdk', () => ({
  StreamClient: class {
    upsertUsers = vi.fn();
    generateCallToken = vi.fn(() => 'token');
    video = { call: () => call };
  },
}));
vi.mock('@/lib/env', () => ({ env: { STREAM_API_KEY: 'key', STREAM_API_SECRET: 'secret' } }));
vi.mock('@/lib/site-url', () => ({ siteUrl: () => 'https://stanzy.test' }));

import { openRoom } from '@/features/meetings/server/stream';

describe('a Réunion’s call on Stream', () => {
  it('records each camera whole (fit, not cropped to fill), in the Client’s language', async () => {
    await openRoom({
      meeting: { id: 'm_1', subject: 'Point dossier', recording: true, plannedById: 'acc_stanzy' },
      people: [{ id: 'acc_stanzy', name: 'Stanzy', consultant: true }],
      viewer: { id: 'acc_stanzy', name: 'Stanzy', consultant: true },
      language: 'fr',
    });
    const settings = call.update.mock.calls[0]![0].settings_override;
    expect(settings.recording).toMatchObject({
      mode: 'auto-on',
      layout: {
        name: 'spotlight',
        options: expect.objectContaining({ 'video.scale_mode': 'fit', 'title.text': 'Point dossier' }),
      },
    });
    expect(settings.transcription).toMatchObject({ mode: 'auto-on', language: 'fr' });
  });
});
