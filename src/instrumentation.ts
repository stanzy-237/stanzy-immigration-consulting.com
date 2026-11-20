import type { Instrumentation } from 'next';

/**
 * Next calls this for every error thrown while rendering a page, a route
 * handler or a server action (#160): it goes to Rollbar with the route and
 * the signed-in Account (id and role). tRPC procedures report their own
 * (src/app/api/trpc/[trpc]/route.ts): tRPC answers them as JSON, so they
 * never reach here.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const [{ reportServerError }, { getCurrentSession }] = await Promise.all([
    import('@/features/reports/server/rollbar'),
    import('@/server/auth/session'),
  ]);
  const headers = new Headers(
    Object.entries(request.headers).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, Array.isArray(value) ? value.join(', ') : value] as [string, string]],
    ),
  );
  const session = await getCurrentSession(headers).catch(() => null);
  await reportServerError(error, {
    route: context.routePath,
    method: request.method,
    person: session ? { id: session.account.id, role: session.account.role } : null,
    extra: { routeType: context.routeType, renderSource: context.renderSource ?? '' },
  });
};
