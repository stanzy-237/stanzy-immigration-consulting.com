import type { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { after } from 'next/server';
import { z } from 'zod';

import { dossierFilePrefix } from '@/features/dossiers/lib/document-schema';
import { encryptFile, fromBase64 } from '@/features/dossiers/lib/file-crypto';
import { dossierFor, isConsultant, writable } from '@/features/dossiers/server/dossier-access';
import { deleteFiles, ENCRYPTED_CONTENT_TYPE, openEncryptedFile, sealKey } from '@/features/dossiers/server/dossier-files';
import { notifyClient, notifyConsultants } from '@/features/dossiers/server/dossier-notify';
import { nextVersion } from '@/features/dossiers/server/documents-router';
import { notifyLater } from '@/features/notifications/server/notify';
import { fingerprintOf, pageCountOf, signPdf } from '@/features/signatures/lib/sign-pdf';
import {
  createRequestInput,
  signedFileName,
  signInput,
  SIGNATURE_IMAGE_PREFIX,
  type SignatureField,
} from '@/features/signatures/lib/signature-schema';
import { certificateFor } from '@/features/signatures/server/certificate';
import { openSigningAssets, signingAssetStatus } from '@/features/signatures/server/signing-assets';
import type { CurrentSession } from '@/server/auth/session';
import { writeObject } from '@/server/storage/r2';
import type { TRPCContext } from '@/server/trpc/context';
import { consultantProcedure, createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';

type Db = TRPCContext['prisma'];

const byId = z.object({ id: z.string().min(1) });
const refuse = (message: string): TRPCError => new TRPCError({ code: 'BAD_REQUEST', message });
const notFound = (): TRPCError => new TRPCError({ code: 'NOT_FOUND' });

const dossierFields = {
  id: true,
  service: true,
  stage: true,
  state: true,
  accountId: true,
  account: { select: { id: true, name: true, email: true, locale: true } },
} as const;

const requestFields = {
  id: true,
  status: true,
  fields: true,
  fingerprint: true,
  createdAt: true,
  signedAt: true,
  signedName: true,
  versionId: true,
  version: { select: { fileName: true, contentType: true, objectKey: true, wrappedKey: true, iv: true } },
  document: {
    select: { id: true, title: true, section: { select: { title: true, dossier: { select: dossierFields } } } },
  },
} satisfies Prisma.SignatureRequestSelect;

/**
 * Demandes de signature (#96): the consultant sends a PDF Version of a
 * Document with fields placed on it; the Client holding the Dossier signs
 * it in « Mon espace »; the signed PDF, with its Certificat de signature,
 * becomes the Document's next Version.
 */
export const signaturesRouter = createTRPCRouter({
  /** Whether the consultant's signature and the stamp are uploaded, for STAMP fields. */
  assets: consultantProcedure.query(({ ctx }) => signingAssetStatus(ctx.prisma)),

  /** Every Demande still waiting, across Dossiers, newest first. */
  pending: consultantProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.signatureRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        document: {
          select: {
            id: true,
            title: true,
            section: {
              select: { dossier: { select: { id: true, service: true, account: { select: { name: true } } } } },
            },
          },
        },
      },
    });
    return rows.map(({ document, ...row }) => ({
      ...row,
      document: { id: document.id, title: document.title },
      dossier: document.section.dossier,
    }));
  }),

  /** One Demande, to place-check (consultant) or to sign (its Client). */
  get: protectedProcedure.input(byId).query(async ({ ctx, input }) => {
    const request = await requestFor(ctx.prisma, ctx.session, input.id);
    const { dossier } = request.document.section;
    return {
      id: request.id,
      status: request.status,
      fields: request.fields as SignatureField[],
      versionId: request.versionId,
      fileName: request.version.fileName,
      createdAt: request.createdAt,
      signedAt: request.signedAt,
      signedName: request.signedName,
      document: { id: request.document.id, title: request.document.title, section: request.document.section.title },
      dossier: { id: dossier.id, service: dossier.service, open: dossier.state === 'OPEN' },
      /** Only the Client holding the Dossier signs, never the consultant for them. */
      canSign: request.status === 'PENDING' && dossier.state === 'OPEN' && dossier.accountId === ctx.session.account.id,
    };
  }),

  /**
   * Sends a PDF Version for signature. Refuses SIGNATURE_PDF_ONLY for an
   * image, SIGNATURE_PDF_UNREADABLE for a damaged or protected PDF,
   * SIGNATURE_FIELD_OUTSIDE for a field past its last page,
   * SIGNATURE_ALREADY_PENDING while the Document has one waiting, and
   * SIGNATURE_ASSETS_MISSING for a STAMP field before the signature and the
   * stamp are uploaded.
   */
  create: consultantProcedure.input(createRequestInput).mutation(async ({ ctx, input }) => {
    const version = await ctx.prisma.documentVersion.findUnique({
      where: { id: input.versionId },
      select: {
        id: true,
        contentType: true,
        fileName: true,
        objectKey: true,
        wrappedKey: true,
        iv: true,
        document: { select: { id: true, title: true, section: { select: { dossier: { select: dossierFields } } } } },
      },
    });
    if (!version) throw notFound();
    const { document } = version;
    const { dossier } = document.section;
    writable(dossier);
    if (version.contentType !== 'application/pdf') throw refuse('SIGNATURE_PDF_ONLY');
    const waiting = await ctx.prisma.signatureRequest.count({
      where: { documentId: document.id, status: 'PENDING' },
    });
    if (waiting > 0) throw refuse('SIGNATURE_ALREADY_PENDING');

    if (input.fields.some((field) => field.kind === 'STAMP')) {
      const assets = await signingAssetStatus(ctx.prisma);
      if (!assets.SIGNATURE || !assets.STAMP) throw refuse('SIGNATURE_ASSETS_MISSING');
    }

    const original = new Uint8Array(await openEncryptedFile(version));
    const pages = await pageCountOf(original);
    if (pages === null) throw refuse('SIGNATURE_PDF_UNREADABLE');
    if (input.fields.some((field) => field.page >= pages)) throw refuse('SIGNATURE_FIELD_OUTSIDE');

    const request = await ctx.prisma.signatureRequest.create({
      data: {
        documentId: document.id,
        versionId: version.id,
        fingerprint: await fingerprintOf(original),
        fields: input.fields,
        requestedById: ctx.session.account.id,
      },
      select: { id: true },
    });

    notifyClient(dossier.account, dossier.service, { kind: 'signatureRequested', document: document.title }, dossier.id);
    notifyLater(ctx.prisma, {
      kind: 'SIGNATURE_REQUESTED',
      actorId: ctx.session.account.id,
      recipients: [dossier.accountId],
      target: { dossierId: dossier.id, documentId: document.id },
    });
    return request;
  }),

  /** The consultant withdraws a Demande not signed yet, to send a corrected one. */
  cancel: consultantProcedure.input(byId).mutation(async ({ ctx, input }) => {
    const request = await requestFor(ctx.prisma, ctx.session, input.id);
    writable(request.document.section.dossier);
    const { count } = await ctx.prisma.signatureRequest.updateMany({
      where: { id: request.id, status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    if (count === 0) throw refuse('SIGNATURE_NOT_PENDING');
  }),

  /**
   * The Client signs: the server checks the original is still the PDF
   * fingerprinted when sent (SIGNATURE_DOCUMENT_CHANGED otherwise), draws
   * the signature, name and date (and the consultant's signature and stamp)
   * where placed, adds the Certificat de signature, and stores the result
   * encrypted as the Document's next Version. SIGNATURE_NOT_YOURS for anyone
   * but the Client holding the Dossier; SIGNATURE_NOT_PENDING once signed or
   * cancelled.
   */
  sign: protectedProcedure.input(signInput).mutation(async ({ ctx, input }) => {
    const request = await requestFor(ctx.prisma, ctx.session, input.id);
    const { dossier } = request.document.section;
    if (dossier.accountId !== ctx.session.account.id) throw refuse('SIGNATURE_NOT_YOURS');
    writable(dossier);
    if (request.status !== 'PENDING') throw refuse('SIGNATURE_NOT_PENDING');

    const original = new Uint8Array(await openEncryptedFile(request.version));
    const fingerprint = await fingerprintOf(original);
    if (fingerprint !== request.fingerprint) throw refuse('SIGNATURE_DOCUMENT_CHANGED');

    const fields = request.fields as SignatureField[];
    const consultant = fields.some((field) => field.kind === 'STAMP') ? await openSigningAssets(ctx.prisma) : null;
    if (fields.some((field) => field.kind === 'STAMP') && !consultant) throw refuse('SIGNATURE_ASSETS_MISSING');

    const signedAt = new Date();
    const evidence = {
      name: input.name,
      signedAt,
      ip: clientIp(ctx.headers),
      device: (ctx.headers.get('user-agent') ?? '').slice(0, 300),
    };
    const certificate = await certificateFor({
      locale: dossier.account.locale,
      document: request.document.title,
      service: dossier.service,
      account: dossier.account,
      fingerprint,
      requestId: request.id,
      stamped: consultant !== null,
      ...evidence,
    });

    let signed: Uint8Array;
    try {
      signed = await signPdf(original, {
        fields,
        signature: fromBase64(input.signature.slice(SIGNATURE_IMAGE_PREFIX.length)),
        name: input.name,
        date: certificate.date,
        consultant,
        certificate: certificate.page,
        letterhead: certificate.letterhead,
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('SIGNATURE_')) throw refuse(error.message);
      throw refuse('SIGNATURE_IMAGE_INVALID');
    }

    // Claim the Demande first: a second tap, or the consultant cancelling meanwhile, finds it taken.
    const { count } = await ctx.prisma.signatureRequest.updateMany({
      where: { id: request.id, status: 'PENDING' },
      data: {
        status: 'SIGNED',
        signedById: ctx.session.account.id,
        signedName: evidence.name,
        signedAt,
        signedIp: evidence.ip,
        signedDevice: evidence.device,
      },
    });
    if (count === 0) throw refuse('SIGNATURE_NOT_PENDING');

    const objectKey = `${dossierFilePrefix(dossier.id)}${crypto.randomUUID()}.bin`;
    try {
      const { ciphertext, key, iv } = await encryptFile(signed.slice().buffer as ArrayBuffer);
      await writeObject('private', objectKey, ciphertext, { contentType: ENCRYPTED_CONTENT_TYPE });
      const version = await nextVersion(ctx.prisma, request.document.id, {
        fileName: signedFileName(request.version.fileName, certificate.suffix),
        contentType: 'application/pdf',
        size: signed.byteLength,
        objectKey,
        wrappedKey: await sealKey(key),
        iv,
        uploadedById: ctx.session.account.id,
      });
      await ctx.prisma.signatureRequest.update({ where: { id: request.id }, data: { signedVersionId: version.id } });
    } catch (error) {
      // Give the Demande back, so the Client can sign again.
      await ctx.prisma.signatureRequest.update({
        where: { id: request.id },
        data: { status: 'PENDING', signedById: null, signedName: null, signedAt: null, signedIp: null, signedDevice: null },
      });
      after(() => deleteFiles([objectKey]));
      throw error;
    }

    const document = request.document.title;
    notifyClient(dossier.account, dossier.service, { kind: 'signed', document }, dossier.id);
    notifyConsultants(dossier, dossier.account.name, { kind: 'clientSigned', document });
    notifyLater(ctx.prisma, {
      kind: 'DOCUMENT_SIGNED',
      actorId: ctx.session.account.id,
      recipients: 'CONSULTANTS',
      target: { dossierId: dossier.id, documentId: request.document.id },
    });
  }),
});

/** A Demande in a Dossier `session` reaches (the consultant every one, a Client their own). */
async function requestFor(prisma: Db, session: CurrentSession, id: string) {
  const request = await prisma.signatureRequest.findUnique({ where: { id }, select: requestFields });
  if (!request) throw notFound();
  // Same rule as the Dossier itself: NOT_FOUND to anyone else.
  await dossierFor(prisma, session, request.document.section.dossier.id);
  if (!isConsultant(session) && request.status === 'CANCELLED') throw notFound();
  return request;
}

/** The Client's address as the host saw it: the first hop of X-Forwarded-For on Vercel. */
function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (forwarded || headers.get('x-real-ip') || '').slice(0, 64);
}
