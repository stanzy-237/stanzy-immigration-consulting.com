/** One band of a network's pay-in price, as `GET /pricing/my-rates/` gives it. */
export type FeeTier = {
  minAmount: number;
  maxAmount: number | null;
  percent: number;
  fixed: number;
  floor: number | null;
  cap: number | null;
};

/**
 * SasPay's fee on `amount` (FCFA) for a network, to show before paying
 * (« Frais MTN MoMo (4,75 %) +214 FCFA »): the band's percentage plus its
 * fixed part, kept between its floor and cap, rounded up to the franc. Null
 * when no band covers the amount: the screen then says the fees are
 * « calculés par SasPay ». What is really charged comes back from SasPay.
 */
export function feeFor(amount: number, tiers: FeeTier[]): number | null {
  const tier = tiers.find((t) => amount >= t.minAmount && (t.maxAmount === null || amount <= t.maxAmount));
  if (!tier) return null;
  let fee = (amount * tier.percent) / 100 + tier.fixed;
  if (tier.floor !== null) fee = Math.max(fee, tier.floor);
  if (tier.cap !== null) fee = Math.min(fee, tier.cap);
  return Math.ceil(fee - 1e-9);
}
