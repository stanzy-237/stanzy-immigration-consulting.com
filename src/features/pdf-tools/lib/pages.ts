/**
 * The Outils PDF's working document (#79): the files added (`Source`) and
 * the pages to output, in order, each pointing back to its source page with
 * a rotation. Pure: every change returns a new list.
 */
export type SourceKind = 'pdf' | 'image';

export type Source = {
  id: string;
  name: string;
  kind: SourceKind;
  /** A PDF as is; a photo already turned into JPEG or PNG bytes. */
  bytes: ArrayBuffer;
  mime: 'application/pdf' | 'image/jpeg' | 'image/png';
  pageCount: number;
};

export type Rotation = 0 | 90 | 180 | 270;

export type Page = {
  id: string;
  sourceId: string;
  /** The page's index in its source (0 for a photo). */
  index: number;
  rotation: Rotation;
};

let next = 0;
const pageId = () => `p${Date.now().toString(36)}${(next++).toString(36)}`;

/** Every page of `source`, appended. */
export const withSource = (pages: Page[], source: Source): Page[] => [
  ...pages,
  ...Array.from({ length: source.pageCount }, (_, index) => ({
    id: pageId(),
    sourceId: source.id,
    index,
    rotation: 0 as Rotation,
  })),
];

/** The page moved to `to` (clamped), the others shifting around it. */
export function moved(pages: Page[], id: string, to: number): Page[] {
  const from = pages.findIndex((page) => page.id === id);
  if (from === -1) return pages;
  const target = Math.max(0, Math.min(pages.length - 1, to));
  const rest = pages.filter((page) => page.id !== id);
  return [...rest.slice(0, target), pages[from]!, ...rest.slice(target)];
}

/** A quarter turn clockwise (`1`) or counter-clockwise (`-1`). */
export const rotated = (pages: Page[], id: string, turn: 1 | -1): Page[] =>
  pages.map((page) =>
    page.id === id ? { ...page, rotation: ((((page.rotation + turn * 90) % 360) + 360) % 360) as Rotation } : page,
  );

export const withoutPage = (pages: Page[], id: string): Page[] => pages.filter((page) => page.id !== id);

/** IRCC's limit per uploaded file. */
export const IRCC_MAX_BYTES = 4 * 1024 * 1024;
