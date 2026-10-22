/**
 * Minimum password length. Enforced by Better Auth on the server and shown as a
 * live hint on the sign-up form, so the two can never drift apart.
 */
export const MIN_PASSWORD_LENGTH = 10;

/**
 * How long a Mot de passe oublié link stays valid. The reset email and the
 * Mot de passe oublié confirmation both say "1 hour"; change them together.
 */
export const RESET_PASSWORD_LINK_TTL_SECONDS = 60 * 60;
