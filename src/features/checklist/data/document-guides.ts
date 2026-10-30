import { DOCUMENT_GUIDES_EN } from '@/features/checklist/data/document-guides-en';
import { DOCUMENT_GUIDES_FR } from '@/features/checklist/data/document-guides-fr';
import type { DocumentId } from '@/features/checklist/lib/build-checklist';
import type { GuideBlock } from '@/features/shared/lib/guide-blocks';
import type { Locale } from '@/i18n/routing';

/** A document of the Checklist: its name (the button), one line under it, and its « En savoir plus » guide. */
export type DocumentGuide = { name: string; summary: string; blocks: GuideBlock[] };
export type DocumentGuides = Record<DocumentId, DocumentGuide>;

export const DOCUMENT_GUIDES: Record<Locale, DocumentGuides> = {
  fr: DOCUMENT_GUIDES_FR,
  en: DOCUMENT_GUIDES_EN,
};
