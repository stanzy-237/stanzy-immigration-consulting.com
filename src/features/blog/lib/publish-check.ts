import { renderArticle, type ArticleDoc, type ArticleNode } from '@/features/blog/lib/render-article';

/** What an Article still needs before it can be published, in the order the editor names them. */
export type MissingForPublish = 'title' | 'body' | 'category' | 'coverAlt' | 'imageAlt';

type Draft = { title: string; content: ArticleDoc; categoryId: string; coverUrl: string | null; coverAlt: string | null };

const images = (nodes: ArticleNode[] = []): ArticleNode[] =>
  nodes.flatMap((node) => (node.type === 'image' ? [node] : images(node.content)));

export function missingForPublish(draft: Draft): MissingForPublish[] {
  const allImages = images(draft.content.content);
  const missing: MissingForPublish[] = [];
  if (!draft.title.trim()) missing.push('title');
  if (!renderArticle(draft.content).excerpt && allImages.length === 0) missing.push('body');
  if (!draft.categoryId) missing.push('category');
  if (draft.coverUrl && !draft.coverAlt?.trim()) missing.push('coverAlt');
  if (allImages.some((image) => typeof image.attrs?.alt !== 'string' || !image.attrs.alt.trim())) missing.push('imageAlt');
  return missing;
}
