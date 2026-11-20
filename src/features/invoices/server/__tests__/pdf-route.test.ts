import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionFor } from '@/server/auth/__tests__/fixtures';

/** Seam: the Facture PDF route, its session, access and rendering stubbed (#161: « Facture ouverte »). */
const seams = vi.hoisted(() => ({
  session: vi.fn(),
  trackLater: vi.fn(),
  invoice: { id: 'inv_1', number: 'STZ-2026-0001', sentAt: new Date(), status: 'SENT', dossier: { service: 'ACCOMPAGNEMENT' } },
}));
vi.mock('@/server/auth/session', () => ({ getCurrentSession: seams.session }));
vi.mock('@/server/analytics', () => ({ trackLater: seams.trackLater }));
vi.mock('@/server/db/client', () => ({ prisma: {} }));
vi.mock('@/features/invoices/server/invoice-access', () => ({ invoiceFor: async () => seams.invoice }));
vi.mock('@/features/invoices/server/service-balance', () => ({ printedBalance: async () => null }));
vi.mock('@/features/invoices/server/invoice-document', () => ({ invoicePdf: async () => new Uint8Array([37, 80, 68, 70]) }));
vi.mock('@/features/signatures/server/signing-assets', () => ({ openSigningAssets: async () => null }));

import { GET } from '@/features/invoices/server/pdf-route';

beforeEach(() => vi.clearAllMocks());

const open = () => GET(new Request('https://site.com/api/invoices/inv_1/pdf'), { params: Promise.resolve({ id: 'inv_1' }) });

describe('opening a Facture (#161)', () => {
  it('counts the Client opening it, by service only', async () => {
    seams.session.mockResolvedValue(sessionFor());
    expect((await open()).status).toBe(200);
    expect(seams.trackLater).toHaveBeenCalledWith(expect.any(Headers), 'invoice.opened', { service: 'ACCOMPAGNEMENT' });
  });

  it('doesn’t count the consultant’s own views', async () => {
    seams.session.mockResolvedValue(sessionFor({ id: 'acc_stanzy', role: 'CONSULTANT' }));
    expect((await open()).status).toBe(200);
    expect(seams.trackLater).not.toHaveBeenCalled();
  });
});
