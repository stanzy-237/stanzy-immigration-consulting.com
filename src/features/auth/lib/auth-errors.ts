/** The shape of an error returned by the Better Auth client. */
export type AuthClientError = {
  code?: string;
  status?: number;
  message?: string;
};

/** Keys under the `Auth.Errors` message namespace. */
export type AuthErrorKey =
  | 'generic'
  | 'tooManyAttempts'
  | 'invalidCredentials'
  | 'invalidEmail'
  | 'passwordTooShort'
  | 'emailNotVerified'
  | 'botDetected';

const BY_CODE: Record<string, AuthErrorKey> = {
  INVALID_EMAIL_OR_PASSWORD: 'invalidCredentials',
  INVALID_EMAIL: 'invalidEmail',
  PASSWORD_TOO_SHORT: 'passwordTooShort',
  EMAIL_NOT_VERIFIED: 'emailNotVerified',
  // Vercel BotID refused the request (#162): src/app/api/auth/[...all]/route.ts.
  BOT_DETECTED: 'botDetected',
};

/**
 * Maps a Better Auth error to the localized message the person sees. Anything
 * unrecognised falls back to a generic message, never the raw English text.
 */
export function authErrorKey(error: AuthClientError): AuthErrorKey {
  if (error.status === 429) return 'tooManyAttempts';
  return (error.code && BY_CODE[error.code]) || 'generic';
}
