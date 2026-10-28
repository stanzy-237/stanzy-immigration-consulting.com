// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { BlogEditorView } from '@/features/blog/views/blog-editor-view';

/**
 * Seam: the Blog section's editor as the consultant uses it. The tRPC client
 * is replaced by stubs that record what the page sends; the rich-text body
 * is the real editor, only read here, never typed into.
 */
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const CATEGORIES = [
  { id: 'cat_ee', slug: 'entree-express', nameFr: 'Entrée Express', nameEn: 'Express Entry' },
  { id: 'cat_lang', slug: 'langue', nameFr: 'Langue', nameEn: 'Language' },
];
const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const DRAFT = {
  id: 'post_7',
  slug: 'reussir-le-tcf-canada',
  locale: 'fr',
  title: 'Réussir le TCF Canada',
  excerpt: null,
  content: { type: 'doc', content: [paragraph('Le TCF Canada est reconnu par IRCC.')] },
  coverUrl: null,
  coverAlt: null,
  categoryId: 'cat_lang',
  tags: ['tcf'],
  seoTitle: null,
  seoDescription: null,
  status: 'DRAFT' as const,
  publishedAt: null as Date | null,
  html: '<p>Le TCF Canada est reconnu par IRCC.</p>',
};

const trpc = vi.hoisted(() => ({
  article: undefined as unknown,
  create: vi.fn(),
  update: vi.fn(),
  publish: vi.fn(),
  unpublish: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('@/trpc/react', () => {
  const mutation = (fn: (input: unknown) => unknown) => () => ({ mutateAsync: fn, isPending: false });
  return {
  api: {
    useUtils: () => ({ blog: { dashboard: { invalidate: vi.fn() } } }),
    blog: {
      categories: { useQuery: () => ({ data: CATEGORIES }) },
      dashboard: {
        get: { useQuery: () => ({ data: trpc.article, isLoading: false, isError: false }) },
        tags: { useQuery: () => ({ data: ['tcf', 'nclc'] }) },
        create: { useMutation: mutation((input) => trpc.create(input)) },
        update: { useMutation: mutation((input) => trpc.update(input)) },
        publish: { useMutation: mutation((input) => trpc.publish(input)) },
        unpublish: { useMutation: mutation((input) => trpc.unpublish(input)) },
        delete: { useMutation: mutation((input) => trpc.remove(input)) },
      },
    },
  },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  trpc.article = undefined;
  trpc.create.mockResolvedValue({ id: 'post_9' });
  trpc.update.mockResolvedValue({ id: 'post_7' });
  trpc.publish.mockResolvedValue(undefined);
});

const field = (name: string) => screen.getByLabelText(name);
const type = (name: string, value: string) => fireEvent.change(field(name), { target: { value } });

describe('BlogEditorView — a new Article', () => {
  it('suggests the address from the title and saves the draft', async () => {
    render(withIntl(<BlogEditorView />));

    type('Titre', 'Réussir le TCF Canada !');
    expect(field('Adresse (slug)')).toHaveValue('reussir-le-tcf-canada');
    fireEvent.change(field('Catégorie'), { target: { value: 'cat_lang' } });
    type('Tags', 'TCF, nclc');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));

    await waitFor(() => expect(trpc.create).toHaveBeenCalledTimes(1));
    expect(trpc.create.mock.calls[0]![0]).toMatchObject({
      title: 'Réussir le TCF Canada !',
      slug: 'reussir-le-tcf-canada',
      locale: 'fr',
      categoryId: 'cat_lang',
      tags: ['TCF', 'nclc'],
      content: { type: 'doc' },
    });
    expect(router.replace).toHaveBeenCalledWith('/blog/post_9');
  });

  it('keeps an address the consultant typed when the title changes', () => {
    render(withIntl(<BlogEditorView />));
    type('Adresse (slug)', 'tcf-guide');
    type('Titre', 'Réussir le TCF Canada');
    expect(field('Adresse (slug)')).toHaveValue('tcf-guide');
  });

  it('takes the cover from an image address when uploads are unavailable', async () => {
    render(withIntl(<BlogEditorView />));
    type('Titre', 'Tirage francophone du 27 octobre');
    fireEvent.change(field('Catégorie'), { target: { value: 'cat_ee' } });
    type('Adresse de l’image de couverture', '/blog/covers/tirage-francophone.jpg');
    type('Texte alternatif de la couverture', 'Stanzy annonce le tirage');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));

    await waitFor(() => expect(trpc.create).toHaveBeenCalledTimes(1));
    expect(trpc.create.mock.calls[0]![0]).toMatchObject({
      coverUrl: '/blog/covers/tirage-francophone.jpg',
      coverAlt: 'Stanzy annonce le tirage',
    });
  });

  it('shows a taken address next to the address field', async () => {
    trpc.create.mockRejectedValue(new Error('BLOG_SLUG_TAKEN'));
    render(withIntl(<BlogEditorView />));
    type('Titre', 'Réussir le TCF Canada');
    fireEvent.change(field('Catégorie'), { target: { value: 'cat_lang' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));

    expect(await screen.findByText('Cette adresse est déjà utilisée par un autre article.')).toBeInTheDocument();
    expect(field('Adresse (slug)')).toHaveAttribute('aria-invalid', 'true');
  });

  it('refuses to publish without content and a category, and says what is missing', () => {
    render(withIntl(<BlogEditorView />));
    type('Titre', 'Réussir le TCF Canada');
    fireEvent.click(screen.getByRole('button', { name: 'Publier' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Pour publier : du contenu, une catégorie.');
    expect(trpc.create).not.toHaveBeenCalled();
    expect(trpc.publish).not.toHaveBeenCalled();
  });
});

describe('BlogEditorView — an existing Article', () => {
  it('saves then publishes, and offers to unpublish', async () => {
    trpc.article = DRAFT;
    render(withIntl(<BlogEditorView id="post_7" />));

    expect(field('Titre')).toHaveValue('Réussir le TCF Canada');
    expect(screen.getByText('Brouillon')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Publier' }));

    await waitFor(() => expect(trpc.publish).toHaveBeenCalledWith({ id: 'post_7' }));
    expect(trpc.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'post_7', slug: 'reussir-le-tcf-canada', tags: ['tcf'] }));
    expect(await screen.findByRole('button', { name: 'Dépublier' })).toBeInTheDocument();
    expect(screen.getByText('Publié')).toBeInTheDocument();
  });

  it('refuses to publish while an image has no alt text', () => {
    trpc.article = {
      ...DRAFT,
      content: { type: 'doc', content: [paragraph('Texte.'), { type: 'image', attrs: { src: 'https://a.public.blob.vercel-storage.com/x.png', alt: '' } }] },
    };
    render(withIntl(<BlogEditorView id="post_7" />));
    fireEvent.click(screen.getByRole('button', { name: 'Publier' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Pour publier : le texte alternatif de chaque image.');
    expect(trpc.publish).not.toHaveBeenCalled();
  });

  it('warns before changing the address of a published Article', () => {
    trpc.article = { ...DRAFT, status: 'PUBLISHED', publishedAt: new Date('2026-10-21T09:00:00Z') };
    render(withIntl(<BlogEditorView id="post_7" />));
    expect(screen.getByText('Cet article est publié : changer son adresse cassera les liens déjà partagés.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Supprimer le brouillon' })).not.toBeInTheDocument();
  });

  it('previews the Article as visitors will read it', () => {
    trpc.article = DRAFT;
    render(withIntl(<BlogEditorView id="post_7" />));
    fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }));
    const preview = screen.getByRole('article');
    expect(within(preview).getByRole('heading', { level: 1, name: 'Réussir le TCF Canada' })).toBeInTheDocument();
    expect(within(preview).getByText('Le TCF Canada est reconnu par IRCC.')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    trpc.article = DRAFT;
    const { container } = render(withIntl(<BlogEditorView id="post_7" />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
