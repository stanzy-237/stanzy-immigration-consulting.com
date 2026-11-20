import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { after, type NextRequest } from 'next/server';

import { reportServerError } from '@/features/reports/server/rollbar';
import { createTRPCContext } from '@/server/trpc/context';
import { appRouter } from '@/server/trpc/root';

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError: ({ path, error, ctx, type }) => {
      if (process.env.NODE_ENV === 'development') {
        console.error(`tRPC failed on ${path ?? '<no-path>'}: ${error.message}`);
      }
      // Rollbar (#160): only what broke. A refused input, a sign-in or a
      // permission answer is the procedure doing its job.
      if (error.code !== 'INTERNAL_SERVER_ERROR') return;
      const account = ctx?.session?.account;
      after(() =>
        reportServerError(error.cause ?? error, {
          route: `trpc/${path ?? '<no-path>'}`,
          method: type === 'mutation' ? 'POST' : 'GET',
          person: account ? { id: account.id, role: account.role } : null,
        }),
      );
    },
  });

export { handler as GET, handler as POST };
