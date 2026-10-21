import { inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import type { Auth } from '@/server/auth/create-auth';

/**
 * The browser's only way to talk to auth. Same-origin, so no base URL: requests
 * go to `/api/auth/*`.
 */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>()],
});
