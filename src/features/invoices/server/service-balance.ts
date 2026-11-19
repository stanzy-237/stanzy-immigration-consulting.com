import {
  invoiceBalance,
  pricingTotals,
  serviceBalance,
  type BalanceInvoice,
  type ServiceBalance,
} from '@/features/invoices/lib/service-balance';
import type { TRPCContext } from '@/server/trpc/context';

type Db = TRPCContext['prisma'];

/** Where a figure comes from: typed by the consultant, its Contrat, or the catalogue. */
export type PriceSource = 'TYPED' | 'CONTRACT' | 'CATALOGUE' | null;

/** One service sold on a Dossier, its price and what its partner takes (#158). */
export type ServiceLine = {
  /** DOSSIER: the Dossier's own service (Accompagnement…); REQUEST: a « Stanzy s'en charge » request. */
  kind: 'DOSSIER' | 'REQUEST';
  id: string;
  /** REQUEST: the service's name; DOSSIER: null (its service type names it). */
  name: { fr?: string; en?: string } | null;
  price: number | null;
  priceSource: PriceSource;
  partnerPrice: number | null;
  partnerSource: 'TYPED' | 'CATALOGUE' | null;
};

export type DossierPricing = {
  service: string;
  lines: ServiceLine[];
  price: number | null;
  partnerPrice: number;
  invoices: BalanceInvoice[];
};

/** Requests Stanzy took on: the Client agreed, they count. */
const TAKEN_ON = ['ACCEPTED', 'ASSIGNED'] as const;

const typedOr = <T>(typed: number | null, fallbacks: [number | null | undefined, T][], typedSource: T) => {
  if (typed !== null) return [typed, typedSource] as const;
  for (const [value, source] of fallbacks) if (value !== null && value !== undefined) return [value, source] as const;
  return [null, null] as const;
};

/**
 * What a Dossier sells and what its partners take (#158). The Dossier's own
 * service: the price typed, else its signed Contrat in FCFA. Each request
 * Stanzy took on: the price negotiated with the Client, else its Contrat's,
 * else the catalogue's fixed price; the partner's, else the service's usual
 * one. A Service documentaire Dossier is sold through its requests, so its
 * own line only shows once something is typed on it.
 */
export async function dossierPricing(db: Db, dossierId: string): Promise<DossierPricing | null> {
  const dossier = await db.dossier.findUnique({
    where: { id: dossierId },
    select: {
      id: true,
      service: true,
      servicePrice: true,
      partnerPrice: true,
      contracts: {
        where: { status: 'SIGNED', amount: { not: null }, currency: 'XAF', stanzyRequestId: null },
        orderBy: { signedAt: 'desc' },
        take: 1,
        select: { amount: true },
      },
      invoices: {
        select: {
          id: true,
          status: true,
          lines: { select: { quantity: true, unitAmount: true } },
          payments: { select: { amount: true } },
        },
      },
    },
  });
  if (!dossier) return null;
  const requests = await db.stanzyRequest.findMany({
    where: { document: { section: { dossierId } }, status: { in: [...TAKEN_ON] } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      agreedPrice: true,
      partnerPrice: true,
      contract: { select: { amount: true, currency: true, status: true } },
      service: { select: { name: true, priceKind: true, price: true, partnerPrice: true } },
    },
  });

  const lines: ServiceLine[] = [];
  const [ownPrice, ownSource] = typedOr<PriceSource>(dossier.servicePrice, [[dossier.contracts[0]?.amount, 'CONTRACT']], 'TYPED');
  if (dossier.service !== 'SERVICE_DOCUMENTAIRE' || ownPrice !== null || dossier.partnerPrice !== null) {
    lines.push({
      kind: 'DOSSIER',
      id: dossier.id,
      name: null,
      price: ownPrice,
      priceSource: ownSource,
      partnerPrice: dossier.partnerPrice,
      partnerSource: dossier.partnerPrice === null ? null : 'TYPED',
    });
  }
  for (const request of requests) {
    const contract =
      request.contract && request.contract.status !== 'CANCELLED' && request.contract.currency === 'XAF'
        ? request.contract.amount
        : null;
    const catalogue = request.service?.priceKind === 'FIXED' ? request.service.price : null;
    const [price, priceSource] = typedOr<PriceSource>(
      request.agreedPrice,
      [
        [contract, 'CONTRACT'],
        [catalogue, 'CATALOGUE'],
      ],
      'TYPED',
    );
    const [partnerPrice, partnerSource] = typedOr<'TYPED' | 'CATALOGUE'>(
      request.partnerPrice,
      [[request.service?.partnerPrice, 'CATALOGUE']],
      'TYPED',
    );
    lines.push({
      kind: 'REQUEST',
      id: request.id,
      name: (request.service?.name as ServiceLine['name']) ?? null,
      price,
      priceSource,
      partnerPrice,
      partnerSource,
    });
  }
  return { service: dossier.service, lines, ...pricingTotals(lines), invoices: dossier.invoices };
}

/** Where the Dossier's services stand; null without a price. */
export async function dossierBalance(db: Db, dossierId: string): Promise<ServiceBalance | null> {
  const pricing = await dossierPricing(db, dossierId);
  return pricing ? serviceBalance(pricing.price, pricing.invoices) : null;
}

/** What a Facture prints under its total (#158); null when the Dossier has no price. */
export async function printedBalance(
  db: Db,
  invoice: { id: string; lines: { quantity: number; unitAmount: number }[]; dossier: { id: string } },
): Promise<{ price: number; earlier: number; remaining: number } | null> {
  const pricing = await dossierPricing(db, invoice.dossier.id);
  const balance = pricing ? invoiceBalance(pricing.price, invoice, pricing.invoices) : null;
  return balance ? { price: balance.price, earlier: balance.earlier, remaining: balance.remaining } : null;
}
