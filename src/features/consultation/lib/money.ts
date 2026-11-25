/**
 * An amount as the payer reads it: « 15 713 FCFA » for the franc CFA (XAF
 * and XOF, the same value), else the currency's own way (« 2,02 $US »): SasPay
 * charges card in USD and some networks in their country's currency.
 */
/** The franc CFA: XAF and XOF, the same value. */
export const isFcfa = (currency: string | null | undefined): boolean => currency === 'XAF' || currency === 'XOF';

export function money(amount: number, currency: string, locale: string): string {
  if (isFcfa(currency)) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount)} FCFA`;
  }
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}
