import type { ReactNode } from 'react';

/**
 * An Article's body. The HTML comes from `renderArticle`, which only emits
 * an allow-list of elements and escapes every text and attribute, so it is
 * safe to inject. Styled by `.article-body` in globals.css.
 */
export function ArticleBody({ html }: { html: string }): ReactNode {
  return <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />;
}
