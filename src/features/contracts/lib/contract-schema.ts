import { z } from 'zod';

import { SERVICE_TYPES } from '@/features/dossiers/data/workflows';
import { dossierFilePrefix } from '@/features/dossiers/lib/document-schema';
import { CURRENCIES } from '@/features/invoices/lib/money';

/**
 * Contrats (#96): templates written in the Tableau de bord with blanks the
 * app fills in when one is sent, numbered CTR-<year>-<0001>, Avenants after
 * them (CTR-2026-0001-A1).
 */

/** The blanks a template can hold, as `{client}`. */
export const CONTRACT_BLANKS = ['client', 'service', 'prix', 'echeancier', 'date', 'numero'] as const;
export type ContractBlank = (typeof CONTRACT_BLANKS)[number];

const BLANK = /\{([a-z]+)\}/g;

/** `text` with each known blank replaced; an unknown `{word}` stays as written. */
export function fillBlanks(text: string, values: Record<ContractBlank, string>): string {
  return text.replace(BLANK, (whole, name: string) =>
    (CONTRACT_BLANKS as readonly string[]).includes(name) ? values[name as ContractBlank] : whole,
  );
}

/** The `{word}`s in `text` that aren't blanks: likely typos, shown in the editor. */
export function unknownBlanks(text: string): string[] {
  const found = new Set<string>();
  for (const [, name] of text.matchAll(BLANK)) {
    if (!(CONTRACT_BLANKS as readonly string[]).includes(name!)) found.add(name!);
  }
  return [...found];
}

/** One block of a Contrat's text, as the PDF lays it out. */
export type ContractBlock = { kind: 'heading' | 'paragraph' | 'bullet'; text: string };

/**
 * A template's plain text as blocks: `# ` starts a title, `- ` a bullet, a
 * blank line ends a paragraph; lines inside a paragraph keep their breaks.
 */
export function contractBlocks(body: string): ContractBlock[] {
  const blocks: ContractBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) blocks.push({ kind: 'paragraph', text: paragraph.join('\n') });
    paragraph = [];
  };
  for (const raw of body.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    if (line.trim() === '') {
      flush();
    } else if (/^#{1,3}\s+/.test(line)) {
      flush();
      blocks.push({ kind: 'heading', text: line.replace(/^#{1,3}\s+/, '') });
    } else if (/^\s*[-•*]\s+/.test(line)) {
      flush();
      blocks.push({ kind: 'bullet', text: line.replace(/^\s*[-•*]\s+/, '') });
    } else {
      paragraph.push(line.trim());
    }
  }
  flush();
  return blocks;
}

export const contractNumber = (year: number, sequence: number): string =>
  `CTR-${year}-${String(sequence).padStart(4, '0')}`;

export const amendmentNumber = (contract: string, sequence: number): string => `${contract}-A${sequence}`;

/** Where a Dossier's Contrats sit in the private R2 bucket, encrypted. */
export const contractFilePrefix = (dossierId: string): string => `${dossierFilePrefix(dossierId)}contracts/`;

export const CONTRACT_LOCALES = ['fr', 'en'] as const;
export const TITLE_MAX = 160;
export const BODY_MAX = 30_000;
export const SCHEDULE_MAX = 500;
export const REASON_MAX = 300;

const id = z.string().min(1);
const title = z.string().trim().min(3).max(TITLE_MAX);
const body = z.string().trim().min(20).max(BODY_MAX);

export const templateInput = z.object({
  service: z.enum(SERVICE_TYPES),
  locale: z.enum(CONTRACT_LOCALES),
  title,
  body,
});

export const previewInput = z.object({ locale: z.enum(CONTRACT_LOCALES), title, body });

export const sendContractInput = z.object({
  dossierId: id,
  locale: z.enum(CONTRACT_LOCALES),
  /** In the currency's minor unit. */
  amount: z.number().int().min(1).max(1_000_000_000_000),
  currency: z.enum(CURRENCIES),
  schedule: z.string().trim().min(2).max(SCHEDULE_MAX),
});

export const amendmentInput = z.object({ contractId: id, title, body });

export const cancelContractInput = z.object({ id, reason: z.string().trim().max(REASON_MAX).optional() });
