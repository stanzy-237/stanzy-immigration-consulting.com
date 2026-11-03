// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { PdfWorkbench, type WorkbenchEngine } from '@/features/pdf-tools/components/pdf-workbench';
import { jpegOf, pdfSource, photoSource } from '@/features/pdf-tools/lib/__tests__/fixtures';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';
import { Download } from 'lucide-react';

/**
 * Seam: the Outils PDF as the consultant uses them, over a stand-in for the
 * browser's pdf.js (files read by name, thumbnails, page rasters) and the real
 * pdf-lib for the output.
 */
const engine = (): WorkbenchEngine => ({
  accepted: 'application/pdf,image/jpeg',
  readSource: vi.fn(async (_file: Blob, name: string, id: string) => {
    if (name.endsWith('.docx')) throw new Error('PDF_UNSUPPORTED');
    return name.endsWith('.pdf') ? { ...(await pdfSource(id, 2)), name } : { ...photoSource(id, 300, 400), name };
  }),
  thumbnail: vi.fn(async () => 'data:image/png;base64,iVBORw0KGgo='),
  // Each page redrawn as a tiny JPEG: the compressed copy is small.
  rasterize: vi.fn(async (pdf: Uint8Array) => {
    const doc = await PDFDocument.load(pdf);
    return doc.getPages().map((page) => ({ jpeg: jpegOf(), width: page.getWidth(), height: page.getHeight() }));
  }),
});

function workbench(run = vi.fn<(pdf: Uint8Array) => Promise<void>>(async () => {})) {
  const used = engine();
  // The app's frame, for the toasts.
  const { wrap } = createTestTRPC({});
  render(withIntl(wrap(<PdfWorkbench engine={used} finish={{ label: 'Télécharger', icon: Download, run }} />)));
  return { used, run };
}

const addFiles = (...names: string[]) =>
  fireEvent.change(screen.getByLabelText('Ajouter des fichiers'), {
    target: { files: names.map((name) => new File(['x'], name)) },
  });

const pageNames = () =>
  within(screen.getByRole('list', { name: 'Pages du document' }))
    .getAllByRole('listitem')
    .map((item) => within(item).getByRole('img').getAttribute('alt'));

describe('PdfWorkbench', () => {
  it('lists the pages of the files added, with the size under IRCC’s limit', async () => {
    const { container } = render(
      withIntl(<PdfWorkbench engine={engine()} finish={{ label: 'Télécharger', icon: Download, run: vi.fn() }} />),
    );
    addFiles('releve.pdf', 'photo.jpg');
    await waitFor(() =>
      expect(pageNames()).toEqual(['Page 1 : releve.pdf', 'Page 2 : releve.pdf', 'Page 3 : photo.jpg']),
    );
    expect(await screen.findByText(/3 pages · 0 Mo/)).toBeInTheDocument();
    expect(screen.getByText('Sous la limite d’IRCC (4 Mo).')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  }, 30_000);

  it('moves, turns and removes pages, and refuses what it can’t read', async () => {
    workbench();
    addFiles('releve.pdf', 'photo.jpg', 'lettre.docx');
    expect(await screen.findByText('lettre.docx : type de fichier non pris en charge.')).toBeInTheDocument();
    await waitFor(() => expect(pageNames()).toHaveLength(3));

    fireEvent.click(screen.getByRole('button', { name: 'Avancer la page 3' }));
    expect(pageNames()).toEqual(['Page 1 : releve.pdf', 'Page 2 : photo.jpg', 'Page 3 : releve.pdf']);
    fireEvent.click(screen.getByRole('button', { name: 'Retirer la page 1' }));
    expect(pageNames()).toEqual(['Page 1 : photo.jpg', 'Page 2 : releve.pdf']);
    fireEvent.click(screen.getByRole('button', { name: 'Tourner la page 1 vers la droite' }));
    expect(within(screen.getAllByRole('listitem')[0]!).getByRole('img')).toHaveClass('rotate-90');
  });

  it('compresses, then hands over the compressed copy', async () => {
    const { run, used } = workbench();
    addFiles('releve.pdf');
    await waitFor(() => expect(pageNames()).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Compresser jusqu’à 4 Mo' }));
    expect(await screen.findByText(/Compressé à 85 %/)).toBeInTheDocument();
    expect(used.rasterize).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Télécharger' }));
    await waitFor(() => expect(run).toHaveBeenCalledOnce());
    const doc = await PDFDocument.load(run.mock.calls[0]![0]);
    expect(doc.getPageCount()).toBe(2);
  });
});
