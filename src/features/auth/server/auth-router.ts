import { createTRPCRouter, publicProcedure } from '@/server/trpc/trpc';

export const authRouter = createTRPCRouter({
  /** The signed-in Account's summary, or null when signed out. */
  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.session) return null;
    const { id, name, email, image, locale } = ctx.session.account;
    return { id, name, email, image, locale };
  }),
});
