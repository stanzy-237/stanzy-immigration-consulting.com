// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { BlogEditorView } from '@/features/blog/views/blog-editor-view';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/**
 * Seam: the Blog section's editor as the consultant uses it. Its data is in
 * the cache as the route prefetches it; stubs answer and record what the page
 * sends. The rich-text body is the real editor, only read here, never typed into.
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
beforeEach(() => {
  vi.clearAllMocks();
  trpc.article = undefined;
  trpc.create.mockResolvedValue({ id: 'post_9' });
  trpc.update.mockResolvedValue({ id: 'post_7' });
  trpc.publish.mockResolvedValue(undefined);
});

/** The editor as its route serves it: categories and tags prefetched, and the Article when it has an `id`. */
const editor = (id?: string) => {
  const { trpc: api, queryClient, wrap } = createTestTRPC({
    'blog.dashboard.create': (input) => trpc.create(input),
    'blog.dashboard.update': (input) => trpc.update(input),
    'blog.dashboard.publish': (input) => trpc.publish(input),
    'blog.dashboard.unpublish': (input) => trpc.unpublish(input),
    'blog.dashboard.delete': (input) => trpc.remove(input),
    // What saving invalidates comes back the same.
    'blog.dashboard.get': () => trpc.article,
    'blog.dashboard.tags': () => ['tcf', 'nclc'],
    'blog.dashboard.list': () => [],
    'blog.dashboard.summary': () => ({ drafts: 0, published: 0, lastPublished: null }),
  });
  queryClient.setQueryData(api.blog.categories.queryKey(), CATEGORIES);
  queryClient.setQueryData(api.blog.dashboard.tags.queryKey(), ['tcf', 'nclc']);
  if (id) queryClient.setQueryData(api.blog.dashboard.get.queryKey({ id }), trpc.article as never);
  return render(withIntl(wrap(<BlogEditorView id={id} />)));
};

const field = (name: string) => screen.getByLabelText(name);
const type = (name: string, value: string) => fireEvent.change(field(name), { target: { value } });

describe('BlogEditorView — a new Article', () => {
  it('suggests the address from the title and saves the draft', async () => {
    editor();

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
    editor();
    type('Adresse (slug)', 'tcf-guide');
    type('Titre', 'Réussir le TCF Canada');
    expect(field('Adresse (slug)')).toHaveValue('tcf-guide');
  });

  it('takes the cover from an image address when uploads are unavailable', async () => {
    editor();
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
    editor();
    type('Titre', 'Réussir le TCF Canada');
    fireEvent.change(field('Catégorie'), { target: { value: 'cat_lang' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));

    expect(await screen.findByText('Cette adresse est déjà utilisée par un autre article.')).toBeInTheDocument();
    expect(field('Adresse (slug)')).toHaveAttribute('aria-invalid', 'true');
  });

  it('refuses to publish without content and a category, and says what is missing', () => {
    editor();
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
    editor('post_7');

    expect(field('Titre')).toHaveValue('Réussir le TCF Canada');
    expect(screen.getByText('Brouillon')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Publier' }));

    await waitFor(() => expect(trpc.publish).toHaveBeenCalledWith({ id: 'post_7' }));
    expect(trpc.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'post_7', slug: 'reussir-le-tcf-canada', tags: ['tcf'] }));
    expect(await screen.findByRole('button', { name: 'Dépublier' })).toBeInTheDocument();
    expect(screen.getByText('Publié')).toBeInTheDocument();
  });

  it('confirms each step with a toast: saved, then published', async () => {
    trpc.article = DRAFT;
    editor('post_7');

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(await screen.findByText('Article enregistré')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Publier' }));
    expect(await screen.findByText('Article publié')).toBeInTheDocument();
  });

  it('says in a toast when saving fails for a reason the form can’t show', async () => {
    trpc.article = DRAFT;
    trpc.update.mockRejectedValue(new Error('INTERNAL_SERVER_ERROR'));
    editor('post_7');

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }));
    expect(await screen.findByText('L’enregistrement a échoué. Réessayez.')).toBeInTheDocument();
    expect(screen.queryByText('Article enregistré')).not.toBeInTheDocument();
  });

  it('refuses to publish while an image has no alt text', () => {
    trpc.article = {
      ...DRAFT,
      content: { type: 'doc', content: [paragraph('Texte.'), { type: 'image', attrs: { src: 'https://a.public.blob.vercel-storage.com/x.png', alt: '' } }] },
    };
    editor('post_7');
    fireEvent.click(screen.getByRole('button', { name: 'Publier' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Pour publier : le texte alternatif de chaque image.');
    expect(trpc.publish).not.toHaveBeenCalled();
  });

  it('warns before changing the address of a published Article', () => {
    trpc.article = { ...DRAFT, status: 'PUBLISHED', publishedAt: new Date('2026-10-21T09:00:00Z') };
    editor('post_7');
    expect(screen.getByText('Cet article est publié : changer son adresse cassera les liens déjà partagés.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Supprimer le brouillon' })).not.toBeInTheDocument();
  });

  it('previews the Article as visitors will read it', () => {
    trpc.article = DRAFT;
    editor('post_7');
    fireEvent.click(screen.getByRole('button', { name: 'Aperçu' }));
    const preview = screen.getByRole('article');
    expect(within(preview).getByRole('heading', { level: 1, name: 'Réussir le TCF Canada' })).toBeInTheDocument();
    expect(within(preview).getByText('Le TCF Canada est reconnu par IRCC.')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    trpc.article = DRAFT;
    const { container } = editor('post_7');
    expect(await axe(container)).toHaveNoViolations();
  });
});
