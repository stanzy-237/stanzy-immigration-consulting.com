import { toNextJsHandler } from 'better-auth/next-js';

import { auth } from '@/server/auth/auth';

// Better Auth's HTTP API (sign-up, sign-in, verify-email, sessions, …).
export const { GET, POST } = toNextJsHandler(auth);
