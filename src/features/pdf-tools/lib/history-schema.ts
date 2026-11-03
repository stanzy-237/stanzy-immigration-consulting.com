import { z } from 'zod';

import { encryptedFileInput } from '@/features/dossiers/lib/document-schema';

/** What was done to make a file, as its history entry shows it. */
export const PDF_CHANGES = ['merged', 'reordered', 'rotated', 'removed', 'compressed'] as const;
export type PdfChange = (typeof PDF_CHANGES)[number];

/** How long a downloaded file stays in the history (#79). */
export const HISTORY_DAYS = 90;

/** Where the consultant's history files sit in the private R2 bucket. */
export const historyFilePrefix = (accountId: string): string => `pdf-tools/${accountId}/`;

export const addHistoryInput = encryptedFileInput.extend({
  contentType: z.literal('application/pdf'),
  pageCount: z.number().int().min(1).max(2000),
  changes: z.array(z.enum(PDF_CHANGES)).max(PDF_CHANGES.length),
  quality: z.number().min(0).max(1).nullable(),
  sourceNames: z.array(z.string().trim().min(1).max(200)).max(50),
});
