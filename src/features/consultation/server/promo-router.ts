import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { promoCreateSchema, promoStatus } from '@/features/consultation/lib/promo';
import { loadAvailability } from '@/features/consultation/server/booking-calendar';
import { usedCounts } from '@/features/consultation/server/promo-codes';
import { consultantProcedure, createTRPCRouter } from '@/server/trpc/trpc';

/** The code's text is already taken by a live code. */
export const PROMO_TAKEN = 'PROMO_TAKEN';

/**
 * Tableau de bord → Facturation → Codes promo (#15): the consultant's codes,
 * with their places used (payments that succeeded), status and end; making
 * one; deleting one, which stops it at once while payments already made keep
 * their reduction.
 */
export const promoCodesRouter = createTRPCRouter({
  list: consultantProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const codes = await ctx.prisma.promoCode.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' } });
    const used = await usedCounts(ctx.prisma, codes.map((c) => c.id));
    const { price } = await loadAvailability(ctx.prisma);
    return {
      /** The Consultation's price, for « Au paiement 15 000 → 4 500 FCFA ». */
      consultationPrice: price,
      codes: codes.map((code) => {
        const count = used.get(code.id) ?? 0;
        return {
          id: code.id,
          code: code.code,
          reductionType: code.reductionType,
          reductionValue: code.reductionValue,
          services: code.services,
          places: code.places,
          used: count,
          endsAt: code.endsAt,
          oncePerAccount: code.oncePerAccount,
          status: promoStatus(code, count, now),
        };
      }),
    };
  }),

  create: consultantProcedure.input(promoCreateSchema).mutation(async ({ ctx, input }) => {
    const taken = await ctx.prisma.promoCode.findFirst({ where: { code: input.code, deletedAt: null }, select: { id: true } });
    if (taken) throw new TRPCError({ code: 'CONFLICT', message: PROMO_TAKEN });
    try {
      const created = await ctx.prisma.promoCode.create({ data: { ...input, createdById: ctx.session.account.id }, select: { id: true, code: true } });
      return created;
    } catch (error) {
      // Two made at once: the live-code index refused the second.
      if ((error as { code?: string }).code === 'P2002') throw new TRPCError({ code: 'CONFLICT', message: PROMO_TAKEN });
      throw error;
    }
  }),

  /** « Supprimer »: stops the code now. Held bookings lose it at their next payment; paid ones keep it. */
  remove: consultantProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const { count } = await ctx.prisma.promoCode.updateMany({ where: { id: input.id, deletedAt: null }, data: { deletedAt: new Date() } });
    if (count === 0) throw new TRPCError({ code: 'NOT_FOUND' });
    await ctx.prisma.consultation.updateMany({ where: { promoCodeId: input.id, status: 'HELD' }, data: { promoCodeId: null } });
    return { id: input.id };
  }),
});
