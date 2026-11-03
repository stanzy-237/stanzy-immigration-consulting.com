import { beforeEach, describe, expect, it, vi } from 'vitest';

import { purgeOldPdfToolFiles } from '@/features/pdf-tools/server/purge';
import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

const storage = vi.hoisted(() => ({
  objectSize: vi.fn(),
  deleteObjects: vi.fn(),
  presignUpload: vi.fn(),
  readObject: vi.fn(),
}));
vi.mock('@/server/storage/r2', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/server/storage/r2')>()),
  ...storage,
}));
vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }));
vi.stubEnv('DOSSIER_FILES_KEY', 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=');

/** Seam: the Outils PDF history through a server-side caller, over an in-memory pdf_tool_file table; R2 stubbed. */
type Row = Record<string, unknown> & { id: string; createdById: string; createdAt: Date; objectKey: string };

function fakeDatabase(rows: Row[] = []) {
  let seq = 0;
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => {
      if (value && typeof value === 'object' && 'lt' in value) return (row[key] as Date) < (value as { lt: Date }).lt;
      if (value && typeof value === 'object' && 'in' in value)
        return (value as { in: unknown[] }).in.includes(row[key]);
      return row[key] === value;
    });
  const pdfToolFile = {
    async findMany({ where }: { where: Record<string, unknown> }) {
      return rows.filter((r) => matches(r, where)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async findFirst({ where }: { where: Record<string, unknown> }) {
      return rows.find((r) => matches(r, where)) ?? null;
    },
    async create({ data }: { data: Record<string, unknown> }) {
      const row = { ...data, id: `f${++seq}`, createdAt: new Date() } as Row;
      rows.push(row);
      return row;
    },
    async delete({ where }: { where: { id: string } }) {
      rows.splice(
        rows.findIndex((r) => r.id === where.id),
        1,
      );
    },
    async deleteMany({ where }: { where: Record<string, unknown> }) {
      for (const r of rows.filter((row) => matches(row, where))) rows.splice(rows.indexOf(r), 1);
    },
  };
  return { prisma: { pdfToolFile } as unknown as TRPCContext['prisma'], rows };
}

const consultant = sessionFor({ id: 'acc_stanzy', role: 'CONSULTANT' });
const other = sessionFor({ id: 'acc_other', role: 'CONSULTANT' });
const as = (db: ReturnType<typeof fakeDatabase>, session: CurrentSession) =>
  createCaller({ prisma: db.prisma, headers: new Headers(), session }).pdfTools.history;

const upload = (extra: Record<string, unknown> = {}) => ({
  objectKey: 'pdf-tools/acc_stanzy/9a2b.bin',
  key: 'ZmVkY2JhOTg3NjU0MzIxMGZlZGNiYTk4NzY1NDMyMTA=',
  iv: 'B'.repeat(16),
  fileName: 'releve-n2.pdf',
  contentType: 'application/pdf' as const,
  size: 2000,
  pageCount: 3,
  changes: ['merged', 'compressed'] as ('merged' | 'compressed')[],
  quality: 0.65,
  sourceNames: ['releve.pdf', 'photo.jpg'],
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  storage.objectSize.mockResolvedValue(2016);
});

describe('the Outils PDF history', () => {
  it('keeps a downloaded PDF with what was done, encrypted, for its consultant only', async () => {
    const db = fakeDatabase();
    const added = await as(db, consultant).add(upload());
    expect(added).toMatchObject({
      name: 'releve-n2.pdf',
      pageCount: 3,
      changes: ['merged', 'compressed'],
      quality: 0.65,
    });
    expect(db.rows[0]!.wrappedKey).not.toContain('ZmVkY2Jh');
    expect(await as(db, consultant).list()).toHaveLength(1);
    expect(await as(db, other).list()).toHaveLength(0);
  });

  it('refuses a file outside the consultant’s folder', async () => {
    const db = fakeDatabase();
    await expect(as(db, other).add(upload())).rejects.toMatchObject({ message: 'DOCUMENT_FILE_INVALID' });
  });

  it('deletes one’s own file and its copy, never someone else’s', async () => {
    const db = fakeDatabase();
    const { id } = await as(db, consultant).add(upload());
    await expect(as(db, other).delete({ id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await as(db, consultant).delete({ id });
    expect(db.rows).toEqual([]);
    expect(storage.deleteObjects).toHaveBeenCalledWith('private', ['pdf-tools/acc_stanzy/9a2b.bin']);
  });

  it('is for the consultant only', async () => {
    await expect(as(fakeDatabase(), sessionFor()).list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('after 90 days', () => {
  it('deletes the old files and their copies, keeps the recent ones', async () => {
    const now = new Date('2026-11-03T06:00:00Z');
    const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    const db = fakeDatabase([
      { id: 'old', createdById: 'acc_stanzy', createdAt: daysAgo(91), objectKey: 'pdf-tools/a/old.bin' },
      { id: 'new', createdById: 'acc_stanzy', createdAt: daysAgo(89), objectKey: 'pdf-tools/a/new.bin' },
    ]);
    expect(await purgeOldPdfToolFiles(db.prisma, now)).toBe(1);
    expect(db.rows.map((r) => r.id)).toEqual(['new']);
    expect(storage.deleteObjects).toHaveBeenCalledWith('private', ['pdf-tools/a/old.bin']);
  });
});
