import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionFor } from '@/server/auth/__tests__/fixtures';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createCaller } from '@/server/trpc/root';

/**
 * Seam: the `blog` tRPC router through a server-side caller. The database is
 * an in-memory stand-in for the Article and Catégorie d'article tables.
 * The page cache is outside the seam: invalidating it is a no-op here.
 */
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

/** Publishing stamps the current time: tests set it. */
const at = (iso: string) => vi.setSystemTime(new Date(iso));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  at('2026-10-20T08:00:00Z');
});
afterEach(() => {
  vi.useRealTimers();
});

type CategoryRow = { id: string; slug: string; nameFr: string; nameEn: string; position: number; createdAt: Date; updatedAt: Date };
type PostRow = {
  id: string;
  slug: string;
  locale: string;
  title: string;
  excerpt: string | null;
  content: unknown;
  coverUrl: string | null;
  coverAlt: string | null;
  categoryId: string;
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: Date | null;
  readingMinutes: number;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
};

const CONSULTANT = sessionFor({ id: 'acc_stanzy', name: 'Stanzy', email: 'stanzy@example.com', role: 'CONSULTANT' });
const MEMBER = sessionFor();

function fakeDatabase() {
  let clock = Date.parse('2026-10-20T08:00:00Z');
  const tick = () => new Date((clock += 60_000));
  const categories: CategoryRow[] = [
    { id: 'cat_ee', slug: 'entree-express', nameFr: 'Entrée Express', nameEn: 'Express Entry', position: 0, createdAt: tick(), updatedAt: tick() },
    { id: 'cat_lang', slug: 'tests-de-langue', nameFr: 'Tests de langue', nameEn: 'Language tests', position: 1, createdAt: tick(), updatedAt: tick() },
  ];
  const posts: PostRow[] = [];
  const authors: Record<string, { name: string }> = { acc_stanzy: { name: 'Stanzy' } };

  type Unique = { id?: string; slug?: string };
  const byUnique = <R extends { id: string; slug: string }>(rows: R[], where: Unique) =>
    rows.find((r) => (where.id !== undefined ? r.id === where.id : r.slug === where.slug)) ?? null;
  type Include = { category?: boolean; author?: unknown };
  const withRelations = (row: PostRow, include?: Include) => ({
    ...row,
    ...(include?.category ? { category: categories.find((c) => c.id === row.categoryId)! } : {}),
    ...(include?.author ? { author: authors[row.authorId] ?? { name: '' } } : {}),
  });
  type PostWhere = { status?: PostRow['status']; categoryId?: string };
  const postMatches = (row: PostRow, where: PostWhere = {}) =>
    (where.status === undefined || row.status === where.status) &&
    (where.categoryId === undefined || row.categoryId === where.categoryId);

  const blogPost = {
    async findMany({ where, include }: { where?: PostWhere; include?: Include } = {}) {
      return posts.filter((r) => postMatches(r, where)).map((r) => withRelations(r, include));
    },
    async findUnique({ where, include }: { where: Unique; include?: Include }) {
      const row = byUnique(posts, where);
      return row ? withRelations(row, include) : null;
    },
    async count({ where }: { where?: PostWhere } = {}) {
      return posts.filter((r) => postMatches(r, where)).length;
    },
    async create({ data }: { data: Omit<PostRow, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'publishedAt'> }) {
      const now = tick();
      const row: PostRow = { status: 'DRAFT', publishedAt: null, ...data, id: `post_${posts.length + 1}`, createdAt: now, updatedAt: now };
      posts.push(row);
      return row;
    },
    async update({ where, data }: { where: { id: string }; data: Partial<PostRow> }) {
      const row = byUnique(posts, where)!;
      return Object.assign(row, data, { updatedAt: tick() });
    },
    async delete({ where }: { where: { id: string } }) {
      const i = posts.findIndex((r) => r.id === where.id);
      return posts.splice(i, 1)[0];
    },
  };

  const blogCategory = {
    async findMany() {
      return categories.toSorted((a, b) => a.position - b.position);
    },
    async findUnique({ where }: { where: Unique }) {
      return byUnique(categories, where);
    },
    async create({ data }: { data: Omit<CategoryRow, 'id' | 'createdAt' | 'updatedAt'> }) {
      const now = tick();
      const row = { ...data, id: `cat_${categories.length + 1}`, createdAt: now, updatedAt: now };
      categories.push(row);
      return row;
    },
    async update({ where, data }: { where: { id: string }; data: Partial<CategoryRow> }) {
      return Object.assign(byUnique(categories, where)!, data, { updatedAt: tick() });
    },
    async delete({ where }: { where: { id: string } }) {
      const i = categories.findIndex((r) => r.id === where.id);
      return categories.splice(i, 1)[0];
    },
  };

  return { prisma: { blogPost, blogCategory } as unknown as TRPCContext['prisma'], posts, categories };
}

const callerAs = (db: ReturnType<typeof fakeDatabase>, session: CurrentSession | null) =>
  createCaller({ prisma: db.prisma, headers: new Headers(), session });

const body = (...words: string[]) => ({
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text: words.join(' ') }] }],
});

const article = (overrides: Record<string, unknown> = {}) => ({
  slug: 'reussir-le-tcf-canada',
  locale: 'fr' as const,
  title: 'Réussir le TCF Canada',
  excerpt: null,
  content: body('Le TCF Canada est reconnu par IRCC.'),
  coverUrl: null,
  coverAlt: null,
  categoryId: 'cat_lang',
  tags: ['TCF Canada', 'nclc'],
  seoTitle: null,
  seoDescription: null,
  ...overrides,
});

describe('blog router — access', () => {
  it('refuses the dashboard procedures to visitors and to Users who are not the consultant', async () => {
    const db = fakeDatabase();
    const visitor = callerAs(db, null);
    const member = callerAs(db, MEMBER);

    await expect(visitor.blog.admin.list({})).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(visitor.blog.admin.create(article())).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(member.blog.admin.list({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(member.blog.admin.create(article())).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(member.blog.admin.summary()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(member.blog.admin.categories.delete({ id: 'cat_ee' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.posts).toHaveLength(0);
  });

  it('lets anyone read the published Blog', async () => {
    const visitor = callerAs(fakeDatabase(), null);
    await expect(visitor.blog.list({ locale: 'fr' })).resolves.toMatchObject({ items: [], total: 0 });
    await expect(visitor.blog.categories()).resolves.toHaveLength(2);
  });
});

describe('blog router — Brouillon to Publié', () => {
  it('keeps a draft off the public Blog until it is published', async () => {
    const db = fakeDatabase();
    const stanzy = callerAs(db, CONSULTANT);
    const visitor = callerAs(db, null);

    const { id } = await stanzy.blog.admin.create(article());
    expect(await visitor.blog.list({ locale: 'fr' })).toMatchObject({ items: [], total: 0 });
    await expect(visitor.blog.bySlug({ slug: 'reussir-le-tcf-canada' })).rejects.toMatchObject({ code: 'NOT_FOUND' });

    at('2026-10-21T09:00:00Z');
    await stanzy.blog.admin.publish({ id });
    const listed = await visitor.blog.list({ locale: 'fr' });
    expect(listed.items.map((item) => item.slug)).toEqual(['reussir-le-tcf-canada']);
    const read = await visitor.blog.bySlug({ slug: 'reussir-le-tcf-canada' });
    expect(read).toMatchObject({
      title: 'Réussir le TCF Canada',
      html: '<p>Le TCF Canada est reconnu par IRCC.</p>',
      excerpt: 'Le TCF Canada est reconnu par IRCC.',
      authorName: 'Stanzy',
      category: { slug: 'tests-de-langue', nameFr: 'Tests de langue' },
    });
    expect(read.publishedAt.toISOString()).toBe('2026-10-21T09:00:00.000Z');
  });

  it('keeps the first publish date through later edits, unpublishing and republishing', async () => {
    const db = fakeDatabase();
    const stanzy = callerAs(db, CONSULTANT);
    const { id } = await stanzy.blog.admin.create(article());
    at('2026-10-21T09:00:00Z');
    await stanzy.blog.admin.publish({ id });

    at('2026-10-25T09:00:00Z');
    await stanzy.blog.admin.update({ id, ...article({ title: 'Réussir le TCF Canada (mise à jour)' }) });
    await stanzy.blog.admin.unpublish({ id });
    await expect(callerAs(db, null).blog.bySlug({ slug: 'reussir-le-tcf-canada' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await stanzy.blog.admin.publish({ id });

    expect(db.posts[0]).toMatchObject({ status: 'PUBLISHED', title: 'Réussir le TCF Canada (mise à jour)' });
    expect(db.posts[0]!.publishedAt?.toISOString()).toBe('2026-10-21T09:00:00.000Z');
  });

  it('deletes a draft but refuses to delete a published Article', async () => {
    const db = fakeDatabase();
    const stanzy = callerAs(db, CONSULTANT);
    const draft = await stanzy.blog.admin.create(article({ slug: 'brouillon' }));
    const live = await stanzy.blog.admin.create(article());
    await stanzy.blog.admin.publish({ id: live.id });

    await expect(stanzy.blog.admin.delete({ id: live.id })).rejects.toMatchObject({ message: 'BLOG_DELETE_PUBLISHED' });
    await stanzy.blog.admin.delete({ id: draft.id });
    expect(db.posts.map((p) => p.slug)).toEqual(['reussir-le-tcf-canada']);
  });

  it('computes the reading time and normalises the tags on save', async () => {
    const db = fakeDatabase();
    const stanzy = callerAs(db, CONSULTANT);
    // 401 words at 200 a minute: 3 minutes.
    await stanzy.blog.admin.create(article({ content: body(...Array<string>(401).fill('mot')), tags: ['TCF Canada', ' nclc ', 'tcf-canada', 'Équivalence'] }));
    expect(db.posts[0]).toMatchObject({ readingMinutes: 3, tags: ['tcf-canada', 'nclc', 'equivalence'] });
  });

  it('counts drafts and published Articles for the Aperçu', async () => {
    const db = fakeDatabase();
    const stanzy = callerAs(db, CONSULTANT);
    await stanzy.blog.admin.create(article({ slug: 'un' }));
    const two = await stanzy.blog.admin.create(article({ slug: 'deux', title: 'Deux' }));
    await stanzy.blog.admin.create(article({ slug: 'trois' }));
    await stanzy.blog.admin.publish({ id: two.id });

    expect(await stanzy.blog.admin.summary()).toMatchObject({
      drafts: 2,
      published: 1,
      lastPublished: { id: two.id, title: 'Deux' },
    });
  });
});

describe('blog router — slugs and categories', () => {
  it('refuses a slug another Article already uses', async () => {
    const db = fakeDatabase();
    const stanzy = callerAs(db, CONSULTANT);
    const first = await stanzy.blog.admin.create(article());
    const second = await stanzy.blog.admin.create(article({ slug: 'autre' }));

    await expect(stanzy.blog.admin.create(article())).rejects.toMatchObject({ message: 'BLOG_SLUG_TAKEN' });
    await expect(stanzy.blog.admin.update({ id: second.id, ...article() })).rejects.toMatchObject({ message: 'BLOG_SLUG_TAKEN' });
    // Saving an Article with its own slug is fine.
    await expect(stanzy.blog.admin.update({ id: first.id, ...article({ title: 'Nouveau titre' }) })).resolves.toBeDefined();
  });

  it('refuses a slug that is not lowercase words joined by hyphens', async () => {
    const stanzy = callerAs(fakeDatabase(), CONSULTANT);
    await expect(stanzy.blog.admin.create(article({ slug: 'Réussir le TCF' }))).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('refuses to delete a category an Article still uses', async () => {
    const db = fakeDatabase();
    const stanzy = callerAs(db, CONSULTANT);
    await stanzy.blog.admin.create(article());

    await expect(stanzy.blog.admin.categories.delete({ id: 'cat_lang' })).rejects.toMatchObject({ message: 'BLOG_CATEGORY_IN_USE' });
    await stanzy.blog.admin.categories.delete({ id: 'cat_ee' });
    expect(db.categories.map((c) => c.slug)).toEqual(['tests-de-langue']);
  });

  it('adds and renames categories', async () => {
    const db = fakeDatabase();
    const stanzy = callerAs(db, CONSULTANT);
    const { id } = await stanzy.blog.admin.categories.create({ slug: 'etudes', nameFr: 'Études', nameEn: 'Studies' });
    await stanzy.blog.admin.categories.update({ id, slug: 'etudes', nameFr: 'Études au Canada', nameEn: 'Studying in Canada' });
    expect(db.categories.at(-1)).toMatchObject({ slug: 'etudes', nameFr: 'Études au Canada', position: 2 });
    await expect(
      stanzy.blog.admin.categories.create({ slug: 'etudes', nameFr: 'x', nameEn: 'x' }),
    ).rejects.toMatchObject({ message: 'BLOG_SLUG_TAKEN' });
  });
});

describe('blog router — the public Blog', () => {
  /** 14 French Articles a day apart (the last two in Entrée Express), then 2 English ones. */
  async function seededBlog() {
    const db = fakeDatabase();
    const stanzy = callerAs(db, CONSULTANT);
    for (let n = 1; n <= 16; n++) {
      const english = n > 14;
      const { id } = await stanzy.blog.admin.create(
        article({
          slug: `article-${n}`,
          title: `Article ${n}`,
          locale: english ? 'en' : 'fr',
          categoryId: n === 13 || n === 14 ? 'cat_ee' : 'cat_lang',
          tags: n % 2 ? ['tcf'] : ['ielts'],
        }),
      );
      at(`2026-10-${String(n).padStart(2, '0')}T08:00:00Z`);
      await stanzy.blog.admin.publish({ id });
    }
    return callerAs(db, null);
  }

  it('lists newest first, 12 to a page, with the total', async () => {
    const visitor = await seededBlog();
    const first = await visitor.blog.list({ locale: 'fr' });
    expect(first.total).toBe(14);
    expect(first.items.map((i) => i.slug)).toEqual([14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3].map((n) => `article-${n}`));
    const second = await visitor.blog.list({ locale: 'fr', page: 2 });
    expect(second.items.map((i) => i.slug)).toEqual(['article-2', 'article-1']);
  });

  it('filters by category and by tag', async () => {
    const visitor = await seededBlog();
    expect((await visitor.blog.list({ locale: 'fr', category: 'entree-express' })).items.map((i) => i.slug)).toEqual([
      'article-14',
      'article-13',
    ]);
    const tcf = await visitor.blog.list({ locale: 'fr', tag: 'tcf' });
    expect(tcf.total).toBe(7);
    expect(tcf.items.every((i) => i.tags.includes('tcf'))).toBe(true);
  });

  it('shows English Articles first in the English Blog, then the French ones', async () => {
    const visitor = await seededBlog();
    const english = await visitor.blog.list({ locale: 'en' });
    expect(english.total).toBe(16);
    expect(english.items.slice(0, 3).map((i) => [i.slug, i.locale])).toEqual([
      ['article-16', 'en'],
      ['article-15', 'en'],
      ['article-14', 'fr'],
    ]);
    // The French Blog has no English Articles.
    expect((await visitor.blog.list({ locale: 'fr' })).items.some((i) => i.locale === 'en')).toBe(false);
  });
});
