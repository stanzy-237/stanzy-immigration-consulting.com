/** The proof of funds services (with and without funds, two rates): one tab. */
const PROOF_OF_FUNDS = 'preuve-de-fonds';
const PROOF_OF_FUNDS_SLUGS = new Set([PROOF_OF_FUNDS, 'preuve-de-fonds-sans-fonds']);

/**
 * The tab a Service documentaire sits under in « Services en cours »
 * (Clients): its own slug, except the proof of funds services, which are one.
 */
export const serviceFamily = (slug: string): string => (PROOF_OF_FUNDS_SLUGS.has(slug) ? PROOF_OF_FUNDS : slug);

export const isProofOfFunds = (family: string): boolean => family === PROOF_OF_FUNDS;

/** A service's name for a tab, without what its brackets explain: « ACF », « Pack expérience pro ». */
export const shortName = (name: string): string => name.replace(/\s*\(.*\)\s*$/, '');
