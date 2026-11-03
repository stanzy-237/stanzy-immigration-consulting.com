// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { SignatureRequestNewView } from '@/features/signatures/views/signature-request-new-view';
import { SignView } from '@/features/signatures/views/sign-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/**
 * Seam: the two screens of a Demande de signature, with the data in the cache
 * as the routes prefetch it. pdf.js and the drawing canvas are stubbed: the
 * PDF has two drawn pages, and « drawing » hands over a PNG.
 */
vi.mock('@/features/signatures/hooks/use-pdf-pages', () => ({
  usePdfPages: () => ({
    pages: [
      { src: 'data:image/jpeg;base64,AA==', width: 595, height: 842 },
      { src: 'data:image/jpeg;base64,AA==', width: 595, height: 842 },
    ],
    total: 2,
    failed: false,
  }),
}));
vi.mock('@/features/signatures/components/signature-pad', () => ({
  SignaturePad: ({ onChange }: { onChange: (png: string | null) => void }) => (
    <button type="button" onClick={() => onChange('data:image/png;base64,AAAA')}>
      draw
    </button>
  ),
}));
vi.mock('@/features/landing/components/site-nav', () => ({ SiteNav: () => null }));
vi.mock('@/features/landing/components/site-footer', () => ({ SiteFooter: () => null }));

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={`/fr${href}`} {...props}>
      {children}
    </a>
  ),
  useRouter: () => router,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(search.value),
}));
const search = vi.hoisted(() => ({ value: '' }));

beforeEach(() => {
  vi.clearAllMocks();
  search.value = '';
});

const request = (extra: Record<string, unknown> = {}) => ({
  id: 'sig_1',
  status: 'PENDING',
  fields: [
    { kind: 'SIGNATURE', page: 0, x: 0.1, y: 0.8, width: 0.3, height: 0.07 },
    { kind: 'DATE', page: 1, x: 0.6, y: 0.9, width: 0.2, height: 0.03 },
  ],
  versionId: 'ver_2',
  fileName: 'lettre.pdf',
  createdAt: new Date('2026-11-04T09:00:00Z'),
  signedAt: null,
  signedName: null,
  document: { id: 'doc_1', title: 'Lettre explicative', section: 'Lettres' },
  dossier: { id: 'dos_1', service: 'ACCOMPAGNEMENT', open: true },
  canSign: true,
  ...extra,
});

function signView(data = request(), handlers: Record<string, (input: never) => unknown> = {}) {
  const { trpc, queryClient, wrap } = createTestTRPC({ 'signatures.get': () => data, ...handlers });
  queryClient.setQueryData(trpc.signatures.get.queryKey({ id: 'sig_1' }), data as never);
  return render(withIntl(wrap(<SignView dossierId="dos_1" requestId="sig_1" />)));
}

describe('SignView, for the Client', () => {
  it('shows where each field goes and signs once accepted, named and drawn', async () => {
    const sign = vi.fn();
    const { container } = signView(request(), { 'signatures.sign': (input) => sign(input) });
    expect(screen.getByRole('heading', { name: 'Signer « Lettre explicative »' })).toBeInTheDocument();
    expect(screen.getByText('Signature ici')).toBeInTheDocument();
    expect(screen.getByText('Date ici')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.change(screen.getByLabelText('Votre nom complet'), { target: { value: 'Aminata Diallo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Signer le document' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Cochez « J’ai lu… » pour signer.');

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Signer le document' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Tracez votre signature dans le cadre.');

    fireEvent.click(screen.getByRole('button', { name: 'draw' }));
    fireEvent.click(screen.getByRole('button', { name: 'Signer le document' }));
    await waitFor(() =>
      expect(sign).toHaveBeenCalledWith({
        id: 'sig_1',
        name: 'Aminata Diallo',
        signature: 'data:image/png;base64,AAAA',
        accepted: true,
      }),
    );
    expect(await screen.findByText('Document signé')).toBeInTheDocument();
    expect(router.push).toHaveBeenCalledWith('/mon-espace/dossiers/dos_1?document=doc_1#documents');
  }, 30_000);

  it('asks for a change in the Document’s conversation', async () => {
    const comment = vi.fn();
    signView(request(), { 'dossiers.documents.comment': (input) => comment(input) ?? { id: 'com_1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Demander une modification' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.change(within(dialog).getByLabelText('Ce qui doit changer'), {
      target: { value: 'La date de naissance est fausse.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Envoyer' }));
    await waitFor(() =>
      expect(comment).toHaveBeenCalledWith({
        documentId: 'doc_1',
        body: 'Demande de modification avant signature : La date de naissance est fausse.',
      }),
    );
    expect(await screen.findByText('Demande envoyée à Stanzy')).toBeInTheDocument();
  });

  it('says when it is already signed', () => {
    signView(request({ status: 'SIGNED', canSign: false, signedAt: new Date('2026-11-04T10:00:00Z') }));
    expect(screen.getByText('Vous avez signé ce document le 4 novembre 2026.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Signer le document' })).not.toBeInTheDocument();
  });
});

const sections = {
  viewer: { id: 'acc_stanzy', name: 'Stanzy', role: 'CONSULTANT' },
  open: true,
  locked: false,
  sections: [
    {
      id: 'sec_1',
      title: 'Lettres',
      documents: [
        {
          id: 'doc_1',
          title: 'Lettre explicative',
          createdAt: new Date('2026-11-01T10:00:00Z'),
          finalVersionId: null,
          addedBy: { name: 'Stanzy', role: 'CONSULTANT' },
          versions: [
            {
              id: 'ver_1',
              number: 1,
              fileName: 'photo.jpg',
              contentType: 'image/jpeg',
              size: 1000,
              createdAt: new Date('2026-11-01T10:00:00Z'),
              uploadedBy: { name: 'Stanzy', role: 'CONSULTANT' },
              signedFor: null,
            },
            {
              id: 'ver_2',
              number: 2,
              fileName: 'lettre.pdf',
              contentType: 'application/pdf',
              size: 1000,
              createdAt: new Date('2026-11-02T10:00:00Z'),
              uploadedBy: { name: 'Stanzy', role: 'CONSULTANT' },
              signedFor: null,
            },
          ],
          comments: [],
          signatures: [],
        },
      ],
    },
  ],
};

function newView(assets = { SIGNATURE: null, STAMP: null }, create = vi.fn()) {
  const { trpc, queryClient, wrap } = createTestTRPC({
    'dossiers.documents.sections': () => sections,
    'signatures.assets': () => assets,
    'signatures.create': (input) => create(input) ?? { id: 'sig_9' },
    'signatures.pending': () => [],
  });
  queryClient.setQueryData(trpc.dossiers.documents.sections.queryKey({ dossierId: 'dos_1' }), sections as never);
  queryClient.setQueryData(trpc.signatures.assets.queryKey(), assets as never);
  return render(withIntl(wrap(<SignatureRequestNewView dossierId="dos_1" />)));
}

describe('SignatureRequestNewView, for the consultant', () => {
  it('offers only the PDFs, then places fields where the page is tapped and sends them', async () => {
    const create = vi.fn();
    newView(undefined, create);
    expect(screen.getAllByRole('button', { name: 'Choisir' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Choisir' }));

    const send = screen.getByRole('button', { name: 'Envoyer pour signature' });
    expect(send).toBeDisabled();
    // The stamp needs the signature and the stamp uploaded first.
    expect(screen.getByRole('button', { name: 'Signature et cachet Stanzy' })).toBeDisabled();

    const page = screen.getByRole('button', { name: 'Signature · Page 1' });
    page.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 800 }) as DOMRect;
    fireEvent.click(page, { clientX: 300, clientY: 400 });
    expect(screen.getByText('1 champ placé')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Date' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Date · Page 2' }), { key: 'Enter' });
    expect(screen.getByText('2 champs placés')).toBeInTheDocument();

    fireEvent.click(send);
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        versionId: 'ver_2',
        fields: [
          { kind: 'SIGNATURE', page: 0, x: expect.closeTo(0.35), y: expect.closeTo(0.465), width: 0.3, height: 0.07 },
          { kind: 'DATE', page: 1, x: expect.closeTo(0.4), y: expect.closeTo(0.485), width: 0.2, height: 0.03 },
        ],
      }),
    );
    expect(await screen.findByText('Demande de signature envoyée')).toBeInTheDocument();
    expect(router.push).toHaveBeenCalledWith('/dossiers/dos_1?document=doc_1#documents');
  }, 30_000);

  it('starts on the Version chosen from its Document, and removes a field', () => {
    search.value = 'version=ver_2';
    newView({ SIGNATURE: new Date(), STAMP: new Date() } as never);
    expect(screen.getByRole('button', { name: 'Signature et cachet Stanzy' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Signature et cachet Stanzy' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Signature et cachet Stanzy · Page 1' }), { key: 'Enter' });
    expect(screen.getByText('1 champ placé')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer le champ Signature et cachet Stanzy' }));
    expect(screen.getByText('Aucun champ placé')).toBeInTheDocument();
  });
});
