// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { HandoffPanel } from '@/features/document-services/components/handoff-panel';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/**
 * Seam: « Transmission au partenaire » on a service request, as the
 * consultant uses it. The Outil PDF is stood in for (it has its own tests):
 * it receives the files and « Préparer l'envoi » hands back a PDF. File
 * reading, the encrypted upload and `fetch` are stubbed.
 */
const pdfTool = vi.hoisted(() => ({ sources: [] as { name: string }[] }));
vi.mock('@/features/pdf-tools/components/pdf-workbench', () => ({
  PdfWorkbench: ({
    initialSources,
    finish,
  }: {
    initialSources: { name: string }[];
    finish: { label: string; run: (pdf: Uint8Array, meta: { name: string }) => Promise<void> };
  }) => {
    pdfTool.sources = initialSources;
    return (
      <button type="button" onClick={() => void finish.run(new Uint8Array([37, 80, 68, 70]), { name: 'transmission.pdf' })}>
        {finish.label}
      </button>
    );
  },
}));
vi.mock('@/features/pdf-tools/lib/browser-pdf', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/pdf-tools/lib/browser-pdf')>()),
  readSource: async (_blob: Blob, name: string, id: string) => ({ id, name, kind: 'pdf', bytes: new ArrayBuffer(4), mime: 'application/pdf', pageCount: 1 }),
}));
const upload = vi.hoisted(() => ({ uploadEncryptedFile: vi.fn(), versionFileUrl: (id: string) => `/api/dossiers/files/${id}` }));
vi.mock('@/features/dossiers/lib/upload-version', () => upload);

const handoff = {
  service: { id: 'svc_pof', name: { fr: 'Preuve de fonds', en: 'Proof of funds' } },
  partner: { name: 'Banque Atlantique', phone: '+237 690 00 00 00', email: 'dossiers@banque.cm' },
  note: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Aminata Diallo, chez Brasseries du Cameroun.' }] }] },
  saved: false,
  hasTemplate: true,
  values: { client: 'Aminata Diallo' },
  pieces: [
    { id: 'file_plan', label: { fr: 'Plan de localisation', en: 'Location map' }, fileName: 'plan.jpg', contentType: 'image/jpeg', url: '/api/requirements/files/file_plan' },
    { id: 'ver_1', label: { fr: 'Photo', en: 'Photo' }, fileName: 'photo.jpg', contentType: 'image/jpeg', url: '/api/dossiers/files/ver_1' },
  ],
  sentAt: null,
  sentTo: null,
};

const api = vi.hoisted(() => ({ saveNote: vi.fn(), email: vi.fn() }));
const fetched: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  fetched.length = 0;
  vi.stubGlobal('fetch', async (url: string) => {
    fetched.push(url);
    return new Response(new Blob(['%PDF']), { status: 200 });
  });
  upload.uploadEncryptedFile.mockResolvedValue({
    objectKey: 'requirements/stz_1/handoff/x.bin',
    key: 'k',
    iv: 'i',
    fileName: 'transmission.pdf',
    contentType: 'application/pdf',
    size: 4,
  });
  api.email.mockReturnValue({ sentAt: new Date(), sentTo: 'dossiers@banque.cm' });
});

function panel(data = handoff) {
  const { trpc, queryClient, wrap } = createTestTRPC({
    'documentServices.handoff.get': () => data,
    'documentServices.handoff.saveNote': (input) => api.saveNote(input),
    'documentServices.handoff.email': (input) => api.email(input),
  });
  queryClient.setQueryData(trpc.documentServices.handoff.get.queryKey({ requestId: 'stz_1' }), data as never);
  return render(withIntl(wrap(<HandoffPanel requestId="stz_1" />)));
}

describe('« Transmission au partenaire » (#148)', () => {
  it('names the partner, starts from the filled-in note, and attaches every piece', async () => {
    const { container } = panel();
    expect(screen.getByText('À : Banque Atlantique · +237 690 00 00 00 · dossiers@banque.cm')).toBeInTheDocument();
    expect(await screen.findByText('Aminata Diallo, chez Brasseries du Cameroun.')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Plan de localisation/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Photo/ })).toBeChecked();
    expect(await axe(container)).toHaveNoViolations();
  }, 30_000);

  it('exports the note then the pieces kept to the Outil PDF, then sends it by WhatsApp or email', async () => {
    panel();
    fireEvent.click(screen.getByRole('checkbox', { name: /Photo/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Exporter vers l’Outil PDF' }));

    await waitFor(() => expect(api.saveNote).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'stz_1' })));
    const dialog = await screen.findByRole('dialog', { name: 'Transmission – Preuve de fonds' });
    expect(fetched).toEqual(['/api/requirements/stz_1/handoff-note', '/api/requirements/files/file_plan']);
    expect(pdfTool.sources.map((source) => source.name)).toEqual(['note.pdf', 'plan.jpg']);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Préparer l’envoi' }));
    const whatsapp = await within(dialog).findByRole('link', { name: 'Ouvrir WhatsApp' });
    expect(whatsapp).toHaveAttribute(
      'href',
      `https://wa.me/237690000000?text=${encodeURIComponent('Bonjour, voici le dossier de Aminata Diallo pour le service « Preuve de fonds ».')}`,
    );

    fireEvent.click(within(dialog).getByRole('button', { name: 'Envoyer par e-mail à dossiers@banque.cm' }));
    await waitFor(() =>
      expect(upload.uploadEncryptedFile).toHaveBeenCalledWith(expect.any(File), {
        uploadRoute: '/api/requirements/handoff-upload',
        payload: { requestId: 'stz_1' },
      }),
    );
    await waitFor(() =>
      expect(api.email).toHaveBeenCalledWith({ requestId: 'stz_1', file: expect.objectContaining({ fileName: 'transmission.pdf' }) }),
    );
    expect(await screen.findByText('Envoyé à dossiers@banque.cm')).toBeInTheDocument();
  }, 30_000);

  it('leads to the service’s settings when it has no partner, and offers no email', async () => {
    panel({ ...handoff, partner: { name: null, phone: null, email: null } } as never);
    expect(screen.getByRole('link', { name: 'Réglages du service' })).toHaveAttribute('href', '/services/svc_pof');
    fireEvent.click(screen.getByRole('button', { name: 'Exporter vers l’Outil PDF' }));
    const dialog = await screen.findByRole('dialog', { name: 'Transmission – Preuve de fonds' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Préparer l’envoi' }));
    expect(await within(dialog).findByRole('link', { name: 'Ouvrir WhatsApp' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^https:\/\/wa\.me\/\?text=/),
    );
    expect(within(dialog).queryByRole('button', { name: /Envoyer par e-mail/ })).not.toBeInTheDocument();
  }, 30_000);
});
