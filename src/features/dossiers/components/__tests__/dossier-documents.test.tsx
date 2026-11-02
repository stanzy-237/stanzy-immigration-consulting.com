// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { DossierDocuments } from '@/features/dossiers/components/dossier-documents';
import type { Viewer } from '@/features/dossiers/components/document-styles';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/**
 * Seam: a Dossier's documents as the consultant and the Client use them, with
 * the Sections in the cache as the route prefetches them. The browser-side
 * encryption and Blob upload are stubbed; stubs answer and record the calls.
 */
const upload = vi.hoisted(() => ({
  uploadVersionFile: vi.fn(),
  versionFileUrl: (id: string) => `/api/dossiers/files/${id}`,
}));
vi.mock('@/features/dossiers/lib/upload-version', () => upload);

const person = (name: string, role: 'MEMBER' | 'CONSULTANT' = 'MEMBER') => ({ name, role });
const sections = (extra: { locked?: boolean; open?: boolean } = {}) => ({
  open: true,
  locked: false,
  ...extra,
  sections: [
    {
      id: 'sec_1',
      title: 'Diplômes – Requérant principal',
      documents: [
        {
          id: 'doc_1',
          title: 'Relevé N2',
          createdAt: new Date('2026-10-20T10:00:00Z'),
          finalVersionId: 'ver_1',
          addedBy: person('Aminata Diallo'),
          versions: [
            {
              id: 'ver_1',
              number: 1,
              fileName: 'releve.pdf',
              contentType: 'application/pdf',
              size: 1_200_000,
              createdAt: new Date('2026-10-21T10:00:00Z'),
              uploadedBy: person('Aminata Diallo'),
            },
            {
              id: 'ver_2',
              number: 2,
              fileName: 'releve-net.pdf',
              contentType: 'application/pdf',
              size: 900_000,
              createdAt: new Date('2026-10-22T10:00:00Z'),
              uploadedBy: person('Stanzy', 'CONSULTANT'),
            },
          ],
          comments: [
            {
              id: 'com_1',
              body: 'Le scan est flou.',
              createdAt: new Date('2026-10-21T11:00:00Z'),
              author: person('Stanzy', 'CONSULTANT'),
            },
          ],
        },
      ],
    },
  ],
});

const api = vi.hoisted(() => ({
  addDocument: vi.fn(),
  addSection: vi.fn(),
  addVersion: vi.fn(),
  setFinal: vi.fn(),
  comment: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());

function documents(viewer: Viewer, data = sections()) {
  const { trpc, queryClient, wrap } = createTestTRPC({
    'dossiers.documents.sections': () => data,
    'dossiers.documents.addDocument': (input) => api.addDocument(input) ?? { id: 'doc_9' },
    'dossiers.documents.addSection': (input) => api.addSection(input) ?? { id: 'sec_9' },
    'dossiers.documents.addVersion': (input) => api.addVersion(input) ?? { id: 'ver_9', number: 3 },
    'dossiers.documents.setFinal': (input) => api.setFinal(input),
    'dossiers.documents.comment': (input) => api.comment(input) ?? { id: 'com_9' },
  });
  queryClient.setQueryData(trpc.dossiers.documents.sections.queryKey({ dossierId: 'dos_1' }), data as never);
  return render(withIntl(wrap(<DossierDocuments dossierId="dos_1" viewer={viewer} />)));
}

const openDocument = () => fireEvent.click(screen.getByRole('button', { name: /^Relevé N2/ }));

describe('DossierDocuments for the Client', () => {
  it('shows each Version and comment, without the consultant’s controls', async () => {
    const { container } = documents('client');
    expect(screen.getByText('Finale : V1')).toBeInTheDocument();
    openDocument();
    expect(screen.getByRole('link', { name: /Ouvrir la version 2/ })).toHaveAttribute(
      'href',
      '/api/dossiers/files/ver_2',
    );
    expect(screen.getByText('Le scan est flou.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Marquer finale/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Supprimer le document/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Nouvelle section')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  }, 30_000);

  it('adds a Document they already have', async () => {
    documents('client');
    fireEvent.change(screen.getByLabelText('Ajouter un document'), { target: { value: 'Attestation de diplôme' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() =>
      expect(api.addDocument).toHaveBeenCalledWith({ sectionId: 'sec_1', title: 'Attestation de diplôme' }),
    );
    expect(await screen.findByText('Document ajouté')).toBeInTheDocument();
  });

  it('uploads a Version: encrypted and sent first, then recorded', async () => {
    upload.uploadVersionFile.mockResolvedValue({
      objectKey: 'dossiers/dos_1/x.bin',
      key: 'k',
      iv: 'i',
      fileName: 'scan.jpg',
      contentType: 'image/jpeg',
      size: 10,
    });
    documents('client');
    openDocument();
    const file = new File(['x'], 'scan.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Téléverser une version de Relevé N2'), { target: { files: [file] } });

    await waitFor(() => expect(upload.uploadVersionFile).toHaveBeenCalledWith('doc_1', file));
    await waitFor(() =>
      expect(api.addVersion).toHaveBeenCalledWith(
        expect.objectContaining({ documentId: 'doc_1', objectKey: 'dossiers/dos_1/x.bin' }),
      ),
    );
    expect(await screen.findByText('Version V3 ajoutée')).toBeInTheDocument();
  });

  it('says why a file was refused before sending it', async () => {
    upload.uploadVersionFile.mockRejectedValue(new Error('DOCUMENT_FILE_TOO_LARGE'));
    documents('client');
    openDocument();
    fireEvent.change(screen.getByLabelText('Téléverser une version de Relevé N2'), {
      target: { files: [new File(['x'], 'big.pdf', { type: 'application/pdf' })] },
    });
    expect(await screen.findByText('Ce fichier dépasse 25 Mo.')).toBeInTheDocument();
    expect(api.addVersion).not.toHaveBeenCalled();
  });

  it('asks for a message before commenting', async () => {
    documents('client');
    openDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText('Écrivez un message.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Commenter Relevé N2'), { target: { value: 'Voici le nouveau scan.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    await waitFor(() =>
      expect(api.comment).toHaveBeenCalledWith({ documentId: 'doc_1', body: 'Voici le nouveau scan.' }),
    );
  });
});

describe('DossierDocuments for the consultant', () => {
  it('moves the Finale to another Version', async () => {
    documents('consultant');
    openDocument();
    const versions = within(screen.getByRole('heading', { name: 'Versions' }).parentElement!).getAllByRole('listitem');
    expect(within(versions[1]!).getByRole('button', { name: /Finale/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(versions[0]!).getByRole('button', { name: /Marquer finale/ }));
    await waitFor(() => expect(api.setFinal).toHaveBeenCalledWith({ documentId: 'doc_1', versionId: 'ver_2' }));
    expect(await screen.findByText('Version finale choisie')).toBeInTheDocument();
  });

  it('can’t change the Finale once locked', () => {
    documents('consultant', sections({ locked: true }));
    expect(
      screen.getByText('Le dossier a passé l’étape de dépôt : les versions finales sont figées.'),
    ).toBeInTheDocument();
    openDocument();
    expect(screen.getByRole('button', { name: /Marquer finale/ })).toBeDisabled();
  });

  it('adds a Section', async () => {
    documents('consultant');
    fireEvent.change(screen.getByLabelText('Nom de la section'), { target: { value: 'Preuve de fonds' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter la section' }));
    await waitFor(() => expect(api.addSection).toHaveBeenCalledWith({ dossierId: 'dos_1', title: 'Preuve de fonds' }));
  });

  it('offers nothing to change in a closed Dossier', () => {
    documents('consultant', sections({ open: false }));
    expect(screen.queryByText('Nouvelle section')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Ajouter un document')).not.toBeInTheDocument();
  });
});
