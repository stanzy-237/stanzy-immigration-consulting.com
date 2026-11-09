import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { addDraftInvoiceLine } from '@/features/invoices/server/draft-lines';
import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

const notify = vi.hoisted(() => ({
  notifyInvoiceSent: vi.fn(),
  notifyInvoicePaid: vi.fn(),
  notifyProofReceived: vi.fn(),
}));
vi.mock('@/features/invoices/server/invoice-notify', () => notify);
vi.mock('@/features/dossiers/server/dossier-notify', () => ({ notifyClient: vi.fn(), notifyConsultants: vi.fn() }));
const notifications = vi.hoisted(() => ({ notifyLater: vi.fn(), forgetComment: vi.fn(), notify: vi.fn() }));
vi.mock('@/features/notifications/server/notify', () => notifications);

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
// The Reconnaissance's PDF, its storage and the consultant's signature and stamp: stubbed, the rules run for real.
const receipts = vi.hoisted(() => ({
  receiptPdf: vi.fn(async () => ({
    bytes: new Uint8Array([1, 2, 3]),
    fields: [{ kind: 'SIGNATURE', page: 1, x: 0.1, y: 0.2, width: 0.3, height: 0.05 }],
  })),
}));
vi.mock('@/features/invoices/server/receipt-document', () => receipts);
const stored = vi.hoisted(() => ({
  storeEncryptedPdf: vi.fn(async (prefix: string) => ({ objectKey: `${prefix}r.bin`, wrappedKey: 'w', iv: 'i', size: 3 })),
}));
vi.mock('@/features/contracts/server/contract-files', () => stored);
vi.mock('@/features/signatures/server/signing-assets', () => ({
  openSigningAssets: vi.fn(async () => ({
    signature: { type: 'image/png', bytes: new Uint8Array() },
    stamp: { type: 'image/png', bytes: new Uint8Array() },
  })),
}));
const signing = vi.hoisted(() => ({
  fingerprintOf: vi.fn(async () => 'f1ng3r'),
  signPdf: vi.fn(async () => new Uint8Array([4, 5])),
}));
vi.mock('@/features/signatures/lib/sign-pdf', () => signing);
vi.mock('@/features/signatures/server/certificate', () => ({
  certificateFor: vi.fn(async () => ({ page: {}, date: '31 octobre 2026' })),
}));
vi.mock('@/features/dossiers/server/dossier-files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/dossiers/server/dossier-files')>()),
  openEncryptedFile: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
}));

// A real master key: the routers wrap each file's key with it.
vi.stubEnv('DOSSIER_FILES_KEY', 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=');

/**
 * Seam: `invoices` through a server-side caller, over an in-memory stand-in
 * for the dossier, invoice, line, counter and proof tables. Emails and R2
 * are stubbed; numbering, access and the status rules run for real.
 */
type Row = Record<string, unknown> & { id: string };

function fakeDatabase() {
  const accounts: Row[] = [
    { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com', locale: 'fr', role: 'MEMBER' },
    { id: 'acc_2', name: 'Bob Other', email: 'bob@example.com', locale: 'fr', role: 'MEMBER' },
  ];
  const dossiers: Row[] = [{ id: 'dos_1', accountId: 'acc_1', service: 'ACCOMPAGNEMENT', stage: 'ita', state: 'OPEN' }];
  const invoices: Row[] = [];
  const lines: Row[] = [];
  const proofs: Row[] = [];
  const payments: Row[] = [];
  const counters: { year: number; last: number }[] = [];
  const receiptCounters: { year: number; last: number }[] = [];
  let seq = 0;
  let clock = Date.parse('2026-10-31T09:00:00Z');

  const matches = (row: Row, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([key, condition]) => {
      const value = row[key];
      if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
        const c = condition as { in?: unknown[]; not?: unknown; lte?: Date };
        if (c.in) return c.in.includes(value);
        if ('not' in c) return value !== c.not;
        if (c.lte) return value instanceof Date && value <= c.lte;
      }
      return value === condition;
    });
  const withAccount = (dossier: Row) => ({ ...dossier, account: accounts.find((a) => a.id === dossier.accountId) });
  const full = (invoice: Row) => ({
    ...invoice,
    lines: lines
      .filter((l) => l.invoiceId === invoice.id)
      .sort((a, b) => (a.position as number) - (b.position as number)),
    proofs: proofs.filter((p) => p.invoiceId === invoice.id),
    payments: payments.filter((p) => p.invoiceId === invoice.id).map((p) => ({ ...p, proofs: proofs.filter((f) => f.paymentId === p.id) })),
    dossier: withAccount(dossiers.find((d) => d.id === invoice.dossierId)!),
  });
  const now = () => new Date((clock += 1000));

  const prisma = {
    dossier: {
      async findUnique({ where }: { where: { id: string } }) {
        const row = dossiers.find((d) => d.id === where.id);
        return row ? withAccount(row) : null;
      },
    },
    invoice: {
      async findUnique({ where }: { where: { id: string } }) {
        const row = invoices.find((i) => i.id === where.id);
        return row ? full(row) : null;
      },
      async findFirst({ where }: { where: Record<string, unknown> }) {
        return invoices.find((i) => matches(i, where)) ?? null;
      },
      async findMany({ where }: { where: Record<string, unknown> }) {
        return invoices.filter((i) => matches(i, where)).map(full);
      },
      async create({ data }: { data: Record<string, unknown> & { lines?: { create: Record<string, unknown>[] } } }) {
        const { lines: nested, ...columns } = data;
        const row: Row = {
          status: 'DRAFT',
          currency: 'XAF',
          number: null,
          dueDate: null,
          notes: null,
          sentAt: null,
          paidAt: null,
          cancelledAt: null,
          cancelReason: null,
          ...columns,
          id: `inv_${++seq}`,
          createdAt: now(),
        };
        invoices.push(row);
        for (const line of nested?.create ?? []) lines.push({ ...line, id: `line_${++seq}`, invoiceId: row.id });
        return { id: row.id };
      },
      async updateMany({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        const hit = invoices.filter((i) => matches(i, where));
        for (const i of hit) Object.assign(i, data);
        return { count: hit.length };
      },
      async deleteMany({ where }: { where: Record<string, unknown> }) {
        const hit = invoices.filter((i) => matches(i, where));
        for (const i of hit) invoices.splice(invoices.indexOf(i), 1);
        return { count: hit.length };
      },
    },
    invoiceLine: {
      async deleteMany({ where }: { where: { invoiceId: string } }) {
        for (const l of lines.filter((row) => row.invoiceId === where.invoiceId)) lines.splice(lines.indexOf(l), 1);
      },
      async createMany({ data }: { data: Record<string, unknown>[] }) {
        for (const line of data) lines.push({ ...line, id: `line_${++seq}` });
      },
      async create({ data }: { data: Record<string, unknown> }) {
        lines.push({ ...data, id: `line_${++seq}` });
      },
      async count({ where }: { where: { invoiceId: string } }) {
        return lines.filter((l) => l.invoiceId === where.invoiceId).length;
      },
    },
    invoiceCounter: {
      async upsert({ where }: { where: { year: number } }) {
        const counter = counters.find((c) => c.year === where.year);
        if (counter) counter.last += 1;
        else counters.push({ year: where.year, last: 1 });
        return counters.find((c) => c.year === where.year)!;
      },
    },
    payment: {
      async findMany({ where }: { where: { invoiceId: string } }) {
        return payments.filter((p) => p.invoiceId === where.invoiceId);
      },
      async findUnique({ where }: { where: { id: string } }) {
        const row = payments.find((p) => p.id === where.id);
        return row ? { ...row, invoice: full(invoices.find((i) => i.id === row.invoiceId)!) } : null;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const row: Row = { signedAt: null, signedObjectKey: null, ...data, id: `pay_${++seq}`, createdAt: now() };
        payments.push(row);
        return { id: row.id };
      },
      async updateMany({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) {
        const hit = payments.filter((p) => matches(p, where));
        for (const p of hit) Object.assign(p, data);
        return { count: hit.length };
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        return Object.assign(payments.find((p) => p.id === where.id)!, data);
      },
    },
    receiptCounter: {
      async upsert({ where }: { where: { year: number } }) {
        const counter = receiptCounters.find((c) => c.year === where.year);
        if (counter) counter.last += 1;
        else receiptCounters.push({ year: where.year, last: 1 });
        return receiptCounters.find((c) => c.year === where.year)!;
      },
    },
    paymentProof: {
      async create({ data }: { data: Record<string, unknown> }) {
        const row = { ...data, id: `proof_${++seq}`, createdAt: now() };
        proofs.push(row);
        return { id: row.id };
      },
    },
  } as Record<string, unknown>;
  prisma.$transaction = (fn: (tx: unknown) => Promise<unknown>) => fn(prisma);
  return { prisma: prisma as unknown as TRPCContext['prisma'], invoices, lines, proofs, payments };
}

const asConsultant = sessionFor({ id: 'acc_stanzy', name: 'Stanzy', role: 'CONSULTANT' });
const asAminata = sessionFor();
const asBob = sessionFor({ id: 'acc_2', name: 'Bob Other', email: 'bob@example.com' });

let db: ReturnType<typeof fakeDatabase>;
const as = (session: CurrentSession) => createCaller({ prisma: db.prisma, headers: new Headers(), session }).invoices;

const draft = {
  dossierId: 'dos_1',
  currency: 'XAF' as const,
  dueDate: new Date('2026-11-15T00:00:00Z'),
  notes: 'Orange Money',
  lines: [
    { description: 'Acompte', quantity: 1, unitAmount: 90000 },
    { description: 'Traduction', quantity: 2, unitAmount: 7500 },
  ],
};

const payment = (invoiceId: string, amount: number, extra: Record<string, unknown> = {}) => ({
  invoiceId,
  amount,
  receivedOn: '2026-10-31',
  method: 'CASH' as const,
  methodNote: null,
  ...extra,
});
const proof = (invoiceId: string, extra: Record<string, unknown> = {}) => ({
  invoiceId,
  objectKey: `invoices/${invoiceId}/9a2b.bin`,
  key: 'ZmVkY2JhOTg3NjU0MzIxMGZlZGNiYTk4NzY1NDMyMTA=',
  iv: 'B'.repeat(16),
  fileName: 'recu-momo.jpg',
  contentType: 'image/jpeg' as const,
  size: 2000,
  ...extra,
});

beforeEach(() => {
  // Numbers carry the year and « En retard » depends on today.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-31T10:00:00Z'));
  db = fakeDatabase();
  vi.clearAllMocks();
  storage.objectSize.mockResolvedValue(2016);
});

afterEach(() => {
  vi.useRealTimers();
});

async function sent() {
  const { id } = await as(asConsultant).dashboard.save(draft);
  await as(asConsultant).dashboard.send({ id });
  return id;
}

describe('writing and sending a Facture', () => {
  it('numbers invoices in order when they are sent, never as drafts', async () => {
    const first = await as(asConsultant).dashboard.save(draft);
    const second = await as(asConsultant).dashboard.save(draft);
    expect(db.invoices.every((i) => i.number === null)).toBe(true);

    expect(await as(asConsultant).dashboard.send({ id: second.id })).toEqual({ number: 'STZ-2026-0001' });
    expect(await as(asConsultant).dashboard.send({ id: first.id })).toEqual({ number: 'STZ-2026-0002' });
    expect(notify.notifyInvoiceSent).toHaveBeenCalledWith(
      expect.objectContaining({ number: 'STZ-2026-0001', status: 'SENT' }),
    );
    expect(notifications.notifyLater).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: 'INVOICE_SENT', recipients: ['acc_1'] }),
    );
  });

  it('replaces a draft’s lines when it is saved again, and freezes it once sent', async () => {
    const { id } = await as(asConsultant).dashboard.save(draft);
    await as(asConsultant).dashboard.save({
      ...draft,
      id,
      lines: [{ description: 'Solde', quantity: 1, unitAmount: 60000 }],
    });
    expect(db.lines.filter((l) => l.invoiceId === id).map((l) => l.description)).toEqual(['Solde']);

    await as(asConsultant).dashboard.send({ id });
    await expect(as(asConsultant).dashboard.save({ ...draft, id })).rejects.toMatchObject({
      message: 'INVOICE_NOT_DRAFT',
    });
    await expect(as(asConsultant).dashboard.deleteDraft({ id })).rejects.toMatchObject({
      message: 'INVOICE_NOT_DRAFT',
    });
  });

  it('won’t send an invoice for nothing', async () => {
    const { id } = await as(asConsultant).dashboard.save({
      ...draft,
      lines: [{ description: 'Offert', quantity: 1, unitAmount: 0 }],
    });
    await expect(as(asConsultant).dashboard.send({ id })).rejects.toMatchObject({ message: 'INVOICE_EMPTY' });
  });

  it('lists the overdue ones apart', async () => {
    const id = await sent();
    const late = await as(asConsultant).dashboard.save({ ...draft, dueDate: new Date('2026-10-01T00:00:00Z') });
    await as(asConsultant).dashboard.send({ id: late.id });
    const overdue = await as(asConsultant).dashboard.list({ filter: 'OVERDUE' });
    expect(overdue.map((i) => i.id)).toEqual([late.id]);
    expect((await as(asConsultant).dashboard.list({ filter: 'AWAITING' })).map((i) => i.id).sort()).toEqual(
      [id, late.id].sort(),
    );
  });

  it('keeps billing to the consultant', async () => {
    await expect(as(asAminata).dashboard.save(draft)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('the Client’s Factures', () => {
  it('sees the sent ones with their total, never the drafts', async () => {
    const id = await sent();
    await as(asConsultant).dashboard.save(draft);
    const mine = await as(asAminata).forDossier({ dossierId: 'dos_1' });
    expect(mine.map((i) => i.id)).toEqual([id]);
    expect(mine[0]).toMatchObject({ number: 'STZ-2026-0001', total: 105000 });
    expect(mine[0]!.dossier.account).toEqual({ name: 'Aminata Diallo', email: 'aminata@example.com' });

    await expect(as(asBob).forDossier({ dossierId: 'dos_1' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('uploads a Preuve de paiement: « Preuve reçue », and the consultant is told', async () => {
    const id = await sent();
    await as(asAminata).addProof(proof(id));
    expect(db.invoices[0]).toMatchObject({ status: 'PROOF_RECEIVED' });
    expect(db.proofs[0]).toMatchObject({ objectKey: `invoices/${id}/9a2b.bin`, uploadedById: 'acc_1' });
    expect(notify.notifyProofReceived).toHaveBeenCalledOnce();
  });

  it('refuses a proof for a draft, outside the invoice’s folder, or of the wrong size', async () => {
    const { id: draftId } = await as(asConsultant).dashboard.save(draft);
    await expect(as(asAminata).addProof(proof(draftId))).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const id = await sent();
    await expect(as(asAminata).addProof(proof(id, { objectKey: proof(draftId).objectKey }))).rejects.toMatchObject({
      message: 'DOCUMENT_FILE_INVALID',
    });
    storage.objectSize.mockResolvedValue(99);
    await expect(as(asAminata).addProof(proof(id))).rejects.toMatchObject({ message: 'DOCUMENT_FILE_INVALID' });
    expect(db.proofs).toHaveLength(0);
  });
});

describe('closing a Facture', () => {
  it('is Payée once its total is received, and thanks the Client; after that it takes no proof', async () => {
    const id = await sent();
    await as(asAminata).addProof(proof(id));
    await as(asConsultant).payments.record(payment(id, 105000));
    expect(db.invoices[0]).toMatchObject({ status: 'PAID', paidAt: expect.any(Date) });
    expect(notify.notifyInvoicePaid).toHaveBeenCalledOnce();
    expect(notifications.notifyLater).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: 'INVOICE_PAID' }));
    await expect(as(asAminata).addProof(proof(id))).rejects.toMatchObject({ message: 'INVOICE_NOT_PAYABLE' });
  });

  it('cancels with a reason, but not twice', async () => {
    const id = await sent();
    await as(asConsultant).dashboard.cancel({ id, reason: 'Erreur de montant' });
    expect(db.invoices[0]).toMatchObject({ status: 'CANCELLED', cancelReason: 'Erreur de montant' });
    await expect(as(asConsultant).dashboard.cancel({ id, reason: 'Encore' })).rejects.toMatchObject({
      message: 'INVOICE_NOT_PAYABLE',
    });
  });
});

describe('Paiements and their Reconnaissance de réception de fonds (#145)', () => {
  it('records a part payment: « Partiellement payée », a numbered Reconnaissance, signed and stamped, for the Client to sign', async () => {
    const id = await sent();
    await as(asConsultant).payments.record(payment(id, 50000));
    expect(db.invoices[0]).toMatchObject({ status: 'PARTIALLY_PAID', paidAt: null });
    expect(db.payments).toEqual([
      expect.objectContaining({ invoiceId: id, amount: 50000, method: 'CASH', receiptNumber: 'REC-2026-0001', fingerprint: 'f1ng3r' }),
    ]);
    expect(receipts.receiptPdf).toHaveBeenCalledWith(
      expect.objectContaining({ number: 'REC-2026-0001', amount: 50000, total: 105000, balance: 55000, consultant: expect.anything() }),
    );
    expect(notifications.notifyLater).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: 'RECEIPT_SENT', recipients: ['acc_1'], target: { dossierId: 'dos_1', invoiceId: id } }),
    );
    expect(notify.notifyInvoicePaid).not.toHaveBeenCalled();
    // The next one is numbered after it and can't go past the balance.
    await expect(as(asConsultant).payments.record(payment(id, 60000))).rejects.toMatchObject({ message: 'PAYMENT_TOO_HIGH' });
    await as(asConsultant).payments.record(payment(id, 55000, { method: 'OTHER', methodNote: 'Western Union' }));
    expect(db.payments[1]).toMatchObject({ receiptNumber: 'REC-2026-0002', methodNote: 'Western Union' });
    expect(db.invoices[0]).toMatchObject({ status: 'PAID' });
  });

  it('is recorded by the consultant only, a justificatif attached to it', async () => {
    const id = await sent();
    await expect(as(asAminata).payments.record(payment(id, 1000))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await as(asConsultant).payments.record(payment(id, 1000, { proof: proof(id, { fileName: 'recu-especes.jpg' }) }));
    expect(db.proofs).toEqual([expect.objectContaining({ paymentId: db.payments[0]!.id, fileName: 'recu-especes.jpg', uploadedById: 'acc_stanzy' })]);
    // A justificatif doesn't make it « Preuve reçue »: it stays as the payment left it.
    expect(db.invoices[0]).toMatchObject({ status: 'PARTIALLY_PAID' });
  });

  it('is signed by its Client only, once, and the consultant is told', async () => {
    const id = await sent();
    await as(asConsultant).payments.record(payment(id, 1000));
    const paymentId = db.payments[0]!.id;
    const signature = { id: paymentId, name: 'Aminata Diallo', signature: 'data:image/png;base64,iVBORw0KGgo=', accepted: true as const };
    await expect(as(asBob).payments.sign(signature)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(as(asConsultant).payments.sign(signature)).rejects.toMatchObject({ message: 'RECEIPT_NOT_YOURS' });
    await as(asAminata).payments.sign(signature);
    expect(db.payments[0]).toMatchObject({ signedName: 'Aminata Diallo', signedById: 'acc_1', signedObjectKey: expect.any(String) });
    expect(notifications.notifyLater).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: 'RECEIPT_SIGNED', recipients: 'CONSULTANTS' }),
    );
    await expect(as(asAminata).payments.sign(signature)).rejects.toMatchObject({ message: 'RECEIPT_NOT_PENDING' });
  });
});

describe('draft lines from other services', () => {
  it('adds to the Dossier’s draft, opening one when there is none', async () => {
    const first = await addDraftInvoiceLine(db.prisma, 'dos_1', {
      description: 'Certificat de police',
      quantity: 1,
      unitAmount: 5000,
    });
    const second = await addDraftInvoiceLine(db.prisma, 'dos_1', {
      description: 'Attestation CNPS',
      quantity: 1,
      unitAmount: 6000,
    });
    expect(second.invoiceId).toBe(first.invoiceId);
    expect(db.lines.map((l) => [l.description, l.position])).toEqual([
      ['Certificat de police', 0],
      ['Attestation CNPS', 1],
    ]);
  });
});
