import { doualaClock, startOfDay } from '@/features/consultation/lib/week-calendar';
import { stagePosition } from '@/features/dossiers/lib/workflow';
import { yearReport } from '@/features/finances/lib/finance-report';
import { loadEntries, loadRates } from '@/features/finances/server/finance-entries';
import { isJoinable, isPast } from '@/features/meetings/lib/meeting-schema';
import { consultantProcedure, createTRPCRouter } from '@/server/trpc/trpc';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Invoices still owed: sent, or partly paid. */
const OWED = ['SENT', 'PARTIALLY_PAID'] as const;

/**
 * The Aperçu (`Tableau de bord · Aperçu`): the consultant's day in one
 * query. What waits on him (« À traiter »), today's Réunions in Douala, the
 * open Dossiers, what came in this month, the live promo code, the Dossiers
 * that moved last.
 */
export const overviewRouter = createTRPCRouter({
  today: consultantProcedure.query(async ({ ctx }) => {
    const db = ctx.prisma;
    const now = new Date();
    const { day } = doualaClock(now);
    const dayStart = startOfDay(day);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    const monthStart = startOfDay(`${day.slice(0, 7)}-01`);
    const year = Number(day.slice(0, 4));
    const month = Number(day.slice(5, 7));

    const [interests, interestCount, orders, orderCount, overdue, overdueCount, signatures, reports, meetings, openDossiers, openedThisMonth, recent, entries, rates, consultationIncome, promo] =
      await Promise.all([
        db.interestRequest.findMany({ where: { status: 'SUBMITTED' }, orderBy: { createdAt: 'asc' }, take: 2, select: { account: { select: { name: true } } } }),
        db.interestRequest.count({ where: { status: 'SUBMITTED' } }),
        db.serviceOrder.findFirst({ where: { status: 'SUBMITTED' }, orderBy: { createdAt: 'asc' }, select: { service: { select: { name: true } }, account: { select: { name: true } } } }),
        db.serviceOrder.count({ where: { status: 'SUBMITTED' } }),
        db.invoice.findFirst({
          where: { status: { in: [...OWED] }, dueDate: { lt: now } },
          orderBy: { dueDate: 'asc' },
          select: { id: true, number: true, dueDate: true, dossier: { select: { account: { select: { name: true } } } } },
        }),
        db.invoice.count({ where: { status: { in: [...OWED] }, dueDate: { lt: now } } }),
        db.signatureRequest.count({ where: { status: 'PENDING' } }),
        db.problemReport.count({ where: { status: 'NEW' } }),
        db.meeting.findMany({
          where: { status: 'SCHEDULED', kind: { not: 'PERSONAL' }, startsAt: { gte: dayStart, lt: dayEnd } },
          orderBy: { startsAt: 'asc' },
          select: { id: true, kind: true, subject: true, startsAt: true, durationMinutes: true, endedAt: true, consultation: { select: { id: true, status: true } } },
        }),
        db.dossier.count({ where: { state: 'OPEN' } }),
        // Of the open ones, those opened this month (« +2 ce mois-ci » never exceeds the open count).
        db.dossier.count({ where: { state: 'OPEN', createdAt: { gte: monthStart } } }),
        db.dossier.findMany({
          where: { state: 'OPEN' },
          orderBy: { updatedAt: 'desc' },
          take: 3,
          select: { id: true, service: true, stage: true, updatedAt: true, account: { select: { name: true } } },
        }),
        loadEntries(db, { year }),
        loadRates(db),
        // Paid Consultations aren't Recettes in Finances (yet): added here, at their price in FCFA.
        db.consultationPayment.aggregate({ where: { status: 'SUCCESS', settledAt: { gte: monthStart } }, _sum: { amount: true } }),
        db.promoCode.findFirst({
          where: { deletedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          orderBy: { createdAt: 'desc' },
          select: { id: true, code: true, places: true, endsAt: true, _count: { select: { payments: { where: { status: 'SUCCESS' } } } } },
        }),
      ]);

    const finances = yearReport(entries, rates, year).months[month - 1]?.income ?? 0;
    const today = meetings.map((m) => ({
      id: m.id,
      subject: m.subject,
      startsAt: m.startsAt,
      consultationId: m.consultation?.id ?? null,
      paid: m.consultation?.status === 'PAID',
      joinable: isJoinable(m, now),
      past: isPast(m, now) || now.getTime() > m.startsAt.getTime() + m.durationMinutes * 60_000,
    }));
    const next = today.find((m) => !m.past) ?? null;
    const used = promo?._count.payments ?? 0;

    return {
      day,
      toHandle: {
        total: interestCount + orderCount + overdueCount + reports,
        interests: { count: interestCount, names: interests.map((i) => i.account.name) },
        orders: { count: orderCount, service: orders?.service.name ?? null, name: orders?.account.name ?? null },
        overdue: overdue ? { count: overdueCount, id: overdue.id, number: overdue.number, name: overdue.dossier.account.name, dueDate: overdue.dueDate } : { count: 0 },
        // Waiting on the Client, not on him: shown, not counted in « À traiter ».
        signatures,
        reports,
      },
      meetings: { today, next },
      dossiers: {
        open: openDossiers,
        openedThisMonth,
        recent: recent.map((d) => ({ id: d.id, name: d.account.name, service: d.service, stage: d.stage, ...stagePosition(d.service, d.stage), updatedAt: d.updatedAt })),
      },
      collected: { month: `${day.slice(0, 7)}`, total: finances + (consultationIncome._sum.amount ?? 0) },
      promo: promo
        ? { id: promo.id, code: promo.code, used, places: promo.places, endsAt: promo.endsAt, exhausted: promo.places !== null && used >= promo.places }
        : null,
    };
  }),
});
