import { describe, expect, it } from 'vitest';

import { renderArticle, type ArticleDoc } from '@/features/blog/lib/render-article';

/**
 * Seam: the Article renderer, from the stored rich-text document (Tiptap
 * JSON) to the HTML visitors get, its plain-text excerpt and reading time.
 * Expected HTML is written out by hand.
 */

const text = (value: string, marks?: unknown[]) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
const paragraph = (...content: unknown[]) => ({ type: 'paragraph', content });
const doc = (...content: unknown[]) => ({ type: 'doc', content }) as ArticleDoc;

describe('renderArticle — HTML', () => {
  it('renders headings, paragraphs, marks, lists, quotes and images', () => {
    const { html } = renderArticle(
      doc(
        { type: 'heading', attrs: { level: 2 }, content: [text('Le TCF Canada')] },
        paragraph(text('Un test '), text('reconnu', [{ type: 'bold' }]), text(' par '), text('IRCC', [{ type: 'italic' }]), text('.')),
        { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('Oral'))] }] },
        { type: 'orderedList', content: [{ type: 'listItem', content: [paragraph(text('Écrit'))] }] },
        { type: 'blockquote', content: [paragraph(text('Préparez-vous tôt'))] },
        { type: 'image', attrs: { src: 'https://abc.public.blob.vercel-storage.com/blog/tcf.webp', alt: 'Salle d’examen' } },
      ),
    );

    expect(html).toBe(
      '<h2>Le TCF Canada</h2>' +
        '<p>Un test <strong>reconnu</strong> par <em>IRCC</em>.</p>' +
        '<ul><li><p>Oral</p></li></ul>' +
        '<ol><li><p>Écrit</p></li></ol>' +
        '<blockquote><p>Préparez-vous tôt</p></blockquote>' +
        '<figure><img src="https://abc.public.blob.vercel-storage.com/blog/tcf.webp" alt="Salle d’examen" loading="lazy"></figure>',
    );
  });

  it('opens external links in a new tab and keeps site links in place', () => {
    const { html } = renderArticle(
      doc(
        paragraph(
          text('IRCC', [{ type: 'link', attrs: { href: 'https://www.canada.ca/fr.html' } }]),
          text(' et '),
          text('le calculateur', [{ type: 'link', attrs: { href: '/outils/crs' } }]),
          text(' ou '),
          text('écrivez-moi', [{ type: 'link', attrs: { href: 'mailto:contact@stanzy.ca' } }]),
        ),
      ),
    );

    expect(html).toBe(
      '<p><a href="https://www.canada.ca/fr.html" target="_blank" rel="noopener noreferrer">IRCC</a>' +
        ' et <a href="/outils/crs">le calculateur</a>' +
        ' ou <a href="mailto:contact@stanzy.ca">écrivez-moi</a></p>',
    );
  });

  it('escapes text, so stored text can never become markup', () => {
    const { html } = renderArticle(doc(paragraph(text('<script>alert("x")</script> & co'))));
    expect(html).toBe('<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co</p>');
  });

  it('drops a link to an unsafe address but keeps its text', () => {
    const { html } = renderArticle(
      doc(
        paragraph(
          text('clic', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]),
          text(' '),
          text('ailleurs', [{ type: 'link', attrs: { href: '//evil.example/x' } }]),
        ),
      ),
    );
    expect(html).toBe('<p>clic ailleurs</p>');
  });

  it('drops unknown nodes and marks, images without alt text and images not served over https or from the site', () => {
    const { html } = renderArticle(
      doc(
        { type: 'iframe', attrs: { src: 'https://evil.example' } },
        paragraph(text('gardé', [{ type: 'onclick' }, { type: 'bold' }])),
        { type: 'image', attrs: { src: 'https://a.example/x.png', alt: '' } },
        { type: 'image', attrs: { src: 'http://a.example/x.png', alt: 'Sans https' } },
        { type: 'heading', attrs: { level: 1 }, content: [text('Un H1 devient H2')] },
      ),
    );
    expect(html).toBe('<p><strong>gardé</strong></p><h2>Un H1 devient H2</h2>');
  });

  it('keeps an image served from the site itself', () => {
    const { html } = renderArticle(
      doc(
        { type: 'image', attrs: { src: '/blog/covers/cnps.jpg', alt: 'Relevé CNPS' } },
        { type: 'image', attrs: { src: '//evil.example/x.png', alt: 'Ailleurs' } },
      ),
    );
    expect(html).toBe('<figure><img src="/blog/covers/cnps.jpg" alt="Relevé CNPS" loading="lazy"></figure>');
  });
});

describe('renderArticle — text', () => {
  it('gives the plain text for the excerpt fallback, cut on a word at 160 characters', () => {
    const long = 'mot '.repeat(60).trim(); // 239 characters
    const { excerpt } = renderArticle(doc({ type: 'heading', attrs: { level: 2 }, content: [text('Titre')] }, paragraph(text(long))));
    // « Titre » + 38 × « mot » is 6 + 38 × 3 + 37 spaces = 157 characters; a
    // 39th word would make 161. With the ellipsis: 158, within 160.
    expect(excerpt).toBe(`Titre ${'mot '.repeat(38).trim()}…`);
  });

  it('keeps a short text whole', () => {
    expect(renderArticle(doc(paragraph(text('Bonjour à tous.')))).excerpt).toBe('Bonjour à tous.');
  });

  it('reads at 200 words a minute, rounded up, and never less than a minute', () => {
    expect(renderArticle(doc(paragraph(text('mot '.repeat(401).trim())))).readingMinutes).toBe(3);
    expect(renderArticle(doc(paragraph(text('court')))).readingMinutes).toBe(1);
    expect(renderArticle(doc()).readingMinutes).toBe(1);
  });
});
