import { TRPCError } from '@trpc/server';

import { notifyLater } from '@/features/notifications/server/notify';
import { createReportInput, listReportsInput, setReportStatusInput } from '@/features/reports/lib/report-schema';
import { consultantProcedure, createTRPCRouter, protectedProcedure } from '@/server/trpc/trpc';

/** A tab may send this many Signalements in a row; more is a loop or abuse. */
const PER_HOUR = 5;
const HOUR = 60 * 60 * 1000;

/**
 * « Signaler un problème » and the Signalements list (#160). Anyone signed
 * in reports what went wrong; the consultant triages each report.
 */
export const reportsRouter = createTRPCRouter({
  create: protectedProcedure.input(createReportInput).mutation(async ({ ctx, input }) => {
    const { account } = ctx.session;
    const recent = await ctx.prisma.problemReport.count({
      where: { accountId: account.id, createdAt: { gte: new Date(Date.now() - HOUR) } },
    });
    if (recent >= PER_HOUR) throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'REPORT_LIMIT' });

    const report = await ctx.prisma.problemReport.create({
      data: {
        accountId: account.id,
        message: input.message,
        path: input.path,
        userAgent: (ctx.headers.get('user-agent') ?? '').slice(0, 300) || null,
        rollbarIds: input.rollbarIds,
      },
      select: { id: true },
    });
    notifyLater(ctx.prisma, {
      kind: 'PROBLEM_REPORTED',
      actorId: account.id,
      recipients: 'CONSULTANTS',
      target: {},
      params: { reportId: report.id, client: account.name },
    });
    return report;
  }),

  /** Newest first, the open ones on top; `status` narrows the list. */
  list: consultantProcedure.input(listReportsInput).query(async ({ ctx, input }) => {
    const reports = await ctx.prisma.problemReport.findMany({
      where: input.status ? { status: input.status } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        message: true,
        path: true,
        userAgent: true,
        rollbarIds: true,
        status: true,
        createdAt: true,
        account: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    const open = (status: string) => status === 'NEW' || status === 'IN_PROGRESS';
    return [...reports.filter((report) => open(report.status)), ...reports.filter((report) => !open(report.status))];
  }),

  setStatus: consultantProcedure.input(setReportStatusInput).mutation(async ({ ctx, input }) => {
    const { count } = await ctx.prisma.problemReport.updateMany({ where: { id: input.id }, data: { status: input.status } });
    if (count === 0) throw new TRPCError({ code: 'NOT_FOUND' });
    return { id: input.id, status: input.status };
  }),
});
