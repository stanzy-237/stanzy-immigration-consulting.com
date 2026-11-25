import { createTranslator } from 'next-intl';
import { z } from 'zod';

import { icsFile } from '@/features/consultation/lib/calendar-links';
import { clientRoomPath } from '@/features/meetings/lib/meeting-schema';
import { toLocale } from '@/i18n/routing';
import { siteUrl } from '@/lib/site-url';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import { prisma } from '@/server/db/client';

const MESSAGES = { fr, en } as const;

/**
 * GET /api/consultation/calendar/<paymentId>: a paid Consultation as an .ics,
 * served inline (`text/calendar`) so iPhone and Mac open Calendar on it rather
 * than saving a file. The payment's id (a random UUID) is its key; nothing
 * before SasPay said `SUCCESS`.
 */
export async function GET(request: Request, { params }: { params: Promise<{ paymentId: string }> }): Promise<Response> {
  const { paymentId } = await params;
  if (!z.uuid().safeParse(paymentId).success) return new Response(null, { status: 404 });
  const payment = await prisma.consultationPayment.findUnique({
    where: { id: paymentId },
    select: { status: true, consultation: { select: { status: true, paidById: true, startsAt: true, durationMinutes: true, meetingId: true } } },
  });
  const booked = payment?.consultation;
  if (!payment || payment.status !== 'SUCCESS' || !booked || booked.status !== 'PAID' || booked.paidById !== paymentId || !booked.meetingId) {
    return new Response(null, { status: 404 });
  }
  const locale = toLocale(new URL(request.url).searchParams.get('locale'));
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'Consultation.reservation.confirmed' });
  const ics = icsFile({
    id: booked.meetingId,
    title: t('calendarTitle'),
    details: t('calendarDetails'),
    startsAt: booked.startsAt,
    minutes: booked.durationMinutes,
    url: `${siteUrl()}/${locale}${clientRoomPath(booked.meetingId)}`,
  });
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="consultation-stanzy.ics"',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
