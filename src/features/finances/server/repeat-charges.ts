import { copiesDue } from '@/features/finances/lib/repeat';
import { dateOf, dayOf } from '@/features/finances/server/finance-entries';
import type { TRPCContext } from '@/server/trpc/context';

type Db = TRPCContext['prisma'];

/**
 * Makes each monthly Charge's copies due by `today` (`YYYY-MM-DD`, Douala),
 * on the model's day of the month, without its receipt. Safe to run more
 * than once: a copy exists once per model and month. Returns how many were made.
 */
export async function makeMonthlyCopies(db: Db, today: string): Promise<number> {
  const models = await db.charge.findMany({
    where: { repeatsMonthly: true, repeatOfId: null },
    select: {
      id: true,
      amount: true,
      currency: true,
      date: true,
      categoryId: true,
      dossierId: true,
      note: true,
      createdById: true,
    },
  });
  const data = models.flatMap((model) =>
    copiesDue(dayOf(model.date), today).map(({ month, day }) => ({
      amount: model.amount,
      currency: model.currency,
      date: dateOf(day),
      categoryId: model.categoryId,
      dossierId: model.dossierId,
      note: model.note,
      createdById: model.createdById,
      repeatOfId: model.id,
      repeatMonth: month,
    })),
  );
  if (data.length === 0) return 0;
  const { count } = await db.charge.createMany({ data, skipDuplicates: true });
  return count;
}
