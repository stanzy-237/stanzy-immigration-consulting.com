import { consultantProcedure, createTRPCRouter, publicProcedure } from '@/server/trpc/trpc';

export const authRouter = createTRPCRouter({
  /** The signed-in Account's summary, or null when signed out. */
  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.session) return null;
    const { id, name, email, image, locale, status, role } = ctx.session.account;
    return { id, name, email, image, locale, status, role };
  }),

  /**
   * Consultant-only: answers only when the role check passes. Proves the
   * role guard end to end until the consultant's dashboard (#16) uses it.
   */
  consultantCheck: consultantProcedure.query(() => ({ consultant: true as const })),
});
