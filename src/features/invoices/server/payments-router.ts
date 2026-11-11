import { TRPCError } from '@trpc/server';
import { after } from 'next/server';
import { z } from 'zod';

import { contractLetterhead } from '@/features/contracts/server/contract-document';
import { storeEncryptedPdf } from '@/features/contracts/server/contract-files';
import { fromBase64 } from '@/features/dossiers/lib/file-crypto';
import { isConsultant } from '@/features/dossiers/server/dossier-access';
import { acceptEncryptedUpload, deleteFiles, openEncryptedFile } from '@/features/dossiers/server/dossier-files';
import { invoiceFilePrefix, receiptNumber, recordPaymentInput } from '@/features/invoices/lib/invoice-schema';
import { isAwaitingPayment } from '@/features/invoices/lib/invoice-status';
import { invoiceTotal } from '@/features/invoices/lib/money';
import { invoiceFor } from '@/features/invoices/server/invoice-access';
import { notifyInvoicePaid } from '@/features/invoices/server/invoice-notify';
import { receiptPdf } from '@/features/invoices/server/receipt-document';
import { notifyLater } from '@/features/notifications/server/notify';
import { fingerprintOf, signPdf } from '@/features/signatures/lib/sign-pdf';
import { SIGNATURE_IMAGE_PREFIX, signInput, type SignatureField } from '@/features/signatures/lib/signature-schema';
import { certificateFor } from '@/features/signatures/server/certificate';
import { openSigningAssets } from '@/features/signatures/server/signing-assets';
import { trackLater } from '@/server/analytics';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { consultantProcedure, createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';

type Db = TRPCContext['prisma'];

const byId = z.object({ id: z.string().min(1) });
const refuse = (message: string): TRPCError => new TRPCError({ code: 'BAD_REQUEST', message });

/** What remains to pay on a Facture: its total less every Paiement recorded on it. */
async function balanceOf(db: Db, invoice: { id: string; lines: { quantity: number; unitAmount: number }[] }) {
  const total = invoiceTotal(invoice.lines);
  const payments = await db.payment.findMany({ where: { invoiceId: invoice.id }, select: { amount: true } });
  return { total, received: payments.reduce((sum, payment) => sum + payment.amount, 0) };
}

/** The year's next REC number. */
async function nextReceiptNumber(db: Db, year: number): Promise<string> {
  const counter = await db.receiptCounter.upsert({ where: { year }, create: { year, last: 1 }, update: { last: { increment: 1 } } });
  return receiptNumber(year, counter.last);
}

/** A Paiement with a Reconnaissance, for its Facture's Client or the consultant (NOT_FOUND otherwise). */
async function paymentFor(db: Db, session: CurrentSession, id: string) {
  const payment = await db.payment.findUnique({ where: { id } });
  if (!payment) throw new TRPCError({ code: 'NOT_FOUND' });
  const invoice = await invoiceFor(db, session, payment.invoiceId);
  return { payment, invoice };
}

/** The Client's address as the host saw it: the first hop of X-Forwarded-For on Vercel. */
function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (forwarded || headers.get('x-real-ip') || '').slice(0, 64);
}

/**
 * Paiements on a Facture (#145). The consultant records each one received;
 * each issues a Reconnaissance de réception de fonds, signed and stamped,
 * which the Client signs in the app. The Facture is « Partiellement payée »
 * until its total is received, then « Payée ».
 */
export const paymentsRouter = createTRPCRouter({
  record: consultantProcedure.input(recordPaymentInput).mutation(async ({ ctx, input }) => {
    const invoice = await invoiceFor(ctx.prisma, ctx.session, input.invoiceId);
    if (!isAwaitingPayment(invoice.status) || !invoice.number) throw refuse('INVOICE_NOT_PAYABLE');
    const { total, received } = await balanceOf(ctx.prisma, invoice);
    if (input.amount > total - received) throw refuse('PAYMENT_TOO_HIGH');
    const consultant = await openSigningAssets(ctx.prisma);
    if (!consultant) throw refuse('SIGNATURE_ASSETS_MISSING');
    const wrappedProofKey = input.proof ? await acceptEncryptedUpload(input.proof, invoiceFilePrefix(invoice.id)) : null;

    const issuedAt = new Date();
    const { account } = invoice.dossier;
    const number = await nextReceiptNumber(ctx.prisma, issuedAt.getUTCFullYear());
    const balance = total - received - input.amount;
    const { bytes, fields } = await receiptPdf({
      locale: account.locale,
      number,
      client: account.name,
      service: invoice.lines.map((line) => line.description).join(', '),
      amount: input.amount,
      total,
      balance,
      currency: invoice.currency,
      receivedOn: input.receivedOn,
      method: input.method,
      methodNote: input.methodNote,
      issuedAt,
      consultant,
    });
    const stored = await storeEncryptedPdf(invoiceFilePrefix(invoice.id), bytes);
    const paid = balance === 0;

    const payment = await ctx.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: input.amount,
          receivedOn: input.receivedOn,
          method: input.method,
          methodNote: input.method === 'OTHER' ? input.methodNote : null,
          recordedById: ctx.session.account.id,
          receiptNumber: number,
          locale: account.locale,
          ...stored,
          fingerprint: await fingerprintOf(bytes),
          fields,
        },
        select: { id: true },
      });
      if (input.proof && wrappedProofKey) {
        await tx.paymentProof.create({
          data: {
            invoiceId: invoice.id,
            paymentId: created.id,
            fileName: input.proof.fileName,
            contentType: input.proof.contentType,
            size: input.proof.size,
            objectKey: input.proof.objectKey,
            wrappedKey: wrappedProofKey,
            iv: input.proof.iv,
            uploadedById: ctx.session.account.id,
          },
        });
      }
      await tx.invoice.updateMany({
        where: { id: invoice.id },
        data: paid ? { status: 'PAID', paidAt: issuedAt } : { status: 'PARTIALLY_PAID' },
      });
      return created;
    });

    const target = { dossierId: invoice.dossier.id, invoiceId: invoice.id };
    notifyLater(ctx.prisma, {
      kind: 'RECEIPT_SENT',
      actorId: ctx.session.account.id,
      recipients: [invoice.dossier.accountId],
      target,
      params: { paymentId: payment.id, number },
    });
    if (paid) {
      notifyInvoicePaid({ ...invoice, number: invoice.number, sentAt: invoice.sentAt!, status: 'PAID' });
      notifyLater(ctx.prisma, { kind: 'INVOICE_PAID', actorId: ctx.session.account.id, recipients: [invoice.dossier.accountId], target });
      trackLater(ctx.headers, 'invoice.paid', { service: invoice.dossier.service });
    }
    return { id: payment.id, number, status: paid ? ('PAID' as const) : ('PARTIALLY_PAID' as const) };
  }),

  /** One Reconnaissance, for the page where its Client signs it. */
  get: protectedProcedure.input(byId).query(async ({ ctx, input }) => {
    const { payment, invoice } = await paymentFor(ctx.prisma, ctx.session, input.id);
    if (!payment.receiptNumber) throw new TRPCError({ code: 'NOT_FOUND' });
    return {
      id: payment.id,
      number: payment.receiptNumber,
      amount: payment.amount,
      currency: invoice.currency,
      receivedOn: payment.receivedOn,
      invoice: { id: invoice.id, number: invoice.number },
      dossierId: invoice.dossier.id,
      signerName: invoice.dossier.account.name,
      fields: (payment.fields ?? []) as SignatureField[],
      signedAt: payment.signedAt,
      signedName: payment.signedName,
    };
  }),

  /** The Client signs their Reconnaissance, as they sign a Contrat: their signature, their name, a Certificat. */
  sign: protectedProcedure.input(signInput).mutation(async ({ ctx, input }) => {
    const { payment, invoice } = await paymentFor(ctx.prisma, ctx.session, input.id);
    const { dossier } = invoice;
    if (isConsultant(ctx.session) || dossier.accountId !== ctx.session.account.id) throw refuse('RECEIPT_NOT_YOURS');
    if (!payment.receiptNumber || !payment.objectKey || !payment.wrappedKey || !payment.iv || payment.signedAt) {
      throw refuse('RECEIPT_NOT_PENDING');
    }
    const original = new Uint8Array(
      await openEncryptedFile({
        objectKey: payment.objectKey,
        wrappedKey: payment.wrappedKey,
        iv: payment.iv,
        fileName: payment.receiptNumber,
        contentType: 'application/pdf',
      }),
    );
    const fingerprint = await fingerprintOf(original);
    if (fingerprint !== payment.fingerprint) throw refuse('SIGNATURE_DOCUMENT_CHANGED');

    const signedAt = new Date();
    const evidence = {
      name: input.name,
      signedAt,
      ip: clientIp(ctx.headers),
      device: (ctx.headers.get('user-agent') ?? '').slice(0, 300),
    };
    const certificate = await certificateFor({
      locale: payment.locale ?? dossier.account.locale,
      document: payment.receiptNumber,
      service: dossier.service,
      account: dossier.account,
      fingerprint,
      requestId: payment.receiptNumber,
      stamped: true,
      ...evidence,
    });
    let signed: Uint8Array;
    try {
      signed = await signPdf(original, {
        fields: (payment.fields ?? []) as SignatureField[],
        signature: fromBase64(input.signature.slice(SIGNATURE_IMAGE_PREFIX.length)),
        name: input.name,
        date: certificate.date,
        consultant: null,
        certificate: certificate.page,
        letterhead: await contractLetterhead(),
      });
    } catch {
      throw refuse('SIGNATURE_IMAGE_INVALID');
    }

    // Claim it first: a second tap finds it taken.
    const { count } = await ctx.prisma.payment.updateMany({
      where: { id: payment.id, signedAt: null },
      data: { signedAt, signedById: ctx.session.account.id, signedName: evidence.name, signedIp: evidence.ip, signedDevice: evidence.device },
    });
    if (count === 0) throw refuse('RECEIPT_NOT_PENDING');
    let stored: Awaited<ReturnType<typeof storeEncryptedPdf>> | null = null;
    try {
      stored = await storeEncryptedPdf(invoiceFilePrefix(invoice.id), signed);
      await ctx.prisma.payment.update({
        where: { id: payment.id },
        data: { signedObjectKey: stored.objectKey, signedWrappedKey: stored.wrappedKey, signedIv: stored.iv, signedSize: stored.size },
      });
    } catch (error) {
      // Give it back, so the Client can sign again.
      await ctx.prisma.payment.update({
        where: { id: payment.id },
        data: { signedAt: null, signedById: null, signedName: null, signedIp: null, signedDevice: null },
      });
      if (stored) after(() => deleteFiles([stored!.objectKey]));
      throw error;
    }

    notifyLater(ctx.prisma, {
      kind: 'RECEIPT_SIGNED',
      actorId: ctx.session.account.id,
      recipients: 'CONSULTANTS',
      target: { dossierId: dossier.id, invoiceId: invoice.id },
      params: { paymentId: payment.id, number: payment.receiptNumber },
    });
    return { signedAt };
  }),
});
