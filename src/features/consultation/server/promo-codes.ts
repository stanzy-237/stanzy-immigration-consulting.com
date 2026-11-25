import type { PromoCode } from '@prisma/client';

import { HOLD_LIMIT_MINUTES } from '@/features/consultation/lib/payment';
import { discountFor, nearestCode, PROMO_ERRORS, type PromoService } from '@/features/consultation/lib/promo';
import { MINUTE } from '@/features/consultation/lib/slots';
import type { Db } from '@/features/consultation/server/booking-calendar';

/** Payments that succeeded with each code: its places used. */
export async function usedCounts(prisma: Db, codeIds: string[]): Promise<Map<string, number>> {
  if (codeIds.length === 0) return new Map();
  const rows = await prisma.consultationPayment.groupBy({
    by: ['promoCodeId'],
    where: { promoCodeId: { in: codeIds }, status: 'SUCCESS' },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.promoCodeId!, row._count._all]));
}

type Verdict = { ok: true; code: PromoCode; used: number } | { ok: false; error: string; suggestion?: string | null };

/**
 * Whether `code` can be used by this Compte on the Consultation now. Applying
 * counts the places paid (`SUCCESS`). Just before paying (`paying`), the
 * payments still on their way with it count too, except this booking's own:
 * so two people can't both get the last place, and the cap is never exceeded.
 */
export async function checkPromo(
  prisma: Db,
  opts: { code: string; accountId: string; consultationId: string; service: PromoService; now: Date; paying?: boolean },
): Promise<Verdict> {
  const found = await prisma.promoCode.findFirst({ where: { code: opts.code, deletedAt: null } });
  if (!found) {
    const live = await prisma.promoCode.findMany({
      where: { deletedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: opts.now } }] },
      select: { code: true },
    });
    return { ok: false, error: PROMO_ERRORS.unknown, suggestion: nearestCode(opts.code, live.map((c) => c.code)) };
  }
  if (!found.services.includes(opts.service)) return { ok: false, error: PROMO_ERRORS.service };
  if (found.endsAt && found.endsAt <= opts.now) return { ok: false, error: PROMO_ERRORS.ended };

  const used = await prisma.consultationPayment.count({ where: { promoCodeId: found.id, status: 'SUCCESS' } });
  if (found.places !== null) {
    const onTheWay = opts.paying
      ? await prisma.consultationPayment.count({
          where: {
            promoCodeId: found.id,
            status: 'PENDING',
            consultationId: { not: opts.consultationId },
            createdAt: { gt: new Date(opts.now.getTime() - HOLD_LIMIT_MINUTES * MINUTE) },
          },
        })
      : 0;
    if (used + onTheWay >= found.places) return { ok: false, error: opts.paying ? PROMO_ERRORS.lastPlace : PROMO_ERRORS.soldOut };
  }
  if (found.oncePerAccount) {
    const mine = await prisma.consultationPayment.count({
      where: { promoCodeId: found.id, status: 'SUCCESS', consultation: { accountId: opts.accountId } },
    });
    if (mine > 0) return { ok: false, error: PROMO_ERRORS.used };
  }
  return { ok: true, code: found, used };
}

/** A code as the checkout shows it: the reduction on the price, the places left, the end. */
export function promoView(code: PromoCode, price: number, used: number) {
  return {
    code: code.code,
    reductionType: code.reductionType,
    reductionValue: code.reductionValue,
    discount: discountFor(price, code),
    places: code.places,
    placesLeft: code.places === null ? null : Math.max(0, code.places - used),
    endsAt: code.endsAt,
  };
}
export type PromoView = ReturnType<typeof promoView>;
