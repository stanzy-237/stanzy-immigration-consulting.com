import { z } from 'zod';

/**
 * What the consultant places on a PDF sent for signature (#96): the Client's
 * signature, their full name and the date (filled in when they sign), and
 * the consultant's own signature beside the company stamp.
 */
export const FIELD_KINDS = ['SIGNATURE', 'NAME', 'DATE', 'STAMP'] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

/** A field's box, in fractions of the page as shown (rotation applied), from its top left. */
export type SignatureField = { kind: FieldKind; page: number; x: number; y: number; width: number; height: number };

/** The size a field gets when placed, in fractions of the page's width and height. */
export const FIELD_SIZES: Record<FieldKind, { width: number; height: number }> = {
  SIGNATURE: { width: 0.3, height: 0.07 },
  NAME: { width: 0.3, height: 0.03 },
  DATE: { width: 0.2, height: 0.03 },
  STAMP: { width: 0.36, height: 0.12 },
};

export const MAX_FIELDS = 40;

const fraction = z.number().min(0).max(1);

export const fieldInput = z
  .object({
    kind: z.enum(FIELD_KINDS),
    page: z.number().int().min(0).max(999),
    x: fraction,
    y: fraction,
    width: z.number().min(0.02).max(1),
    height: z.number().min(0.01).max(1),
  })
  .refine((field) => field.x + field.width <= 1.0001 && field.y + field.height <= 1.0001, 'FIELD_OUTSIDE_PAGE');

export const createRequestInput = z.object({
  versionId: z.string().min(1),
  fields: z
    .array(fieldInput)
    .min(1)
    .max(MAX_FIELDS)
    .refine((fields) => fields.some((field) => field.kind === 'SIGNATURE'), 'SIGNATURE_FIELD_MISSING'),
});

/** A drawn signature, as the pad exports it: a PNG data URL, at most ~300 Ko. */
export const SIGNATURE_IMAGE_PREFIX = 'data:image/png;base64,';
export const SIGNATURE_IMAGE_MAX_LENGTH = 400_000;

export const NAME_MAX = 120;

export const signInput = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(3).max(NAME_MAX),
  signature: z
    .string()
    .max(SIGNATURE_IMAGE_MAX_LENGTH)
    .refine((value) => value.startsWith(SIGNATURE_IMAGE_PREFIX), 'SIGNATURE_IMAGE_INVALID'),
  /** « J'ai lu et j'accepte ». */
  accepted: z.literal(true),
});

/** The consultant's signature and the stamp: PNG (transparent, best) or JPEG, up to 2 Mo. */
export const ASSET_KINDS = ['SIGNATURE', 'STAMP'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];
export const ASSET_TYPES = ['image/png', 'image/jpeg'] as const;
export const ASSET_MAX_BYTES = 2 * 1024 * 1024;

/** Where the signature and stamp files live in the private R2 bucket. */
export const SIGNING_ASSET_PREFIX = 'signing/';

/** The signed file's name: the original's, marked signed. */
export function signedFileName(original: string, suffix: string): string {
  const base = original.replace(/\.pdf$/i, '');
  return `${base}-${suffix}.pdf`;
}
