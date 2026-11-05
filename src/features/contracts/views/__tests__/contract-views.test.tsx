// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { ContractSignView } from '@/features/contracts/views/contract-sign-view';
import { ContractTemplatesView } from '@/features/contracts/views/contract-templates-view';
import { DossierContractsView } from '@/features/contracts/views/dossier-contracts-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/**
 * Seam: the Contrat screens with their data in the cache, as the routes
 * prefetch it. pdf.js and the drawing canvas are stubbed.
 */
vi.mock('@/features/shared/hooks/use-pdf-pages', () => ({
  usePdfPages: () => ({ pages: [{ src: 'data:image/jpeg;base64,AA==', width: 595, height: 842 }], total: 1, failed: false }),
}));
vi.mock('@/features/shared/components/signing/signature-pad', () => ({
  SignaturePad: ({ ink, onChange }: { ink: string; onChange: (png: string | null) => void }) => (
    <button type="button" onClick={() => onChange(`data:image/png;base64,${ink}`)}>
      draw
    </button>
  ),
}));
vi.mock('@/features/landing/components/site-nav', () => ({ SiteNav: () => null }));
vi.mock('@/features/landing/components/site-footer', () => ({ SiteFooter: () => null }));
const router = vi.hoisted(() => ({ push: vi.fn() }));
const search = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => search.params }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={`/fr${href}`} {...props}>
      {children}
    </a>
  ),
  useRouter: () => router,
}));

beforeEach(() => {
  vi.clearAllMocks();
  search.params = new URLSearchParams();
});

const contract = (extra: Record<string, unknown> = {}) => ({
  id: 'ctr_1',
  number: 'CTR-2026-0001',
  title: 'Contrat de prestation de services',
  status: 'SENT',
  parentId: null,
  amount: 500_000,
  currency: 'XAF',
  schedule: '50 % à la signature',
  sentAt: new Date('2026-11-04T09:00:00Z'),
  signedAt: null,
  signedName: null,
  cancelledAt: null,
  cancelReason: null,
  ...extra,
});

function panel(viewer: 'consultant' | 'client', data: unknown, handlers: Record<string, (input: never) => unknown> = {}) {
  const { trpc, queryClient, wrap } = createTestTRPC({ 'contracts.forDossier': () => data, ...handlers });
  queryClient.setQueryData(trpc.contracts.forDossier.queryKey({ dossierId: 'dos_1' }), data as never);
  return render(withIntl(wrap(<DossierContractsView dossierId="dos_1" viewer={viewer} />)));
}

describe('the Contrat panel, for the consultant', () => {
  it('sends the Contrat: language, price and échéancier', async () => {
    const send = vi.fn();
    const { container } = panel(
      'consultant',
      { open: true, locale: 'en', signed: false, contracts: [] },
      { 'contracts.send': (input) => send(input) ?? { id: 'ctr_9', number: 'CTR-2026-0009' } },
    );
    expect(screen.getByText('Contrat non signé')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le contrat' }));
    const dialog = screen.getByRole('dialog');
    // The Client's language first.
    expect(within(dialog).getByLabelText('Langue')).toHaveValue('en');
    fireEvent.change(within(dialog).getByLabelText('Prix'), { target: { value: 'beaucoup' } });
    fireEvent.change(within(dialog).getByLabelText('Échéancier'), { target: { value: '50 % à la signature' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Envoyer au client' }));
    expect(within(dialog).getByText('Indiquez un montant valide.')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Prix'), { target: { value: '500 000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Envoyer au client' }));
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith({
        dossierId: 'dos_1',
        locale: 'en',
        amount: 500_000,
        currency: 'XAF',
        schedule: '50 % à la signature',
      }),
    );
    expect(await screen.findByText('CTR-2026-0009 envoyé au client')).toBeInTheDocument();
  }, 30_000);

  it('opens « Envoyer le contrat » at once when coming from an approved Demande', () => {
    search.params = new URLSearchParams('onglet=facturation&contrat=nouveau');
    panel('consultant', { open: true, locale: 'fr', signed: false, contracts: [] });
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Envoyer au client' })).toBeInTheDocument();
  });

  it('opens nothing on its own once a Contrat is out', () => {
    search.params = new URLSearchParams('contrat=nouveau');
    panel('consultant', { open: true, locale: 'fr', signed: false, contracts: [contract()] });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancels one not signed yet, and offers an Avenant once signed', async () => {
    const cancel = vi.fn();
    panel(
      'consultant',
      { open: true, locale: 'fr', signed: false, contracts: [contract()] },
      { 'contracts.cancel': (input) => cancel(input) },
    );
    expect(screen.queryByRole('button', { name: 'Envoyer le contrat' })).not.toBeInTheDocument();
    expect(screen.getByText('500 000 FCFA · 50 % à la signature · Envoyé le 4 novembre 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler CTR-2026-0001' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.change(within(dialog).getByLabelText('Motif (facultatif)'), { target: { value: 'Mauvais prix' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler le contrat' }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith({ id: 'ctr_1', reason: 'Mauvais prix' }));
  });

  it('sends an Avenant to a signed Contrat', async () => {
    const amend = vi.fn();
    const signed = contract({ status: 'SIGNED', signedAt: new Date('2026-11-05T09:00:00Z'), signedName: 'Aminata Diallo' });
    panel(
      'consultant',
      { open: true, locale: 'fr', signed: true, contracts: [signed] },
      { 'contracts.sendAmendment': (input) => amend(input) ?? { id: 'ctr_2', number: 'CTR-2026-0001-A1' } },
    );
    expect(screen.getByText('Contrat signé')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ouvrir le PDF signé de CTR-2026-0001' })).toHaveAttribute(
      'href',
      '/api/contracts/ctr_1/pdf',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer un avenant' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Titre'), { target: { value: 'Avenant : conjoint' } });
    fireEvent.change(within(dialog).getByLabelText(/^Texte/), { target: { value: 'Le conjoint est ajouté au dossier.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Envoyer l’avenant' }));
    await waitFor(() =>
      expect(amend).toHaveBeenCalledWith({
        contractId: 'ctr_1',
        title: 'Avenant : conjoint',
        body: 'Le conjoint est ajouté au dossier.',
      }),
    );
  });
});

describe('the Contrat panel, for the Client', () => {
  it('asks them to sign the Contrat waiting', () => {
    panel('client', { open: true, locale: 'fr', signed: false, contracts: [contract()] });
    expect(screen.getByText('Le contrat CTR-2026-0001 attend votre signature.')).toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: 'Signer CTR-2026-0001' })) {
      expect(link).toHaveAttribute('href', '/fr/mon-espace/dossiers/dos_1/contrats/ctr_1');
    }
    expect(screen.queryByRole('button', { name: /Annuler/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Contrat non signé')).not.toBeInTheDocument();
  });
});

describe('signing a Contrat', () => {
  it('fills the fields of the signature block and signs', async () => {
    const sign = vi.fn();
    const data = {
      id: 'ctr_1',
      number: 'CTR-2026-0001',
      title: 'Contrat de prestation de services',
      status: 'SENT',
      fields: [
        { kind: 'SIGNATURE', page: 0, x: 0.08, y: 0.7, width: 0.37, height: 0.07 },
        { kind: 'NAME', page: 0, x: 0.08, y: 0.8, width: 0.37, height: 0.02 },
        { kind: 'DATE', page: 0, x: 0.08, y: 0.86, width: 0.37, height: 0.02 },
      ],
      signedAt: null,
      dossier: { id: 'dos_1' },
      signerName: 'Aminata Diallo',
      canSign: true,
    };
    const { trpc, queryClient, wrap } = createTestTRPC({
      'contracts.get': () => data,
      'contracts.sign': (input) => sign(input),
    });
    queryClient.setQueryData(trpc.contracts.get.queryKey({ id: 'ctr_1' }), data as never);
    render(withIntl(wrap(<ContractSignView dossierId="dos_1" contractId="ctr_1" />)));

    fireEvent.click(screen.getByRole('button', { name: 'Signer ici' }));
    fireEvent.click(screen.getByRole('button', { name: 'draw' }));
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Votre nom' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Appliquer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Date' }));
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }));
    const confirm = screen.getByRole('alertdialog');
    fireEvent.click(within(confirm).getByRole('checkbox'));
    fireEvent.click(within(confirm).getByRole('button', { name: 'Signer le document' }));
    await waitFor(() =>
      expect(sign).toHaveBeenCalledWith({
        id: 'ctr_1',
        name: 'Aminata Diallo',
        signature: 'data:image/png;base64,blue',
        accepted: true,
      }),
    );
    expect(await screen.findByText('Contrat signé')).toBeInTheDocument();
    expect(router.push).toHaveBeenCalledWith('/mon-espace/dossiers/dos_1#contrats');
  });
});

describe('the templates', () => {
  it('writes one per service and language, with the blanks inserted and odd ones pointed out', async () => {
    const save = vi.fn();
    const templates = [
      { id: 't1', service: 'ACCOMPAGNEMENT', locale: 'fr', title: 'Contrat', body: 'Entre {client} et Stanzy.', updatedAt: new Date('2026-11-01T09:00:00Z') },
    ];
    const { trpc, queryClient, wrap } = createTestTRPC({
      'contracts.templates.list': () => templates,
      'contracts.templates.save': (input) => save(input) ?? { id: 't2' },
    });
    queryClient.setQueryData(trpc.contracts.templates.list.queryKey(), templates as never);
    const { container } = render(withIntl(wrap(<ContractTemplatesView />)));
    expect(screen.getByLabelText(/^Texte/)).toHaveValue('Entre {client} et Stanzy.');
    expect(await axe(container)).toHaveNoViolations();

    // Another service: its own (empty) template.
    fireEvent.click(screen.getByRole('radio', { name: /Entrée Express \(EDE\)|EDE/ }));
    expect(screen.getByText('Pas encore de modèle')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Titre du contrat'), { target: { value: 'Contrat EDE' } });
    fireEvent.change(screen.getByLabelText(/^Texte/), { target: { value: 'Le prix est de ' } });
    fireEvent.click(screen.getByRole('button', { name: /\{prix\}/ }));
    fireEvent.change(screen.getByLabelText(/^Texte/), {
      target: { value: `${(screen.getByLabelText(/^Texte/) as HTMLTextAreaElement).value}, pour {clinet}.` },
    });
    expect(screen.getByText('Blancs inconnus, laissés tels quels : {clinet}')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        service: 'EDE',
        locale: 'fr',
        title: 'Contrat EDE',
        body: 'Le prix est de {prix}, pour {clinet}.',
      }),
    );
  }, 30_000);
});
