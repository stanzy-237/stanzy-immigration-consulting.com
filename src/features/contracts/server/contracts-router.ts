import type { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { after } from 'next/server';
import { z } from 'zod';

import {
  amendmentInput,
  amendmentNumber,
  cancelContractInput,
  contractFilePrefix,
  contractNumber,
  sendContractInput,
  templateInput,
} from '@/features/contracts/lib/contract-schema';
import { contractLetterhead, contractPdf, filledContract } from '@/features/contracts/server/contract-document';
import { storeEncryptedPdf } from '@/features/contracts/server/contract-files';
import { notifyContractSent, notifyContractSigned } from '@/features/contracts/server/contract-notify';
import { dossierRefInput } from '@/features/dossiers/lib/document-schema';
import { fromBase64 } from '@/features/dossiers/lib/file-crypto';
import { dossierFor, isConsultant, writable, type DossierRow } from '@/features/dossiers/server/dossier-access';
import { deleteFiles, openEncryptedFile } from '@/features/dossiers/server/dossier-files';
import { notifyLater } from '@/features/notifications/server/notify';
import { fingerprintOf, signPdf } from '@/features/signatures/lib/sign-pdf';
import { SIGNATURE_IMAGE_PREFIX, signInput, type SignatureField } from '@/features/signatures/lib/signature-schema';
import { certificateFor } from '@/features/signatures/server/certificate';
import { openSigningAssets } from '@/features/signatures/server/signing-assets';
import type { CurrentSession } from '@/server/auth/session';
import type { TRPCContext } from '@/server/trpc/context';
import { consultantProcedure, createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';

type Db = TRPCContext['prisma'];

const byId = z.object({ id: z.string().min(1) });
const refuse = (message: string): TRPCError => new TRPCError({ code: 'BAD_REQUEST', message });
const notFound = (): TRPCError => new TRPCError({ code: 'NOT_FOUND' });

/** What a list shows of a Contrat. */
const listed = {
  id: true,
  number: true,
  title: true,
  status: true,
  parentId: true,
  amount: true,
  currency: true,
  schedule: true,
  sentAt: true,
  signedAt: true,
  signedName: true,
  cancelledAt: true,
  cancelReason: true,
} satisfies Prisma.ContractSelect;

/** A Contrat to send or sign, with what the PDF, the files and the emails need. */
const full = {
  ...listed,
  dossierId: true,
  locale: true,
  fields: true,
  fingerprint: true,
  objectKey: true,
  wrappedKey: true,
  iv: true,
  size: true,
  signedObjectKey: true,
  signedWrappedKey: true,
  signedIv: true,
  dossier: {
    select: {
      id: true,
      service: true,
      stage: true,
      state: true,
      accountId: true,
      account: { select: { id: true, name: true, email: true, locale: true } },
    },
  },
} satisfies Prisma.ContractSelect;

/**
 * Contrats (#96): the consultant writes a template per service and language,
 * sends a Contrat from a Dossier (numbered CTR-<year>-<0001>, with their
 * signature and the stamp), and later Avenants to it; the Client holding
 * the Dossier signs each online; the signed PDF gets the Certificat de
 * signature. A signed Contrat never changes.
 */
export const contractsRouter = createTRPCRouter({
  templates: createTRPCRouter({
    list: consultantProcedure.query(({ ctx }) =>
      ctx.prisma.contractTemplate.findMany({
        select: { id: true, service: true, locale: true, title: true, body: true, updatedAt: true },
      }),
    ),

    save: consultantProcedure.input(templateInput).mutation(({ ctx, input }) =>
      ctx.prisma.contractTemplate.upsert({
        where: { service_locale: { service: input.service, locale: input.locale } },
        create: input,
        update: { title: input.title, body: input.body },
        select: { id: true },
      }),
    ),
  }),

  /** A Dossier's Contrats and Avenants, oldest first; the Client doesn't see cancelled ones. */
  forDossier: protectedProcedure.input(dossierRefInput).query(async ({ ctx, input }) => {
    const dossier = await dossierFor(ctx.prisma, ctx.session, input.dossierId);
    const contracts = await ctx.prisma.contract.findMany({
      where: { dossierId: dossier.id, ...(isConsultant(ctx.session) ? {} : { status: { not: 'CANCELLED' } }) },
      orderBy: { sentAt: 'asc' },
      select: listed,
    });
    return {
      open: dossier.state === 'OPEN',
      locale: dossier.account.locale,
      /** Whether a Contrat (not an Avenant) is signed: « Contrat non signé » until then. */
      signed: contracts.some((contract) => !contract.parentId && contract.status === 'SIGNED'),
      contracts,
    };
  }),

  /** Every Contrat and Avenant, newest first, for « Contrats » in the Tableau de bord. */
  list: consultantProcedure.query(({ ctx }) =>
    ctx.prisma.contract.findMany({
      orderBy: { sentAt: 'desc' },
      select: {
        ...listed,
        dossier: { select: { id: true, service: true, account: { select: { name: true } } } },
      },
    }),
  ),

  /** One Contrat, to sign (its Client) or to look at. */
  get: protectedProcedure.input(byId).query(async ({ ctx, input }) => {
    const contract = await contractFor(ctx.prisma, ctx.session, input.id);
    const { dossier } = contract;
    return {
      id: contract.id,
      number: contract.number,
      title: contract.title,
      status: contract.status,
      fields: contract.fields as SignatureField[],
      signedAt: contract.signedAt,
      dossier: { id: dossier.id },
      signerName: dossier.account.name,
      canSign: contract.status === 'SENT' && dossier.state === 'OPEN' && dossier.accountId === ctx.session.account.id,
    };
  }),

  /**
   * Sends the Dossier's Contrat, from its service's template in `locale`.
   * CONTRACT_TEMPLATE_MISSING without one, SIGNATURE_ASSETS_MISSING before
   * the signature and the stamp are uploaded, CONTRACT_ALREADY_SENT while
   * one waits, CONTRACT_ALREADY_SIGNED once one is signed (an Avenant then).
   */
  send: consultantProcedure.input(sendContractInput).mutation(async ({ ctx, input }) => {
    const dossier = await dossierFor(ctx.prisma, ctx.session, input.dossierId);
    writable(dossier);
    const current = await ctx.prisma.contract.findFirst({
      where: { dossierId: dossier.id, parentId: null, status: { in: ['SENT', 'SIGNED'] } },
      select: { status: true },
    });
    if (current) throw refuse(current.status === 'SIGNED' ? 'CONTRACT_ALREADY_SIGNED' : 'CONTRACT_ALREADY_SENT');
    const template = await ctx.prisma.contractTemplate.findUnique({
      where: { service_locale: { service: dossier.service, locale: input.locale } },
      select: { title: true, body: true },
    });
    if (!template) throw refuse('CONTRACT_TEMPLATE_MISSING');
    const consultant = await assets(ctx.prisma);

    const sentAt = new Date();
    const number = await nextNumber(ctx.prisma, sentAt.getUTCFullYear());
    const text = filledContract({
      locale: input.locale,
      template,
      client: dossier.account.name,
      service: dossier.service,
      amount: input.amount,
      currency: input.currency,
      schedule: input.schedule,
      number,
      sentAt,
    });
    const contract = await issue(ctx, dossier, {
      number,
      locale: input.locale,
      ...text,
      amendment: null,
      sentAt,
      consultant,
      data: { amount: input.amount, currency: input.currency, schedule: input.schedule },
    });
    return { id: contract.id, number };
  }),

  /**
   * An Avenant to a signed Contrat, written freely: numbered after it
   * (CTR-2026-0001-A1), in its language, signed the same way.
   * CONTRACT_NOT_SIGNED before the Contrat is signed, AMENDMENT_ALREADY_SENT
   * while another waits.
   */
  sendAmendment: consultantProcedure.input(amendmentInput).mutation(async ({ ctx, input }) => {
    const parent = await contractFor(ctx.prisma, ctx.session, input.contractId);
    writable(parent.dossier);
    if (parent.parentId) throw notFound();
    if (parent.status !== 'SIGNED') throw refuse('CONTRACT_NOT_SIGNED');
    const amendments = await ctx.prisma.contract.findMany({ where: { parentId: parent.id }, select: { status: true } });
    if (amendments.some((amendment) => amendment.status === 'SENT')) throw refuse('AMENDMENT_ALREADY_SENT');
    const consultant = await assets(ctx.prisma);

    // Cancelled ones keep their number: the next one never reuses it.
    const rank = amendments.length + 1;
    const number = amendmentNumber(parent.number, rank);
    const contract = await issue(ctx, parent.dossier, {
      number,
      locale: parent.locale,
      title: input.title,
      body: input.body,
      amendment: { rank, of: parent.number, parentId: parent.id },
      sentAt: new Date(),
      consultant,
      data: {},
    });
    return { id: contract.id, number };
  }),

  /** The consultant withdraws a Contrat or an Avenant not signed yet. CONTRACT_NOT_PENDING otherwise. */
  cancel: consultantProcedure.input(cancelContractInput).mutation(async ({ ctx, input }) => {
    const contract = await contractFor(ctx.prisma, ctx.session, input.id);
    writable(contract.dossier);
    const { count } = await ctx.prisma.contract.updateMany({
      where: { id: contract.id, status: 'SENT' },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: input.reason || null },
    });
    if (count === 0) throw refuse('CONTRACT_NOT_PENDING');
  }),

  /**
   * The Client signs: the server checks the PDF is still the one
   * fingerprinted when sent, fills in the fields, adds the Certificat de
   * signature on the letterhead, and stores the signed PDF encrypted. Both
   * sides get it by email. CONTRACT_NOT_YOURS for anyone but the Client
   * holding the Dossier; CONTRACT_NOT_PENDING once signed or cancelled.
   */
  sign: protectedProcedure.input(signInput).mutation(async ({ ctx, input }) => {
    const contract = await contractFor(ctx.prisma, ctx.session, input.id);
    const { dossier } = contract;
    if (dossier.accountId !== ctx.session.account.id) throw refuse('CONTRACT_NOT_YOURS');
    writable(dossier);
    if (contract.status !== 'SENT') throw refuse('CONTRACT_NOT_PENDING');

    const original = new Uint8Array(
      await openEncryptedFile({ ...contract, fileName: contract.number, contentType: 'application/pdf' }),
    );
    const fingerprint = await fingerprintOf(original);
    if (fingerprint !== contract.fingerprint) throw refuse('SIGNATURE_DOCUMENT_CHANGED');

    const signedAt = new Date();
    const evidence = {
      name: input.name,
      signedAt,
      ip: clientIp(ctx.headers),
      device: (ctx.headers.get('user-agent') ?? '').slice(0, 300),
    };
    // The Contrat's own stamp was applied when sent; the Certificat names it.
    const certificate = await certificateFor({
      locale: contract.locale,
      document: `${contract.title} (${contract.number})`,
      service: dossier.service,
      account: dossier.account,
      fingerprint,
      requestId: contract.number,
      stamped: true,
      ...evidence,
    });

    let signed: Uint8Array;
    try {
      signed = await signPdf(original, {
        fields: contract.fields as SignatureField[],
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

    // Claim it first: a second tap, or the consultant cancelling meanwhile, finds it taken.
    const { count } = await ctx.prisma.contract.updateMany({
      where: { id: contract.id, status: 'SENT' },
      data: {
        status: 'SIGNED',
        signedById: ctx.session.account.id,
        signedName: evidence.name,
        signedAt,
        signedIp: evidence.ip,
        signedDevice: evidence.device,
      },
    });
    if (count === 0) throw refuse('CONTRACT_NOT_PENDING');

    let stored: Awaited<ReturnType<typeof storeEncryptedPdf>> | null = null;
    try {
      stored = await storeEncryptedPdf(contractFilePrefix(dossier.id), signed);
      await ctx.prisma.contract.update({
        where: { id: contract.id },
        data: {
          signedObjectKey: stored.objectKey,
          signedWrappedKey: stored.wrappedKey,
          signedIv: stored.iv,
          signedSize: stored.size,
        },
      });
    } catch (error) {
      // Give it back, so the Client can sign again.
      await ctx.prisma.contract.update({
        where: { id: contract.id },
        data: { status: 'SENT', signedById: null, signedName: null, signedAt: null, signedIp: null, signedDevice: null },
      });
      if (stored) after(() => deleteFiles([stored!.objectKey]));
      throw error;
    }

    const facts = {
      id: contract.id,
      number: contract.number,
      title: contract.title,
      service: dossier.service,
      amendment: contract.parentId !== null,
      dossierId: dossier.id,
    };
    notifyContractSigned(dossier.account, facts, signed);
    notifyLater(ctx.prisma, {
      kind: 'CONTRACT_SIGNED',
      actorId: ctx.session.account.id,
      recipients: 'CONSULTANTS',
      target: { dossierId: dossier.id },
      params: { contractId: contract.id, number: contract.number },
    });
  }),
});

/** A Contrat in a Dossier `session` reaches; a cancelled one doesn't exist for the Client. */
async function contractFor(prisma: Db, session: CurrentSession, id: string) {
  const contract = await prisma.contract.findUnique({ where: { id }, select: full });
  if (!contract) throw notFound();
  await dossierFor(prisma, session, contract.dossierId);
  if (!isConsultant(session) && contract.status === 'CANCELLED') throw notFound();
  return contract;
}

/** The consultant's signature and the stamp, applied to every Contrat sent. */
async function assets(prisma: Db) {
  const consultant = await openSigningAssets(prisma);
  if (!consultant) throw refuse('SIGNATURE_ASSETS_MISSING');
  return consultant;
}

/** The year's next CTR number. */
async function nextNumber(prisma: Db, year: number): Promise<string> {
  const counter = await prisma.contractCounter.upsert({
    where: { year },
    create: { year, last: 1 },
    update: { last: { increment: 1 } },
  });
  return contractNumber(year, counter.last);
}

/**
 * Draws the PDF (with the consultant's signature and stamp), stores it
 * encrypted, records the Contrat and tells the Client.
 */
async function issue(
  ctx: { prisma: Db; session: CurrentSession },
  dossier: DossierRow,
  opts: {
    number: string;
    locale: string;
    title: string;
    body: string;
    amendment: { rank: number; of: string; parentId: string } | null;
    sentAt: Date;
    consultant: Awaited<ReturnType<typeof assets>>;
    data: { amount?: number; currency?: Prisma.ContractCreateInput['currency']; schedule?: string };
  },
) {
  const { bytes, fields } = await contractPdf({
    locale: opts.locale,
    title: opts.title,
    body: opts.body,
    number: opts.number,
    amendment: opts.amendment,
    sentAt: opts.sentAt,
    consultant: opts.consultant,
  });
  const stored = await storeEncryptedPdf(contractFilePrefix(dossier.id), bytes);
  const contract = await ctx.prisma.contract.create({
    data: {
      number: opts.number,
      dossierId: dossier.id,
      parentId: opts.amendment?.parentId ?? null,
      locale: opts.locale,
      title: opts.title,
      body: opts.body,
      ...opts.data,
      ...stored,
      fingerprint: await fingerprintOf(bytes),
      fields,
      sentById: ctx.session.account.id,
      sentAt: opts.sentAt,
    },
    select: { id: true },
  });

  const facts = {
    id: contract.id,
    number: opts.number,
    title: opts.title,
    service: dossier.service,
    amendment: opts.amendment !== null,
    dossierId: dossier.id,
  };
  notifyContractSent(dossier.account, facts);
  notifyLater(ctx.prisma, {
    kind: 'CONTRACT_SENT',
    actorId: ctx.session.account.id,
    recipients: [dossier.accountId],
    target: { dossierId: dossier.id },
    params: { contractId: contract.id, number: opts.number },
  });
  return contract;
}

/** The Client's address as the host saw it: the first hop of X-Forwarded-For on Vercel. */
function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (forwarded || headers.get('x-real-ip') || '').slice(0, 64);
}
