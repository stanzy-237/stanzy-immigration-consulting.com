import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@/features/meetings/server/webhook-route';

const stream = vi.hoisted(() => ({ streamConfigured: vi.fn(() => true), stream: vi.fn() }));
vi.mock('@/features/meetings/server/stream', () => stream);
const storage = vi.hoisted(() => ({ objectSize: vi.fn() }));
vi.mock('@/server/storage/r2', () => storage);
const db = vi.hoisted(() => ({
  prisma: {
    meeting: { findUnique: vi.fn() },
    account: { findMany: vi.fn() },
    meetingRecording: { upsert: vi.fn() },
  },
}));
vi.mock('@/server/db/client', () => db);

/** Seam: Stream's webhook with a stubbed signature check, database and bucket. */
beforeEach(() => {
  vi.clearAllMocks();
  stream.stream.mockReturnValue({ verifyWebhook: (_body: string, signature: string) => signature === 'good' });
  db.prisma.meeting.findUnique.mockResolvedValue({
    id: 'm_1',
    participants: [{ account: { id: 'acc_1', name: 'Aminata Diallo' } }],
  });
  db.prisma.account.findMany.mockResolvedValue([{ id: 'acc_stanzy', name: 'Stanzy' }]);
});

const call = (event: unknown, signature = 'good') =>
  POST(new Request('https://stanzy.test/api/meetings/webhook', {
    method: 'POST',
    headers: { 'x-signature': signature },
    body: JSON.stringify(event),
  }));
const file = { filename: 'rec_1.mp4', url: 'https://stream.test/rec_1.mp4', start_time: '2026-11-11T13:00:00Z', end_time: '2026-11-11T13:30:00Z' };

describe('Stream’s webhook', () => {
  it('refuses an unsigned call', async () => {
    expect((await call({ type: 'call.recording_ready' }, 'bad')).status).toBe(401);
    expect(db.prisma.meetingRecording.upsert).not.toHaveBeenCalled();
  });

  it('records an Enregistrement, with its key in our bucket when Stream put it there', async () => {
    storage.objectSize.mockResolvedValue(1_000_000);
    expect((await call({ type: 'call.recording_ready', call_cid: 'default:meeting_m_1', call_recording: file })).status).toBe(204);
    expect(db.prisma.meetingRecording.upsert).toHaveBeenCalledWith({
      where: { meetingId_kind_filename: { meetingId: 'm_1', kind: 'RECORDING', filename: 'rec_1.mp4' } },
      create: expect.objectContaining({ meetingId: 'm_1', kind: 'RECORDING', objectKey: 'meetings/rec_1.mp4', text: null }),
      update: expect.objectContaining({ objectKey: 'meetings/rec_1.mp4' }),
    });
  });

  it('keeps a Transcription’s words, with the speakers’ names', async () => {
    storage.objectSize.mockResolvedValue(null);
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(`${JSON.stringify({ type: 'speech', speaker_id: 'acc_stanzy', text: 'Bonjour Aminata.' })}\n`),
    );
    await call({ type: 'call.transcription_ready', call_cid: 'default:meeting_m_1', call_transcription: { ...file, filename: 't_1.jsonl' } });
    expect(db.prisma.meetingRecording.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ kind: 'TRANSCRIPTION', objectKey: null, text: 'Stanzy : Bonjour Aminata.' }),
      }),
    );
    fetch.mockRestore();
  });

  it('ignores other events and other calls', async () => {
    expect((await call({ type: 'call.session_started', call_cid: 'default:meeting_m_1' })).status).toBe(204);
    expect((await call({ type: 'call.recording_ready', call_cid: 'default:room', call_recording: file })).status).toBe(204);
    expect(db.prisma.meetingRecording.upsert).not.toHaveBeenCalled();
  });
});
