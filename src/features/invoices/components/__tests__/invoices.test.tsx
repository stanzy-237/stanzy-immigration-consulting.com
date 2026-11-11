// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { DossierInvoices } from '@/features/invoices/components/dossier-invoices';
import { InvoiceForm, type InvoiceDraft } from '@/features/invoices/components/invoice-form';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/**
 * Seam: the invoice form as the consultant fills it, and a Dossier's Factures
 * as the Client and the consultant read them. Stubs answer and record the
 * calls; the browser-side encryption and Blob upload are stubbed.
 */
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => router,
}));

const urls = vi.hoisted(() => ({
  invoicePdfUrl: (id: string) => `/api/invoices/${id}/pdf`,
  proofFileUrl: (id: string) => `/api/invoices/proofs/${id}`,
  receiptFileUrl: (id: string) => `/api/invoices/receipts/${id}`,
  uploadProofFile: vi.fn(),
}));
vi.mock('@/features/invoices/lib/invoice-urls', () => urls);

const api = vi.hoisted(() => ({ save: vi.fn(), send: vi.fn(), addProof: vi.fn(), record: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  api.save.mockImplementation((input: { id?: string }) => ({ id: input.id ?? 'inv_9' }));
  api.send.mockReturnValue({ number: 'STZ-2026-0001' });
  api.addProof.mockReturnValue({ id: 'proof_1' });
  api.record.mockReturnValue({ id: 'pay_2', number: 'REC-2026-0002', status: 'PAID' });
});

const dossier = {
  id: 'dos_1',
  service: 'ACCOMPAGNEMENT' as const,
  account: { name: 'Aminata Diallo', email: 'aminata@example.com' },
};

function form(draft: Partial<InvoiceDraft> = {}) {
  const { wrap } = createTestTRPC({
    'invoices.dashboard.save': (input) => api.save(input),
    'invoices.dashboard.send': (input) => api.send(input),
    'invoices.dashboard.searchDossiers': () => [dossier],
  });
  return render(
    withIntl(
      wrap(<InvoiceForm draft={{ dossier, currency: 'XAF', dueDate: null, notes: null, lines: [], ...draft }} />),
    ),
  );
}

const fillLine = (description: string, price: string) => {
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: description } });
  fireEvent.change(screen.getByLabelText('Prix unitaire'), { target: { value: price } });
};

describe('InvoiceForm', () => {
  it('saves a new draft in the currency’s minor unit, then opens it', async () => {
    const { container } = form();
    fillLine('Acompte', '90 000');
    fireEvent.change(screen.getByLabelText('Quantité'), { target: { value: '2' } });
    expect(screen.getByText('180 000 FCFA')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith({
        dossierId: 'dos_1',
        currency: 'XAF',
        dueDate: null,
        notes: '',
        lines: [{ description: 'Acompte', quantity: 2, unitAmount: 90000 }],
      }),
    );
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/factures/inv_9'));
    expect(await axe(container)).toHaveNoViolations();
  }, 30_000);

  it('reads cents for an invoice in Canadian dollars', async () => {
    form();
    fireEvent.change(screen.getByLabelText('Devise'), { target: { value: 'CAD' } });
    fillLine('Frais de dossier', '1250,50');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'CAD',
          lines: [{ description: 'Frais de dossier', quantity: 1, unitAmount: 125050 }],
        }),
      ),
    );
  });

  it('says what is missing instead of saving', async () => {
    form({ dossier: null });
    fireEvent.change(screen.getByLabelText('Prix unitaire'), { target: { value: 'beaucoup' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(await screen.findByText('Choisissez un dossier.')).toBeInTheDocument();
    expect(screen.getByText('Chaque ligne a une description, une quantité et un prix valides.')).toBeInTheDocument();
    expect(api.save).not.toHaveBeenCalled();
  });

  it('saves, then sends once confirmed', async () => {
    form({ id: 'inv_1', lines: [{ description: 'Solde', quantity: 1, unitAmount: 60000 }] });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer au Client' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => expect(api.send).toHaveBeenCalledWith({ id: 'inv_1' }));
    expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'inv_1' }));
    expect(await screen.findByText('Facture STZ-2026-0001 envoyée')).toBeInTheDocument();
  });
});

const invoice = (extra: Record<string, unknown> = {}) => ({
  id: 'inv_1',
  number: 'STZ-2026-0001',
  status: 'SENT' as const,
  currency: 'XAF' as const,
  dueDate: new Date('2099-11-15T00:00:00Z'),
  notes: null,
  sentAt: new Date('2026-10-31T10:00:00Z'),
  paidAt: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: new Date('2026-10-31T10:00:00Z'),
  lines: [{ description: 'Acompte', quantity: 1, unitAmount: 90000 }],
  total: 90000,
  dossier,
  proofs: [],
  payments: [] as unknown[],
  received: 0,
  ...extra,
});

const payment = (extra: Record<string, unknown> = {}) => ({
  id: 'pay_1',
  amount: 40000,
  receivedOn: '2026-11-02',
  method: 'CASH' as const,
  methodNote: null,
  receiptNumber: 'REC-2026-0001',
  signedAt: null,
  signedName: null,
  proofs: [{ id: 'proof_9', fileName: 'especes.jpg' }],
  ...extra,
});

function dossierInvoices(viewer: 'consultant' | 'client', invoices = [invoice()]) {
  const { trpc, queryClient, wrap } = createTestTRPC({
    'invoices.forDossier': () => invoices,
    'invoices.addProof': (input) => api.addProof(input),
    'invoices.payments.record': (input) => api.record(input),
  });
  queryClient.setQueryData(trpc.invoices.forDossier.queryKey({ dossierId: 'dos_1' }), invoices as never);
  return render(withIntl(wrap(<DossierInvoices dossierId="dos_1" viewer={viewer} />)));
}

describe('DossierInvoices', () => {
  it('lets the Client open the PDF and send a Preuve de paiement', async () => {
    urls.uploadProofFile.mockResolvedValue({
      objectKey: 'dossiers/dos_1/x.bin',
      key: 'k',
      iv: 'i',
      fileName: 'recu.jpg',
      contentType: 'image/jpeg',
      size: 10,
    });
    const { container } = dossierInvoices('client');
    expect(screen.getByText('90 000 FCFA', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir le PDF de la facture STZ-2026-0001' })).toHaveAttribute(
      'href',
      '/api/invoices/inv_1/pdf',
    );
    expect(await axe(container)).toHaveNoViolations();

    const file = new File(['x'], 'recu.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Téléverser une preuve de paiement pour la facture STZ-2026-0001'), {
      target: { files: [file] },
    });
    await waitFor(() => expect(urls.uploadProofFile).toHaveBeenCalledWith('inv_1', file));
    await waitFor(() => expect(api.addProof).toHaveBeenCalledWith(expect.objectContaining({ invoiceId: 'inv_1' })));
    expect(await screen.findByText('Preuve de paiement envoyée')).toBeInTheDocument();
  }, 30_000);

  it('asks for nothing more once paid', () => {
    dossierInvoices('client', [invoice({ status: 'PAID' })]);
    expect(screen.getByText('Payée')).toBeInTheDocument();
    expect(screen.queryByText('Téléverser une preuve de paiement')).not.toBeInTheDocument();
  });

  it('gives the consultant a new invoice for this Dossier, and drafts by name', () => {
    dossierInvoices('consultant', [invoice({ number: null, status: 'DRAFT', sentAt: null })]);
    expect(screen.getByRole('link', { name: 'Nouvelle facture' })).toHaveAttribute(
      'href',
      '/factures/nouvelle?dossier=dos_1',
    );
    expect(screen.getByRole('link', { name: 'Brouillon' })).toHaveAttribute('href', '/factures/inv_1');
    expect(screen.queryByText('Téléverser une preuve de paiement')).not.toBeInTheDocument();
  });

  it('shows the Client a part payment, its justificatif, and the Reconnaissance to sign', async () => {
    const { container } = dossierInvoices('client', [
      invoice({ status: 'PARTIALLY_PAID', payments: [payment()], received: 40000 }),
    ]);
    expect(screen.getByText('Partiellement payée')).toBeInTheDocument();
    expect(screen.getByText('Reçu 40 000 FCFA sur 90 000 FCFA · reste 50 000 FCFA')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Signer la reconnaissance REC-2026-0001' })).toHaveAttribute(
      'href',
      '/fr/mon-espace/dossiers/dos_1/recus/pay_1',
    );
    expect(screen.getByRole('link', { name: /Justificatif · especes.jpg/ })).toHaveAttribute(
      'href',
      '/api/invoices/proofs/proof_9',
    );
    expect(screen.getByText('Téléverser une preuve de paiement')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  }, 30_000);

  it('shows a signed Reconnaissance without asking again', () => {
    const signed = payment({ signedAt: new Date('2026-11-03T10:00:00Z'), signedName: 'Aminata Diallo' });
    dossierInvoices('client', [invoice({ status: 'PAID', payments: [signed], received: 90000 })]);
    expect(screen.getByText('Signée par Aminata Diallo le 3 novembre 2026')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Signer la reconnaissance/ })).not.toBeInTheDocument();
  });

  it('lets the consultant record the rest, asking what « Autre » means', async () => {
    dossierInvoices('consultant', [invoice({ status: 'PARTIALLY_PAID', payments: [payment()], received: 40000 })]);
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer un paiement' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByLabelText('Montant reçu')).toHaveValue('50000');

    fireEvent.change(within(dialog).getByLabelText('Montant reçu'), { target: { value: '60000' } });
    fireEvent.change(within(dialog).getByLabelText('Moyen de paiement'), { target: { value: 'OTHER' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect(await within(dialog).findByText('Indiquez un montant entre 1 et 50 000 FCFA.')).toBeInTheDocument();
    expect(within(dialog).getByText('Précisez le moyen de paiement.')).toBeInTheDocument();
    expect(api.record).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText('Montant reçu'), { target: { value: '50 000' } });
    fireEvent.change(within(dialog).getByLabelText('Précisez le moyen'), { target: { value: 'Western Union' } });
    fireEvent.change(within(dialog).getByLabelText('Reçu le'), { target: { value: '2026-11-04' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(api.record).toHaveBeenCalledWith({
        invoiceId: 'inv_1',
        amount: 50000,
        receivedOn: '2026-11-04',
        method: 'OTHER',
        methodNote: 'Western Union',
        proof: undefined,
      }),
    );
    expect(await screen.findByText('Paiement enregistré : reconnaissance REC-2026-0002 envoyée')).toBeInTheDocument();
  }, 30_000);
});
