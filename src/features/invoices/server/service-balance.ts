import {
  invoiceBalance,
  serviceBalance,
  type BalanceInvoice,
  type ServiceBalance,
} from '@/features/invoices/lib/service-balance';
import type { TRPCContext } from '@/server/trpc/context';

type Db = TRPCContext['prisma'];

/** Where a figure comes from: typed on the Dossier, or prefilled. */
export type PriceSource = 'DOSSIER' | 'CONTRACT' | 'CATALOGUE' | null;

export type DossierPricing = {
  price: number | null;
  priceSource: PriceSource;
  partnerShare: number | null;
  partnerSource: 'DOSSIER' | 'CATALOGUE' | null;
  invoices: BalanceInvoice[];
};

/**
 * A Dossier's « Prix du service » and « Part du partenaire » (#158) with every
 * Facture as the balance counts it. A figure the consultant typed wins; until
 * then the price is prefilled from the latest signed Contrat in FCFA, else the
 * Service documentaire's fixed catalogue price, and the share from the
 * service's default.
 */
export async function dossierPricing(db: Db, dossierId: string): Promise<DossierPricing> {
  const dossier = await db.dossier.findUnique({
    where: { id: dossierId },
    select: {
      servicePrice: true,
      partnerShare: true,
      contracts: {
        where: { status: 'SIGNED', amount: { not: null }, currency: 'XAF', stanzyRequestId: null },
        orderBy: { signedAt: 'desc' },
        take: 1,
        select: { amount: true },
      },
      serviceOrder: { select: { service: { select: { priceKind: true, price: true, partnerShare: true } } } },
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
  if (!dossier) return { price: null, priceSource: null, partnerShare: null, partnerSource: null, invoices: [] };

  const catalogue = dossier.serviceOrder?.service ?? null;
  const contract = dossier.contracts[0]?.amount ?? null;
  const [price, priceSource]: [number | null, PriceSource] =
    dossier.servicePrice !== null
      ? [dossier.servicePrice, 'DOSSIER']
      : contract !== null
        ? [contract, 'CONTRACT']
        : catalogue?.priceKind === 'FIXED'
          ? [catalogue.price, 'CATALOGUE']
          : [null, null];
  const [partnerShare, partnerSource]: [number | null, DossierPricing['partnerSource']] =
    dossier.partnerShare !== null
      ? [dossier.partnerShare, 'DOSSIER']
      : catalogue?.partnerShare != null
        ? [catalogue.partnerShare, 'CATALOGUE']
        : [null, null];
  return { price, priceSource, partnerShare, partnerSource, invoices: dossier.invoices };
}

/** Where the Dossier's service stands; null without a price. */
export async function dossierBalance(db: Db, dossierId: string): Promise<ServiceBalance | null> {
  const { price, invoices } = await dossierPricing(db, dossierId);
  return serviceBalance(price, invoices);
}

/** What a Facture prints under its total (#158); null when the Dossier has no price. */
export async function printedBalance(
  db: Db,
  invoice: { id: string; lines: { quantity: number; unitAmount: number }[]; dossier: { id: string } },
): Promise<{ price: number; earlier: number; remaining: number } | null> {
  const { price, invoices } = await dossierPricing(db, invoice.dossier.id);
  const balance = invoiceBalance(price, invoice, invoices);
  return balance ? { price: balance.price, earlier: balance.earlier, remaining: balance.remaining } : null;
}
