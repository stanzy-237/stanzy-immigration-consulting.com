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
const CLIENT = { id: 'acc_1', name: 'Aminata Diallo', role: 'MEMBER' as const };
const STANZY = { id: 'acc_stanzy', name: 'Stanzy', role: 'CONSULTANT' as const };
const message = (id: string, parentId: string | null, author: typeof CLIENT | typeof STANZY, body: string) => ({
  id,
  parentId,
  body,
  createdAt: new Date('2026-10-21T11:00:00Z'),
  editedAt: null,
  deletedAt: null,
  author,
});

const sections = (
  extra: {
    locked?: boolean;
    open?: boolean;
    viewer?: typeof CLIENT | typeof STANZY;
    concerns?: boolean;
    sectionConcerns?: string | null;
  } = {},
) => ({
  viewer: CLIENT,
  open: true,
  locked: false,
  concerns: false,
  ...extra,
  sections: [
    {
      id: 'sec_1',
      title: 'Diplômes – Requérant principal',
      concerns: extra.sectionConcerns ?? null,
      concernsUpdatedAt: extra.sectionConcerns ? new Date('2026-11-10T10:00:00Z') : null,
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
              signedFor: null,
            },
            {
              id: 'ver_2',
              number: 2,
              fileName: 'releve-net.pdf',
              contentType: 'application/pdf',
              size: 900_000,
              createdAt: new Date('2026-10-22T10:00:00Z'),
              uploadedBy: person('Stanzy', 'CONSULTANT'),
              signedFor: null,
            },
          ],
          comments: [
            message('com_1', null, STANZY, 'Le scan est flou.'),
            message('com_2', 'com_1', CLIENT, 'Je le refais ce soir.'),
          ],
          signatures: [],
          kind: null,
          need: null,
          missing: false,
          clientNote: null,
          stanzyRequests: [],
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
  editComment: vi.fn(),
  deleteComment: vi.fn(),
  setSectionConcerns: vi.fn(),
}));
beforeEach(() => vi.resetAllMocks());

/** A server that hasn't answered yet: what the screen shows meanwhile. */
const silent = () => new Promise(() => {});

function documents(
  viewer: Viewer,
  data = sections({ viewer: viewer === 'consultant' ? STANZY : CLIENT }),
  focus?: { documentId: string | null; messageId: string | null },
) {
  const { trpc, queryClient, wrap } = createTestTRPC({
    'dossiers.documents.sections': () => data,
    'dossiers.documents.addDocument': (input) => api.addDocument(input) ?? { id: 'doc_9' },
    'dossiers.documents.addSection': (input) => api.addSection(input) ?? { id: 'sec_9' },
    'dossiers.documents.addVersion': (input) => api.addVersion(input) ?? { id: 'ver_9', number: 3 },
    'dossiers.documents.setFinal': (input) => api.setFinal(input),
    'dossiers.documents.comment': (input) => api.comment(input) ?? { id: 'com_9' },
    'dossiers.documents.editComment': (input) => api.editComment(input),
    'dossiers.documents.deleteComment': (input) => api.deleteComment(input),
    'dossiers.documents.setSectionConcerns': (input) => api.setSectionConcerns(input),
  });
  queryClient.setQueryData(trpc.dossiers.documents.sections.queryKey({ dossierId: 'dos_1' }), data as never);
  return render(withIntl(wrap(<DossierDocuments dossierId="dos_1" viewer={viewer} focus={focus} />)));
}

const openDocument = () => fireEvent.click(screen.getByRole('button', { name: /^Relevé N2/ }));
/** The message showing `text`, to act on it. */
const messageWith = (text: string) => screen.getByText(text).closest('article') as HTMLElement;

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

  it('leaves adding Documents to Stanzy', () => {
    documents('client');
    expect(screen.queryByLabelText('Ajouter un document')).not.toBeInTheDocument();
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

  it('asks for a message, then shows it before the server answers', async () => {
    api.comment.mockImplementation(silent);
    documents('client');
    openDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText('Écrivez un message.')).toBeInTheDocument();

    const field = screen.getByLabelText('Écrire à propos de Relevé N2');
    fireEvent.change(field, { target: { value: 'Voici le nouveau scan.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText('Voici le nouveau scan.')).toBeInTheDocument();
    expect(screen.getByText('· envoi…')).toBeInTheDocument();
    expect(field).toHaveValue('');
    expect(api.comment).toHaveBeenCalledWith({ documentId: 'doc_1', body: 'Voici le nouveau scan.' });
  });

  it('replies in the thread', async () => {
    documents('client');
    openDocument();
    fireEvent.click(within(messageWith('Le scan est flou.')).getByRole('button', { name: 'Répondre' }));
    fireEvent.change(screen.getByLabelText('Répondre à Stanzy'), { target: { value: 'C’est fait.' } });
    fireEvent.click(
      within(screen.getByLabelText('Répondre à Stanzy').closest('form')!).getByRole('button', { name: 'Répondre' }),
    );
    await waitFor(() =>
      expect(api.comment).toHaveBeenCalledWith({ documentId: 'doc_1', parentId: 'com_1', body: 'C’est fait.' }),
    );
    expect(await screen.findByText('Réponse envoyée')).toBeInTheDocument();
  });

  it('edits and deletes only their own messages, on screen at once', async () => {
    api.editComment.mockImplementation(silent);
    api.deleteComment.mockImplementation(silent);
    documents('client');
    openDocument();
    const question = messageWith('Le scan est flou.');
    expect(within(question).queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument();
    expect(within(question).queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument();

    fireEvent.click(within(messageWith('Je le refais ce soir.')).getByRole('button', { name: 'Modifier' }));
    fireEvent.change(screen.getByLabelText('Modifier votre message'), { target: { value: 'Je le refais demain.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Je le refais demain.')).toBeInTheDocument();
    await waitFor(() => expect(api.editComment).toHaveBeenCalledWith({ id: 'com_2', body: 'Je le refais demain.' }));

    fireEvent.click(within(messageWith('Je le refais demain.')).getByRole('button', { name: 'Supprimer' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(screen.queryByText('Je le refais demain.')).not.toBeInTheDocument());
    expect(api.deleteComment).toHaveBeenCalledWith({ id: 'com_2' });
  });

  it('puts a message back when the server refuses it', async () => {
    api.comment.mockImplementation(() => {
      throw new Error('DOSSIER_CLOSED');
    });
    documents('client');
    openDocument();
    fireEvent.change(screen.getByLabelText('Écrire à propos de Relevé N2'), { target: { value: 'Trop tard ?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText('Ce dossier est clôturé : il ne peut plus changer.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Trop tard ?')).not.toBeInTheDocument());
  });
});

describe('DossierDocuments for the consultant', () => {
  it('deletes any message, as the consultant', async () => {
    documents('consultant');
    openDocument();
    const answer = messageWith('Je le refais ce soir.');
    expect(within(answer).queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument();
    expect(within(answer).getByRole('button', { name: 'Supprimer' })).toBeInTheDocument();
  });

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

  it('adds a Section, on screen at once', async () => {
    api.addSection.mockImplementation(silent);
    documents('consultant');
    fireEvent.change(screen.getByLabelText('Nom de la section'), { target: { value: 'Preuve de fonds' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter la section' }));
    expect(await screen.findByRole('heading', { name: 'Preuve de fonds' })).toBeInTheDocument();
    await waitFor(() => expect(api.addSection).toHaveBeenCalledWith({ dossierId: 'dos_1', title: 'Preuve de fonds' }));
  });

  it('adds a Document to a Section', async () => {
    documents('consultant');
    fireEvent.change(screen.getByLabelText('Ajouter un document'), { target: { value: 'Attestation de diplôme' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() =>
      expect(api.addDocument).toHaveBeenCalledWith({ sectionId: 'sec_1', title: 'Attestation de diplôme' }),
    );
    expect(await screen.findByText('Document ajouté')).toBeInTheDocument();
  });

  it('offers nothing to change in a closed Dossier', () => {
    documents('consultant', sections({ open: false }));
    expect(screen.queryByText('Nouvelle section')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Ajouter un document')).not.toBeInTheDocument();
  });
});

describe('DossierDocuments from a Notification’s link', () => {
  it('opens the Document and brings the message into view, outlined', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    documents('consultant', undefined, { documentId: 'doc_1', messageId: 'com_2' });

    expect(screen.getByRole('button', { name: /^Relevé N2/ })).toHaveAttribute('aria-expanded', 'true');
    expect(messageWith('Je le refais ce soir.')).toHaveAttribute('aria-current', 'true');
    expect(messageWith('Le scan est flou.')).not.toHaveAttribute('aria-current');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  });
});

describe('Demandes de signature on the documents', () => {
  /** Relevé N2 waiting for the Client's signature; its V1 the signed PDF of an earlier Demande. */
  const waitingData = (viewer: typeof CLIENT | typeof STANZY) => {
    const data = sections({ viewer });
    const document = data.sections[0]!.documents[0]!;
    document.signatures = [{ id: 'sig_1', versionId: 'ver_2' }] as never;
    document.versions[0]!.signedFor = { id: 'sig_0' } as never;
    return data;
  };

  it('asks the Client to sign, from the list and from the Document', () => {
    documents('client', waitingData(CLIENT));
    expect(screen.getByText('Un document attend votre signature')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Signer' });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute('href', '/fr/mon-espace/dossiers/dos_1/signer/sig_1');
    expect(screen.getByText('À signer')).toBeInTheDocument();
    openDocument();
    expect(screen.getByText('Signée')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Faire signer/ })).not.toBeInTheDocument();
  });

  it('lets the consultant send a PDF Version for signature', () => {
    documents('consultant');
    expect(screen.getByRole('link', { name: 'Demander une signature' })).toHaveAttribute(
      'href',
      '/dossiers/dos_1/signature',
    );
    openDocument();
    expect(screen.getByRole('link', { name: 'Faire signer la version V2' })).toHaveAttribute(
      'href',
      '/dossiers/dos_1/signature?version=ver_2',
    );
  });

  it('shows the consultant the Demande waiting, and cancels it', async () => {
    const cancel = vi.fn();
    const data = waitingData(STANZY);
    const { trpc, queryClient, wrap } = createTestTRPC({
      'dossiers.documents.sections': () => data,
      'signatures.cancel': (input) => cancel(input),
      'signatures.pending': () => [],
    });
    queryClient.setQueryData(trpc.dossiers.documents.sections.queryKey({ dossierId: 'dos_1' }), data as never);
    render(withIntl(wrap(<DossierDocuments dossierId="dos_1" viewer="consultant" />)));
    expect(screen.getByText('Signature en attente')).toBeInTheDocument();
    openDocument();
    // One Demande at a time: no new one while it waits.
    expect(screen.queryByRole('link', { name: /Faire signer/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler la demande' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Annuler la demande' }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith({ id: 'sig_1' }));
    expect(await screen.findByText('Demande de signature annulée')).toBeInTheDocument();
  });

  it('offers no signing in a closed Dossier', () => {
    documents('client', { ...waitingData(CLIENT), open: false });
    expect(screen.queryByRole('link', { name: 'Signer' })).not.toBeInTheDocument();
  });
});

describe('the Client’s concerns about a Section (#149)', () => {
  it('lets the Client note them, shown at once', async () => {
    api.setSectionConcerns.mockImplementation(silent);
    const { container } = documents('client', sections({ concerns: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une préoccupation sur la section Diplômes – Requérant principal' }));
    fireEvent.change(screen.getByLabelText('Vos préoccupations sur la section Diplômes – Requérant principal'), {
      target: { value: 'Mon relevé porte mon nom de jeune fille.' },
    });
    expect(await axe(container)).toHaveNoViolations();
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() =>
      expect(api.setSectionConcerns).toHaveBeenCalledWith({ id: 'sec_1', concerns: 'Mon relevé porte mon nom de jeune fille.' }),
    );
    expect(screen.getByText('Mon relevé porte mon nom de jeune fille.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modifier vos préoccupations sur la section Diplômes – Requérant principal' })).toBeInTheDocument();
  }, 30_000);

  it('shows the consultant the Client’s concerns, without editing them', () => {
    documents('consultant', sections({ viewer: STANZY, concerns: true, sectionConcerns: 'Date de diplôme incertaine.' }));
    expect(screen.getByText('Préoccupations du Client')).toBeInTheDocument();
    expect(screen.getByText('Date de diplôme incertaine.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /préoccupation/i })).not.toBeInTheDocument();
  });

  it('asks nothing outside an Accompagnement Dossier', () => {
    documents('client', sections({ concerns: false }));
    expect(screen.queryByRole('button', { name: /préoccupation/ })).not.toBeInTheDocument();
  });
});
