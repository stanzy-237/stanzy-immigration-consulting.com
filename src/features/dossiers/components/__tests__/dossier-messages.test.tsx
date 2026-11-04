// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { DossierMessages } from '@/features/dossiers/components/dossier-messages';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: the « Messages » panel with its conversation in the cache, as the routes prefetch it. */
const upload = vi.hoisted(() => ({ uploadEncryptedFile: vi.fn() }));
vi.mock('@/features/dossiers/lib/upload-version', () => upload);

beforeEach(() => vi.clearAllMocks());

const message = (extra: Record<string, unknown> = {}) => ({
  id: 'msg_1',
  parentId: null,
  body: 'Bonjour, où en est mon dossier ?',
  editedAt: null,
  deletedAt: null,
  createdAt: new Date('2026-11-04T09:00:00Z'),
  author: { id: 'acc_1', name: 'Aminata Diallo', role: 'MEMBER' },
  files: [],
  ...extra,
});

function panel(viewer: 'client' | 'consultant', data: unknown, handlers: Record<string, (input: never) => unknown> = {}) {
  const { trpc, queryClient, wrap } = createTestTRPC({ 'dossiers.messages.list': () => data, ...handlers });
  queryClient.setQueryData(trpc.dossiers.messages.list.queryKey({ dossierId: 'dos_1' }), data as never);
  return render(withIntl(wrap(<DossierMessages dossierId="dos_1" viewer={viewer} />)));
}

describe('Messages du dossier', () => {
  it('shows the conversation with its files, and sends a message with a file encrypted first', async () => {
    const post = vi.fn();
    upload.uploadEncryptedFile.mockResolvedValue({
      objectKey: 'dossiers/dos_1/messages/a.bin',
      key: 'k',
      iv: 'i',
      fileName: 'releve.pdf',
      contentType: 'application/pdf',
      size: 10,
    });
    const { container } = panel(
      'consultant',
      {
        viewer: { id: 'acc_stanzy', role: 'CONSULTANT' },
        open: true,
        messages: [message({ files: [{ id: 'file_1', fileName: 'passeport.pdf', contentType: 'application/pdf', size: 10 }] })],
      },
      { 'dossiers.messages.post': (input) => post(input) ?? { id: 'msg_2' } },
    );
    expect(screen.getByRole('heading', { name: 'Messages' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ouvrir passeport.pdf' })).toHaveAttribute(
      'href',
      '/api/dossiers/messages/files/file_1',
    );
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.change(screen.getByLabelText('Écrire un message'), { target: { value: 'Voici le relevé.' } });
    const picked = new File(['%PDF'], 'releve.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Joindre des fichiers'), { target: { files: [picked] } });
    expect(screen.getByText('releve.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith({
        dossierId: 'dos_1',
        body: 'Voici le relevé.',
        files: [expect.objectContaining({ fileName: 'releve.pdf' })],
      }),
    );
    expect(upload.uploadEncryptedFile).toHaveBeenCalledWith(picked, {
      uploadRoute: '/api/dossiers/messages/upload',
      payload: { dossierId: 'dos_1' },
    });
  });

  it('asks for words or a file before sending', () => {
    panel('client', { viewer: { id: 'acc_1', role: 'MEMBER' }, open: true, messages: [] });
    expect(screen.getByText('Aucun message pour l’instant.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(screen.getByText('Écrivez un message ou joignez un fichier.')).toBeInTheDocument();
  });

  it('replies under a message, and lets its author edit it', async () => {
    const post = vi.fn();
    panel(
      'client',
      { viewer: { id: 'acc_1', role: 'MEMBER' }, open: true, messages: [message()] },
      { 'dossiers.messages.post': (input) => post(input) ?? { id: 'msg_2' } },
    );
    const article = screen.getByRole('article');
    expect(within(article).getByRole('button', { name: 'Modifier' })).toBeInTheDocument();
    fireEvent.click(within(article).getByRole('button', { name: 'Répondre' }));
    fireEvent.change(screen.getByLabelText('Répondre à Aminata Diallo'), { target: { value: 'Précision' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Répondre' }).at(-1)!);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith({ dossierId: 'dos_1', parentId: 'msg_1', body: 'Précision', files: [] }),
    );
  });

  it('is read only once the Dossier is closed', () => {
    panel('client', { viewer: { id: 'acc_1', role: 'MEMBER' }, open: false, messages: [message()] });
    expect(screen.getByText('Le dossier est clôturé : les messages restent lisibles.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Répondre' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Écrire un message')).not.toBeInTheDocument();
  });
});
