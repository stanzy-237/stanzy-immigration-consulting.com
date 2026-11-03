// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import type { WorkbenchEngine } from '@/features/pdf-tools/components/pdf-workbench';
import { jpegOf, pdfSource } from '@/features/pdf-tools/lib/__tests__/fixtures';
import { PdfToolsView } from '@/features/pdf-tools/views/pdf-tools-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: « Télécharger » on the Outils PDF page: the file is saved, and a copy goes to the history. */
const engine: WorkbenchEngine = {
  accepted: 'application/pdf',
  readSource: async (_file, name, id) => ({ ...(await pdfSource(id, 2)), name }),
  thumbnail: async () => 'data:image/png;base64,iVBORw0KGgo=',
  rasterize: async (pdf) =>
    (await PDFDocument.load(pdf))
      .getPages()
      .map((p) => ({ jpeg: jpegOf(), width: p.getWidth(), height: p.getHeight() })),
};

describe('PdfToolsView', () => {
  it('downloads, then keeps an encrypted copy in the history', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:pdf');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const upload = vi.fn(async (file: File) => ({
      objectKey: 'pdf-tools/acc_stanzy/x.bin',
      key: 'k',
      iv: 'i',
      fileName: file.name,
      contentType: 'application/pdf' as const,
      size: file.size,
    }));
    const add = vi.fn();
    const { wrap } = createTestTRPC({ 'pdfTools.history.add': (input) => add(input) });
    render(withIntl(wrap(<PdfToolsView engine={engine} upload={upload} />)));

    expect(screen.getByRole('link', { name: 'Historique' })).toHaveAttribute('href', '/outils-pdf/historique');
    fireEvent.change(screen.getByLabelText('Ajouter des fichiers'), {
      target: { files: [new File(['x'], 'releve.pdf')] },
    });
    await screen.findAllByRole('listitem');
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger' }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: 'releve.pdf', pageCount: 2, changes: [], sourceNames: ['releve.pdf'] }),
      ),
    );
    expect(upload).toHaveBeenCalledWith(expect.any(File), { uploadRoute: '/api/pdf-tools/upload', payload: {} });
    expect(await screen.findByText('Ajouté à l’historique')).toBeInTheDocument();
    click.mockRestore();
  });
});
