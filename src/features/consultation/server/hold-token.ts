import { createHash, randomBytes } from 'node:crypto';

/** A new secret for a signed-out booker's browser, and the hash the database keeps. */
export function newHoldToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashHoldToken(token) };
}

export const hashHoldToken = (token: string): string => createHash('sha256').update(token).digest('hex');
