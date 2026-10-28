/**
 * An Article's body as the editor (Tiptap) stores it. Loosely typed on
 * purpose: it comes back from the database, so every field is checked here
 * before it reaches the page.
 */
export type ArticleNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ArticleNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};
export type ArticleDoc = { type: 'doc'; content?: ArticleNode[] };

export type RenderedArticle = {
  /** Safe HTML: only the elements below, every text and attribute escaped. */
  html: string;
  /** The plain text, cut on a word to fit 160 characters with « … ». */
  excerpt: string;
  readingMinutes: number;
};

export const EMPTY_ARTICLE: ArticleDoc = { type: 'doc', content: [] };

const EXCERPT_LENGTH = 160;
const WORDS_PER_MINUTE = 200;

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** A link the page may carry: http(s), mailto, or a path on this site (not `//host`). */
export function safeHref(value: unknown): string | null {
  const href = asString(value);
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) return href;
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  return null;
}

const isExternal = (href: string) => /^https?:\/\//i.test(href);

function renderText(node: ArticleNode): string {
  let html = escape(node.text ?? '');
  // Marks wrap inside out: bold and italic first, the link outermost.
  const marks = node.marks ?? [];
  if (marks.some((m) => m.type === 'italic')) html = `<em>${html}</em>`;
  if (marks.some((m) => m.type === 'bold')) html = `<strong>${html}</strong>`;
  const link = marks.find((m) => m.type === 'link');
  const href = link ? safeHref(link.attrs?.href) : null;
  if (href) {
    const target = isExternal(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
    html = `<a href="${escape(href)}"${target}>${html}</a>`;
  }
  return html;
}

function renderNode(node: ArticleNode): string {
  const inner = () => (node.content ?? []).map(renderNode).join('');
  switch (node.type) {
    case 'text':
      return renderText(node);
    case 'paragraph':
      return `<p>${inner()}</p>`;
    case 'heading':
      // H1 is the Article's title: body headings are H2 or H3.
      return node.attrs?.level === 3 ? `<h3>${inner()}</h3>` : `<h2>${inner()}</h2>`;
    case 'bulletList':
      return `<ul>${inner()}</ul>`;
    case 'orderedList':
      return `<ol>${inner()}</ol>`;
    case 'listItem':
      return `<li>${inner()}</li>`;
    case 'blockquote':
      return `<blockquote>${inner()}</blockquote>`;
    case 'hardBreak':
      return '<br>';
    case 'image': {
      const src = asString(node.attrs?.src);
      const alt = asString(node.attrs?.alt);
      if (!/^https:\/\//i.test(src) || !alt) return '';
      return `<figure><img src="${escape(src)}" alt="${escape(alt)}" loading="lazy"></figure>`;
    }
    default:
      return '';
  }
}

/** Each block's text, in order; the words of one block joined as written. */
function blockTexts(node: ArticleNode): string[] {
  if (node.type === 'text') return [node.text ?? ''];
  const children = node.content ?? [];
  if (children.every((child) => child.type === 'text' || child.type === 'hardBreak')) {
    return [children.map((child) => (child.type === 'text' ? (child.text ?? '') : ' ')).join('')];
  }
  return children.flatMap(blockTexts);
}

function excerptOf(text: string): string {
  if (text.length <= EXCERPT_LENGTH) return text;
  const words = text.split(' ');
  let cut = '';
  for (const word of words) {
    const next = cut ? `${cut} ${word}` : word;
    if (next.length + 1 > EXCERPT_LENGTH) break;
    cut = next;
  }
  return `${cut}…`;
}

/** The Article's body as safe HTML, with its excerpt fallback and reading time. */
export function renderArticle(doc: ArticleDoc): RenderedArticle {
  const blocks = doc.content ?? [];
  const text = blocks
    .flatMap(blockTexts)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
  const words = text ? text.split(' ').length : 0;
  return {
    html: blocks.map(renderNode).join(''),
    excerpt: excerptOf(text),
    readingMinutes: Math.max(1, Math.ceil(words / WORDS_PER_MINUTE)),
  };
}
