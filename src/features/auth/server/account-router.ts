import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { MIN_PASSWORD_LENGTH } from '@/features/auth/lib/password';
import { hasPassword, sendSetPasswordLink } from '@/features/auth/server/account-ready';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';

/** Errors « Mon compte » explains. */
export const ACCOUNT_ERRORS = { passwordSet: 'PASSWORD_ALREADY_SET' } as const;

/**
 * « Mon compte » (`Mon compte · 1 Réglages`): the signed-in Account's name,
 * e-mail language, WhatsApp number and reminders (those of its Consultations
 * to come), how it signs in, and its devices.
 */
export const accountRouter = createTRPCRouter({
  settings: protectedProcedure.query(async ({ ctx }) => {
    const me = ctx.session.account;
    const now = new Date();
    const [identities, sessions, consultation] = await Promise.all([
      ctx.prisma.authIdentity.findMany({ where: { userId: me.id }, select: { providerId: true, password: true } }),
      ctx.prisma.session.count({ where: { userId: me.id, expiresAt: { gt: now } } }),
      // The number and reminders the Client gave at their latest booking.
      ctx.prisma.consultation.findFirst({
        where: { accountId: me.id, status: 'PAID' },
        orderBy: { startsAt: 'desc' },
        select: { phone: true, whatsappReminders: true },
      }),
    ]);
    return {
      name: me.name,
      email: me.email,
      emailVerified: me.emailVerified,
      locale: me.locale === 'en' ? ('en' as const) : ('fr' as const),
      password: identities.some((i) => i.providerId === 'credential' && i.password),
      google: identities.some((i) => i.providerId === 'google'),
      devices: sessions,
      whatsapp: consultation ? { phone: consultation.phone, reminders: consultation.whatsappReminders } : null,
    };
  }),

  rename: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(80) })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.account.update({ where: { id: ctx.session.account.id }, data: { name: input.name } });
    return { name: input.name };
  }),

  /** The language of its e-mails (confirmations, reminders, Factures). */
  setLocale: protectedProcedure.input(z.object({ locale: z.enum(['fr', 'en']) })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.account.update({ where: { id: ctx.session.account.id }, data: { locale: input.locale } });
    return { locale: input.locale };
  }),

  /** The WhatsApp number and reminders of its Consultations to come. */
  setWhatsapp: protectedProcedure
    .input(z.object({ phone: z.string().trim().regex(/^\+\d{8,15}$/).optional(), reminders: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.consultation.updateMany({
        where: { accountId: ctx.session.account.id, status: { in: ['PAID', 'HELD'] }, startsAt: { gt: new Date() } },
        data: { ...(input.phone && { phone: input.phone }), ...(input.reminders !== undefined && { whatsappReminders: input.reminders }) },
      });
      return input;
    }),

  /**
   * « Créer mon mot de passe »: set straight away while the session is fresh;
   * otherwise (Better Auth asks for a recent sign-in) the link goes by e-mail.
   */
  createPassword: protectedProcedure.input(z.object({ password: z.string().min(MIN_PASSWORD_LENGTH).max(128) })).mutation(async ({ ctx, input }) => {
    const me = ctx.session.account;
    if (await hasPassword(ctx.prisma, me.id)) throw new TRPCError({ code: 'CONFLICT', message: ACCOUNT_ERRORS.passwordSet });
    const { auth } = await import('@/server/auth/auth');
    try {
      await auth.api.setPassword({ body: { newPassword: input.password }, headers: ctx.headers });
      return { sent: false };
    } catch {
      await sendSetPasswordLink(me);
      return { sent: true };
    }
  }),
});
