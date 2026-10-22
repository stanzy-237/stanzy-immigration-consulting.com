import {
  InvalidStatusTransitionError,
  nextStatus,
  type AccountStatus,
  type StatusEvent,
} from '@/features/auth/lib/account-status';

/** The slice of the Prisma client this helper uses (the real client fits). */
export type AccountStatusStore = {
  account: {
    findUniqueOrThrow(args: {
      where: { id: string };
      select: { status: true };
    }): Promise<{ status: AccountStatus }>;
    updateMany(args: {
      where: { id: string; status: AccountStatus };
      data: { status: AccountStatus };
    }): Promise<{ count: number }>;
  };
};

/**
 * Applies `event` to the Account's status and saves it; returns the new
 * status. Throws `InvalidStatusTransitionError` for a transition the rule
 * refuses, including when another request changed the status first (the
 * save only matches the status that was read). Called by #14 and #16.
 */
export async function transitionAccountStatus(
  db: AccountStatusStore,
  accountId: string,
  event: StatusEvent,
): Promise<AccountStatus> {
  const { status } = await db.account.findUniqueOrThrow({
    where: { id: accountId },
    select: { status: true },
  });
  const next = nextStatus(status, event);
  const { count } = await db.account.updateMany({
    where: { id: accountId, status },
    data: { status: next },
  });
  if (count === 0) {
    const { status: current } = await db.account.findUniqueOrThrow({
      where: { id: accountId },
      select: { status: true },
    });
    throw new InvalidStatusTransitionError(current, event);
  }
  return next;
}
