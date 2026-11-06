import { beforeEach, describe, expect, it, vi } from 'vitest';

import { syncMeetingFiles } from '@/features/meetings/server/meeting-files';
import type { TRPCContext } from '@/server/trpc/context';

const calls = vi.hoisted(() => ({ listRecordings: vi.fn(), listTranscriptions: vi.fn(), call: vi.fn() }));
const stream = vi.hoisted(() => ({ streamConfigured: vi.fn(() => true), stream: vi.fn() }));
vi.mock('@/features/meetings/server/stream', () => stream);
const storage = vi.hoisted(() => ({ objectSize: vi.fn() }));
vi.mock('@/server/storage/r2', () => storage);

const now = new Date('2026-11-06T20:00:00Z');
const recording = { filename: 'rec_1.mp4', url: 'https://stream.test/rec_1.mp4', start_time: '2026-11-06T19:56:43Z', end_time: '2026-11-06T19:57:49Z' };
const transcript = { filename: 't_1.jsonl', url: 'https://stream.test/t_1.jsonl', start_time: '2026-11-06T19:56:40Z', end_time: '2026-11-06T19:57:49Z' };

function database(saved: { kind: string; filename: string }[] = []) {
  return {
    meeting: {
      findMany: vi.fn().mockResolvedValue([{ id: 'm_1', recordings: saved }]),
      findUnique: vi.fn().mockResolvedValue({ id: 'm_1', participants: [] }),
    },
    account: { findMany: vi.fn().mockResolvedValue([]) },
    meetingRecording: { upsert: vi.fn() },
  };
}
const asDb = (db: ReturnType<typeof database>) => db as unknown as TRPCContext['prisma'];

/** Seam: the sync over a stubbed Stream, database and bucket. */
beforeEach(() => {
  vi.clearAllMocks();
  calls.call.mockReturnValue({ listRecordings: calls.listRecordings, listTranscriptions: calls.listTranscriptions });
  stream.stream.mockReturnValue({ video: { call: calls.call } });
  calls.listRecordings.mockResolvedValue({ recordings: [recording] });
  calls.listTranscriptions.mockResolvedValue({ transcriptions: [transcript] });
  storage.objectSize.mockResolvedValue(25_000_000);
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(''));
});

describe('fetching a Réunion’s files from Stream', () => {
  it('records the files Stream has that are missing here, filed where Stream put them in R2', async () => {
    const db = database();
    await syncMeetingFiles(asDb(db), now);
    expect(calls.call).toHaveBeenCalledWith('default', 'meeting_m_1');
    expect(db.meetingRecording.upsert).toHaveBeenCalledTimes(2);
    expect(db.meetingRecording.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          kind: 'RECORDING',
          filename: 'rec_1.mp4',
          objectKey: 'meetings/default_meeting_m_1/rec_1.mp4',
        }),
      }),
    );
  });

  it('only looks at recorded Réunions of the last two weeks, and records each file once', async () => {
    const db = database([{ kind: 'RECORDING', filename: 'rec_1.mp4' }]);
    await syncMeetingFiles(asDb(db), now);
    expect(db.meeting.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ recording: true, startsAt: { gte: new Date('2026-10-23T20:00:00Z'), lte: now } }),
      }),
    );
    expect(db.meetingRecording.upsert).toHaveBeenCalledTimes(1);
    expect(db.meetingRecording.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ kind: 'TRANSCRIPTION' }) }),
    );
  });

  it('leaves a Réunion alone once it has both files, and survives Stream failing', async () => {
    await syncMeetingFiles(
      asDb(database([{ kind: 'RECORDING', filename: 'rec_1.mp4' }, { kind: 'TRANSCRIPTION', filename: 't_1.jsonl' }])),
      now,
    );
    expect(calls.call).not.toHaveBeenCalled();

    calls.listRecordings.mockRejectedValue(new Error('Stream down'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(syncMeetingFiles(asDb(database()), now)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});
