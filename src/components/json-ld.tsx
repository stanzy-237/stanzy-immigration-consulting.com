import type { ReactNode } from 'react';

/**
 * Structured data (schema.org) for search and AI engines, as a JSON-LD script.
 * `<` is escaped so a value can never close the script tag.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }): ReactNode {
  return (
    <script
      type="application/ld+json"
      // JSON, with `<` escaped: the only way to emit JSON-LD.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
