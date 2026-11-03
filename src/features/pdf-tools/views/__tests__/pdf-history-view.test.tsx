// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { PdfHistoryView } from '@/features/pdf-tools/views/pdf-history-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: the Outils PDF history as the consultant reads it, the list in the cache as the route prefetches it. */
const files = [
  {
    id: 'f1',
    name: 'releve-n2.pdf',
    pageCount: 3,
    size: 3_400_000,
    changes: ['merged', 'reordered', 'compressed'],
    quality: 0.65,
    sourceNames: ['releve.pdf', 'photo.jpg'],
    createdAt: new Date('2026-11-03T09:00:00Z'),
  },
  {
    id: 'f2',
    name: 'diplome.pdf',
    pageCount: 1,
    size: 800_000,
    changes: [],
    quality: null,
    sourceNames: ['diplome.pdf'],
    createdAt: new Date('2026-11-02T09:00:00Z'),
  },
];

describe('PdfHistoryView', () => {
  it('lists each PDF with what was done, and opens or downloads it', async () => {
    const { trpc, queryClient, wrap } = createTestTRPC({ 'pdfTools.history.list': () => files });
    queryClient.setQueryData(trpc.pdfTools.history.list.queryKey(), files as never);
    const { container } = render(withIntl(wrap(<PdfHistoryView />)));

    const first = screen.getByText('releve-n2.pdf').closest('li') as HTMLElement;
    for (const chip of ['Fusionné', 'Réorganisé', 'Compressé à 65 %']) {
      expect(within(first).getByText(chip)).toBeInTheDocument();
    }
    expect(within(first).getByText(/3 pages · 3,2 Mo/)).toBeInTheDocument();
    expect(within(first).getByRole('link', { name: 'Télécharger releve-n2.pdf' })).toHaveAttribute(
      'href',
      '/api/pdf-tools/files/f1?download',
    );
    expect(await axe(container)).toHaveNoViolations();
  }, 30_000);

  it('deletes a file at once, once confirmed', async () => {
    const remove = vi.fn();
    const { trpc, queryClient, wrap } = createTestTRPC({
      'pdfTools.history.list': () => files.slice(1),
      'pdfTools.history.delete': (input) => remove(input),
    });
    queryClient.setQueryData(trpc.pdfTools.history.list.queryKey(), files as never);
    render(withIntl(wrap(<PdfHistoryView />)));

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer releve-n2.pdf' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(screen.queryByText('releve-n2.pdf')).not.toBeInTheDocument());
    expect(remove).toHaveBeenCalledWith({ id: 'f1' });
    expect(await screen.findByText('Retiré de l’historique')).toBeInTheDocument();
  });
});
