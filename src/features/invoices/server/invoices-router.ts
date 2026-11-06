import type { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { dossierRefInput, encryptedFileInput } from '@/features/dossiers/lib/document-schema';
import { dossierFor, isConsultant } from '@/features/dossiers/server/dossier-access';
import { acceptEncryptedUpload } from '@/features/dossiers/server/dossier-files';
import {
  cancelInvoiceInput,
  dossierSearchInput,
  invoiceFilePrefix,
  invoiceListInput,
  saveInvoiceInput,
  type InvoiceFilter,
} from '@/features/invoices/lib/invoice-schema';
import { invoiceNumber, isAwaitingPayment } from '@/features/invoices/lib/invoice-status';
import { invoiceTotal } from '@/features/invoices/lib/money';
import { invoiceFields, invoiceFor } from '@/features/invoices/server/invoice-access';
import { notifyInvoicePaid, notifyInvoiceSent, notifyProofReceived } from '@/features/invoices/server/invoice-notify';
import { notifyLater } from '@/features/notifications/server/notify';
import { trackLater } from '@/server/analytics';
import { consultantProcedure, createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';

const byId = z.object({ id: z.string().min(1) });
const refuse = (message: string): TRPCError => new TRPCError({ code: 'BAD_REQUEST', message });
const notFound = (): TRPCError => new TRPCError({ code: 'NOT_FOUND' });

const DAY = 24 * 60 * 60 * 1000;

/** The filter as a query. En retard: sent, due day over (a Preuve de paiement takes it out). */
function whereFor(filter: InvoiceFilter, now: Date): Prisma.InvoiceWhereInput {
  switch (filter) {
    case 'ALL':
      return {};
    case 'AWAITING':
      return { status: { in: ['SENT', 'PROOF_RECEIVED'] } };
    case 'OVERDUE':
      return { status: 'SENT', dueDate: { lte: new Date(now.getTime() - DAY) } };
    default:
      return { status: filter };
  }
}

type Row = Prisma.InvoiceGetPayload<{ select: typeof invoiceFields }>;

/** A row with its total; the Client's locale stays on the server. */
const withTotal = ({ dossier, ...invoice }: Row) => ({
  ...invoice,
  total: invoiceTotal(invoice.lines),
  dossier: {
    id: dossier.id,
    service: dossier.service,
    account: { name: dossier.account.name, email: dossier.account.email },
  },
});

/** A sent Facture as the PDF and the emails need it. */
function printable(invoice: Row) {
  if (!invoice.number || !invoice.sentAt) throw new Error('A Brouillon has no PDF');
  return { ...invoice, number: invoice.number, sentAt: invoice.sentAt };
}

const proofFields = { select: { id: true, fileName: true, createdAt: true }, orderBy: { createdAt: 'asc' } } as const;

/**
 * Factures (GLOSSARY: Facture). The consultant writes a Brouillon for a
 * Dossier, sends it (it gets its number and goes to the Client as a PDF on
 * the letterhead), and marks it Payée or Annulée. The Client sees the sent
 * ones on their Dossier and uploads a Preuve de paiement.
 */
export const invoicesRouter = createTRPCRouter({
  /** A Dossier's Factures, newest first: all for the consultant, the sent ones for its Client. */
  forDossier: protectedProcedure.input(dossierRefInput).query(async ({ ctx, input }) => {
    const dossier = await dossierFor(ctx.prisma, ctx.session, input.dossierId);
    const rows = await ctx.prisma.invoice.findMany({
      where: { dossierId: dossier.id, ...(isConsultant(ctx.session) ? {} : { status: { not: 'DRAFT' } }) },
      orderBy: { createdAt: 'desc' },
      select: { ...invoiceFields, proofs: proofFields },
    });
    return rows.map(({ proofs, ...row }) => ({ ...withTotal(row), proofs }));
  }),

  /**
   * Records a Preuve de paiement the browser encrypted and sent to R2
   * (ADR 0007); the Facture becomes « Preuve reçue » and the consultant is
   * told. INVOICE_NOT_PAYABLE unless it is Envoyée or already has a proof.
   */
  addProof: protectedProcedure
    .input(encryptedFileInput.extend({ invoiceId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await invoiceFor(ctx.prisma, ctx.session, input.invoiceId);
      if (!isAwaitingPayment(invoice.status)) throw refuse('INVOICE_NOT_PAYABLE');
      const wrappedKey = await acceptEncryptedUpload(input, invoiceFilePrefix(invoice.id));

      const proof = await ctx.prisma.$transaction(async (tx) => {
        const created = await tx.paymentProof.create({
          data: {
            invoiceId: invoice.id,
            fileName: input.fileName,
            contentType: input.contentType,
            size: input.size,
            objectKey: input.objectKey,
            wrappedKey,
            iv: input.iv,
            uploadedById: ctx.session.account.id,
          },
          select: { id: true },
        });
        await tx.invoice.updateMany({
          where: { id: invoice.id, status: { in: ['SENT', 'PROOF_RECEIVED'] } },
          data: { status: 'PROOF_RECEIVED' },
        });
        return created;
      });
      if (!isConsultant(ctx.session)) {
        notifyProofReceived({ ...printable(invoice), status: 'PROOF_RECEIVED' });
        notifyLater(ctx.prisma, {
          kind: 'PROOF_RECEIVED',
          actorId: ctx.session.account.id,
          recipients: 'CONSULTANTS',
          target: { dossierId: invoice.dossier.id, invoiceId: invoice.id },
        });
      }
      return proof;
    }),

  dashboard: createTRPCRouter({
    list: consultantProcedure.input(invoiceListInput).query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.invoice.findMany({
        where: whereFor(input.filter, new Date()),
        orderBy: { updatedAt: 'desc' },
        select: invoiceFields,
      });
      return rows.map(withTotal);
    }),

    get: consultantProcedure.input(byId).query(async ({ ctx, input }) => {
      const row = await ctx.prisma.invoice.findUnique({
        where: { id: input.id },
        select: { ...invoiceFields, proofs: proofFields },
      });
      if (!row) throw notFound();
      const { proofs, ...invoice } = row;
      return { ...withTotal(invoice), proofs };
    }),

    /** Open Dossiers by their Client's name or email, to bill. */
    searchDossiers: consultantProcedure.input(dossierSearchInput).query(({ ctx, input }) =>
      ctx.prisma.dossier.findMany({
        where: {
          state: 'OPEN',
          account: {
            OR: [
              { name: { contains: input.query, mode: 'insensitive' } },
              { email: { contains: input.query, mode: 'insensitive' } },
            ],
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: { id: true, service: true, account: { select: { name: true, email: true } } },
      }),
    ),

    /** One Dossier as the invoice form shows it, when started from that Dossier. */
    dossierOption: consultantProcedure.input(byId).query(async ({ ctx, input }) => {
      const dossier = await ctx.prisma.dossier.findUnique({
        where: { id: input.id },
        select: { id: true, service: true, account: { select: { name: true, email: true } } },
      });
      if (!dossier) throw notFound();
      return dossier;
    }),

    /** Creates or updates a Brouillon; its lines replace the saved ones. INVOICE_NOT_DRAFT once sent. */
    save: consultantProcedure.input(saveInvoiceInput).mutation(async ({ ctx, input }) => {
      const dossier = await ctx.prisma.dossier.findUnique({ where: { id: input.dossierId }, select: { id: true } });
      if (!dossier) throw notFound();
      const data = {
        dossierId: dossier.id,
        currency: input.currency,
        dueDate: input.dueDate,
        notes: input.notes || null,
      };
      const lines = input.lines.map((line, position) => ({ ...line, position }));

      return ctx.prisma.$transaction(async (tx) => {
        if (!input.id) {
          return tx.invoice.create({ data: { ...data, lines: { create: lines } }, select: { id: true } });
        }
        const { count } = await tx.invoice.updateMany({ where: { id: input.id, status: 'DRAFT' }, data });
        if (count === 0) throw refuse('INVOICE_NOT_DRAFT');
        await tx.invoiceLine.deleteMany({ where: { invoiceId: input.id } });
        await tx.invoiceLine.createMany({ data: lines.map((line) => ({ ...line, invoiceId: input.id! })) });
        return { id: input.id };
      });
    }),

    deleteDraft: consultantProcedure.input(byId).mutation(async ({ ctx, input }) => {
      const { count } = await ctx.prisma.invoice.deleteMany({ where: { id: input.id, status: 'DRAFT' } });
      if (count === 0) throw refuse('INVOICE_NOT_DRAFT');
    }),

    /**
     * Gives the Brouillon the year's next number and emails it to the Client
     * as a PDF. INVOICE_EMPTY without a line or with a zero total.
     */
    send: consultantProcedure.input(byId).mutation(async ({ ctx, input }) => {
      const draft = await ctx.prisma.invoice.findUnique({ where: { id: input.id }, select: invoiceFields });
      if (!draft) throw notFound();
      if (draft.status !== 'DRAFT') throw refuse('INVOICE_NOT_DRAFT');
      if (invoiceTotal(draft.lines) <= 0) throw refuse('INVOICE_EMPTY');

      const sentAt = new Date();
      const year = sentAt.getUTCFullYear();
      const number = await ctx.prisma.$transaction(async (tx) => {
        const counter = await tx.invoiceCounter.upsert({
          where: { year },
          create: { year, last: 1 },
          update: { last: { increment: 1 } },
        });
        const given = invoiceNumber(year, counter.last);
        const { count } = await tx.invoice.updateMany({
          where: { id: draft.id, status: 'DRAFT' },
          data: { status: 'SENT', number: given, sentAt },
        });
        if (count === 0) throw refuse('INVOICE_NOT_DRAFT');
        return given;
      });

      notifyInvoiceSent({ ...draft, number, sentAt, status: 'SENT' });
      trackLater(ctx.headers, 'invoice.sent', { service: draft.dossier.service });
      notifyLater(ctx.prisma, {
        kind: 'INVOICE_SENT',
        actorId: ctx.session.account.id,
        recipients: [draft.dossier.accountId],
        target: { dossierId: draft.dossier.id, invoiceId: draft.id },
      });
      return { number };
    }),

    markPaid: consultantProcedure.input(byId).mutation(async ({ ctx, input }) => {
      const invoice = await invoiceFor(ctx.prisma, ctx.session, input.id);
      const paidAt = new Date();
      const { count } = await ctx.prisma.invoice.updateMany({
        where: { id: invoice.id, status: { in: ['SENT', 'PROOF_RECEIVED'] } },
        data: { status: 'PAID', paidAt },
      });
      if (count === 0) throw refuse('INVOICE_NOT_PAYABLE');
      notifyInvoicePaid({ ...printable(invoice), status: 'PAID' });
      trackLater(ctx.headers, 'invoice.paid', { service: invoice.dossier.service });
      notifyLater(ctx.prisma, {
        kind: 'INVOICE_PAID',
        actorId: ctx.session.account.id,
        recipients: [invoice.dossier.accountId],
        target: { dossierId: invoice.dossier.id, invoiceId: invoice.id },
      });
    }),

    /** Annulée with a reason, from Envoyée or Preuve reçue; a Brouillon is deleted instead. */
    cancel: consultantProcedure.input(cancelInvoiceInput).mutation(async ({ ctx, input }) => {
      const { count } = await ctx.prisma.invoice.updateMany({
        where: { id: input.id, status: { in: ['SENT', 'PROOF_RECEIVED'] } },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: input.reason },
      });
      if (count === 0) throw refuse('INVOICE_NOT_PAYABLE');
    }),
  }),
});
