// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { PdfWorkbench, type OutputMeta, type WorkbenchEngine } from '@/features/pdf-tools/components/pdf-workbench';
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

function workbench(run = vi.fn<(pdf: Uint8Array, meta: OutputMeta) => Promise<void>>(async () => {})) {
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

  it('reorders by dragging with the keyboard, turns and removes pages, and refuses what it can’t read', async () => {
    // jsdom lays nothing out: give each page a place in a row, as dnd-kit measures them.
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const list = this.closest('ol');
      const index = this.tagName === 'LI' && list ? [...list.children].indexOf(this) : 0;
      return {
        x: index * 200,
        y: 0,
        left: index * 200,
        top: 0,
        right: index * 200 + 180,
        bottom: 240,
        width: 180,
        height: 240,
        toJSON: () => ({}),
      } as DOMRect;
    });
    try {
      workbench();
      addFiles('releve.pdf', 'photo.jpg', 'lettre.docx');
      expect(await screen.findByText('lettre.docx : type de fichier non pris en charge.')).toBeInTheDocument();
      await waitFor(() => expect(pageNames()).toHaveLength(3));

      const handle = screen.getByRole('button', { name: 'Page 1 : glisser pour déplacer' });
      expect(handle).toHaveAttribute('aria-roledescription', 'sortable');
      handle.focus();
      fireEvent.keyDown(handle, { code: 'Space' });
      // dnd-kit listens for the arrows from the next tick, as a person would press them.
      const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      await tick();
      // Two places on, past the photo: the move shows in the order.
      fireEvent.keyDown(document, { code: 'ArrowRight' });
      await tick();
      fireEvent.keyDown(document, { code: 'ArrowRight' });
      await tick();
      fireEvent.keyDown(document, { code: 'Space' });
      await waitFor(() =>
        expect(pageNames()).toEqual(['Page 1 : releve.pdf', 'Page 2 : photo.jpg', 'Page 3 : releve.pdf']),
      );
    } finally {
      rect.mockRestore();
    }

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

    fireEvent.change(screen.getByLabelText('Nom du fichier'), { target: { value: 'Relevé N2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger' }));
    await waitFor(() => expect(run).toHaveBeenCalledOnce());
    const [pdf, meta] = run.mock.calls[0]!;
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(2);
    expect(meta).toEqual({
      name: 'Relevé N2.pdf',
      pageCount: 2,
      changes: ['compressed'],
      quality: 0.85,
      sourceNames: ['releve.pdf'],
    });
  });

  it('says what was done, and names the file after the first one by default', async () => {
    const { run } = workbench();
    addFiles('releve.pdf', 'photo.jpg');
    await waitFor(() => expect(pageNames()).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', { name: 'Retirer la page 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tourner la page 1 vers la droite' }));
    fireEvent.click(screen.getByRole('button', { name: 'Télécharger' }));
    await waitFor(() => expect(run).toHaveBeenCalledOnce());
    expect(run.mock.calls[0]![1]).toMatchObject({
      name: 'releve.pdf',
      changes: ['merged', 'rotated', 'removed'],
      quality: null,
    });
  });

  it('clears the whole canvas once confirmed', async () => {
    workbench();
    addFiles('releve.pdf', 'photo.jpg');
    await waitFor(() => expect(pageNames()).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', { name: 'Tout effacer' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Tout effacer' }));
    expect(await screen.findByText('Ajoutez des PDF ou des photos pour commencer.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tout effacer' })).not.toBeInTheDocument();
  });
});
