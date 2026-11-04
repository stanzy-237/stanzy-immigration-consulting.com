import { z } from 'zod';

import { COMMENT_MAX, encryptedFileInput } from '@/features/dossiers/lib/document-schema';

/** Files one Dossier message can carry. */
export const MESSAGE_FILES_MAX = 5;

const id = z.string().min(1);
const body = z.string().trim().max(COMMENT_MAX);

/** A message in the Dossier's « Messages », or (`parentId`) a reply: words, files, or both. */
export const postMessageInput = z
  .object({
    dossierId: id,
    parentId: id.optional(),
    body,
    files: z.array(encryptedFileInput).max(MESSAGE_FILES_MAX),
  })
  .refine((message) => message.body.length > 0 || message.files.length > 0, {
    message: 'MESSAGE_EMPTY',
    path: ['body'],
  });
export type PostMessageInput = z.infer<typeof postMessageInput>;

/** New words for a message; empty only when it has files (checked by the server). */
export const editMessageInput = z.object({ id, body });
export const deleteMessageInput = z.object({ id });

/** Where a Dossier's message files live in the private R2 bucket (#94). */
export const messageFilePrefix = (dossierId: string): string => `dossiers/${dossierId}/messages/`;

/** A message file, decrypted by the server. */
export const messageFileUrl = (fileId: string): string => `/api/dossiers/messages/files/${fileId}`;
