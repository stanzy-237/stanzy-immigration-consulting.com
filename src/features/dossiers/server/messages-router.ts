import { TRPCError } from '@trpc/server';

import { dossierRefInput } from '@/features/dossiers/lib/document-schema';
import { excerptOf } from '@/features/dossiers/lib/dossier-emails';
import {
  deleteMessageInput,
  editMessageInput,
  messageFilePrefix,
  postMessageInput,
} from '@/features/dossiers/lib/message-schema';
import { dossierFor, isConsultant, writable } from '@/features/dossiers/server/dossier-access';
import { acceptEncryptedUpload, deleteFiles } from '@/features/dossiers/server/dossier-files';
import { notifyClient, notifyConsultants } from '@/features/dossiers/server/dossier-notify';
import { notifyLater } from '@/features/notifications/server/notify';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';

type Db = TRPCContext['prisma'];

const refuse = (message: string): TRPCError => new TRPCError({ code: 'BAD_REQUEST', message });
const notFound = (): TRPCError => new TRPCError({ code: 'NOT_FOUND' });

/**
 * A Dossier's « Messages » (#94): the general conversation between its
 * Client and the consultant, apart from the Documents'. The same rules as a
 * Document's (#89): replies one level deep, authors edit their own, authors
 * and the consultant delete. Messages may carry files, encrypted (ADR 0007).
 */
export const messagesRouter = createTRPCRouter({
  /** Oldest first; a deleted message keeps its place, not its words or files. */
  list: protectedProcedure.input(dossierRefInput).query(async ({ ctx, input }) => {
    const dossier = await dossierFor(ctx.prisma, ctx.session, input.dossierId);
    const messages = await ctx.prisma.dossierMessage.findMany({
      where: { dossierId: dossier.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        parentId: true,
        body: true,
        editedAt: true,
        deletedAt: true,
        createdAt: true,
        author: { select: { id: true, name: true, role: true } },
        files: { orderBy: { createdAt: 'asc' }, select: { id: true, fileName: true, contentType: true, size: true } },
      },
    });
    return {
      viewer: { id: ctx.session.account.id, role: ctx.session.account.role },
      open: dossier.state === 'OPEN',
      messages: messages.map((message) => (message.deletedAt ? { ...message, body: '', files: [] } : message)),
    };
  }),

  /** A message or a reply, with its files; a reply to a reply joins its message. The other side is told. */
  post: protectedProcedure.input(postMessageInput).mutation(async ({ ctx, input }) => {
    const dossier = await dossierFor(ctx.prisma, ctx.session, input.dossierId);
    writable(dossier);
    let parentId: string | null = null;
    if (input.parentId) {
      const parent = await ctx.prisma.dossierMessage.findFirst({
        where: { id: input.parentId, dossierId: dossier.id },
        select: { id: true, parentId: true },
      });
      if (!parent) throw notFound();
      parentId = parent.parentId ?? parent.id;
    }
    const prefix = messageFilePrefix(dossier.id);
    const files = await Promise.all(
      input.files.map(async (file) => ({
        fileName: file.fileName,
        contentType: file.contentType,
        size: file.size,
        objectKey: file.objectKey,
        wrappedKey: await acceptEncryptedUpload(file, prefix),
        iv: file.iv,
      })),
    );
    const message = await ctx.prisma.dossierMessage.create({
      data: {
        dossierId: dossier.id,
        parentId,
        authorId: ctx.session.account.id,
        body: input.body,
        files: { create: files },
      },
      select: { id: true },
    });

    const excerpt = excerptOf(input.body || files.map((file) => file.fileName).join(', '));
    if (isConsultant(ctx.session)) {
      notifyClient(dossier.account, dossier.service, { kind: 'message', excerpt }, dossier.id, '#messages');
    } else {
      notifyConsultants(dossier, dossier.account.name, { kind: 'clientMessage', excerpt });
    }
    notifyLater(ctx.prisma, {
      kind: 'DOSSIER_MESSAGE',
      actorId: ctx.session.account.id,
      recipients: isConsultant(ctx.session) ? [dossier.accountId] : 'CONSULTANTS',
      target: { dossierId: dossier.id, messageId: message.id },
    });
    return message;
  }),

  /** Its author rewrites a message; it shows « modifié ». Empty only if it has files. */
  edit: protectedProcedure.input(editMessageInput).mutation(async ({ ctx, input }) => {
    const message = await messageFor(ctx.prisma, ctx.session, input.id);
    if (message.authorId !== ctx.session.account.id) throw refuse('COMMENT_NOT_YOURS');
    if (!input.body && message._count.files === 0) throw refuse('MESSAGE_EMPTY');
    await ctx.prisma.dossierMessage.update({
      where: { id: message.id },
      data: { body: input.body, editedAt: new Date() },
    });
  }),

  /**
   * Its author, or the consultant, deletes a message and its files. One with
   * replies stays as « Message supprimé » so they still read; once its last
   * reply goes, it goes too.
   */
  delete: protectedProcedure.input(deleteMessageInput).mutation(async ({ ctx, input }) => {
    const message = await messageFor(ctx.prisma, ctx.session, input.id);
    if (message.authorId !== ctx.session.account.id && !isConsultant(ctx.session)) throw refuse('COMMENT_NOT_YOURS');
    const files = await ctx.prisma.dossierMessageFile.findMany({
      where: { messageId: message.id },
      select: { objectKey: true },
    });
    await ctx.prisma.$transaction(async (tx) => {
      if ((await tx.dossierMessage.count({ where: { parentId: message.id } })) > 0) {
        await tx.dossierMessageFile.deleteMany({ where: { messageId: message.id } });
        await tx.dossierMessage.update({ where: { id: message.id }, data: { deletedAt: new Date(), body: '' } });
        await tx.notification.deleteMany({ where: { messageId: message.id } });
        return;
      }
      await tx.dossierMessage.delete({ where: { id: message.id } });
      if (message.parentId) {
        const parent = await tx.dossierMessage.findUnique({
          where: { id: message.parentId },
          select: { deletedAt: true, _count: { select: { replies: true } } },
        });
        if (parent?.deletedAt && parent._count.replies === 0) {
          await tx.dossierMessage.delete({ where: { id: message.parentId } });
        }
      }
    });
    if (files.length > 0) await deleteFiles(files.map((file) => file.objectKey)).catch(() => {});
  }),
});

/** A message still in the conversation, in a Dossier `session` reaches and that is still open. */
async function messageFor(prisma: Db, session: CurrentSession, id: string) {
  const message = await prisma.dossierMessage.findUnique({
    where: { id },
    select: { id: true, dossierId: true, parentId: true, authorId: true, deletedAt: true, _count: { select: { files: true } } },
  });
  if (!message || message.deletedAt) throw notFound();
  writable(await dossierFor(prisma, session, message.dossierId));
  return message;
}
