// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import type { WorkbenchEngine } from '@/features/pdf-tools/components/pdf-workbench';
import { pdfSource } from '@/features/pdf-tools/lib/__tests__/fixtures';
import { PublicPdfToolView } from '@/features/pdf-tools/views/public-pdf-tool-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: the public Outil PDF, signed out, with a stub PDF engine. */
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
vi.mock('@/features/auth/hooks/use-current-account', () => ({
  useCurrentAccount: () => ({ account: null, pending: false, signOut: vi.fn() }),
}));

const engine: WorkbenchEngine = {
  accepted: 'application/pdf',
  readSource: async (_file, name, id) => ({ ...(await pdfSource(id, 2)), name }),
  thumbnail: async () => 'data:image/png;base64,iVBORw0KGgo=',
  rasterize: async () => [],
};
const file = (name: string, size: number) => {
  const pdf = new File(['%PDF'], name, { type: 'application/pdf' });
  Object.defineProperty(pdf, 'size', { value: size });
  return pdf;
};

beforeEach(() => vi.clearAllMocks());

describe('the public Outil PDF', () => {
  it('refuses a file over 100 Mo, by name, and takes the others', async () => {
    const { wrap } = createTestTRPC({});
    render(withIntl(wrap(<PublicPdfToolView engine={engine} />)));
    fireEvent.change(screen.getByLabelText(/Ajouter des fichiers/), {
      target: { files: [file('scan-geant.pdf', 101 * 1024 * 1024), file('passeport.pdf', 2_000_000)] },
    });
    expect(await screen.findByText(/« scan-geant.pdf » dépasse 100 Mo/)).toBeInTheDocument();
    expect(await screen.findByText(/2 pages/)).toBeInTheDocument();
  });

  it('asks a signed-out visitor to sign in to compress, keeping the pages', async () => {
    const { wrap } = createTestTRPC({});
    render(withIntl(wrap(<PublicPdfToolView engine={engine} />)));
    expect(screen.getByText(/Compresser demande un compte gratuit : 10 compressions par mois/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Ajouter des fichiers/), { target: { files: [file('passeport.pdf', 2_000_000)] } });
    await screen.findByText(/2 pages/);
    fireEvent.click(screen.getByRole('button', { name: /Compresser/ }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/connexion?next=%2Foutils%2Fpdf'));
    expect(screen.getByText(/2 pages/)).toBeInTheDocument();
  });
});
