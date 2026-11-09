/** The proof of funds services (with and without funds, two rates) share one tab. */
const PROOF_OF_FUNDS = 'preuve-de-fonds';

/**
 * The tab a Service documentaire sits under in « Services » (Clients): its
 * own slug, except the proof of funds services, which are one family.
 */
export const serviceFamily = (slug: string): string => (slug.startsWith(PROOF_OF_FUNDS) ? PROOF_OF_FUNDS : slug);

export const isProofOfFunds = (family: string): boolean => family === PROOF_OF_FUNDS;
