import { toNextJsHandler } from 'better-auth/next-js';
import { NextResponse, type NextRequest } from 'next/server';

import { AUTH_PROTECTED_PATHS, BOT_DETECTED } from '@/lib/bot-protection';
import { auth } from '@/server/auth/auth';
import { isBotRequest } from '@/server/bot-check';

// Better Auth's HTTP API (sign-up, sign-in, verify-email, sessions, …).
const handler = toNextJsHandler(auth);
const PROTECTED: ReadonlySet<string> = new Set(AUTH_PROTECTED_PATHS);

export const GET = handler.GET;

/**
 * Sign-up, sign-in, the password reset and the verification email are
 * refused to a bot (#162), in the shape Better Auth's client reads its
 * errors: `{ code, message }`, here 403 `BOT_DETECTED`.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (PROTECTED.has(request.nextUrl.pathname) && (await isBotRequest(request.headers))) {
    return NextResponse.json({ code: BOT_DETECTED, message: BOT_DETECTED }, { status: 403 });
  }
  return handler.POST(request);
}
