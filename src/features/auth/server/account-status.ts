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
 * save only matches the status that was read). Called when a Dossier opens (#79).
 *
 * The Account's own session keeps its old status for up to 5 minutes (the
 * session cookie cache), so a new Client may briefly still fail
 * `statusProcedure('CLIENT')`.
 */
export async function transitionAccountStatus(
  db: AccountStatusStore,
  accountId: string,
  event: StatusEvent,
): Promise<AccountStatus> {
  const readStatus = async (): Promise<AccountStatus> =>
    (await db.account.findUniqueOrThrow({ where: { id: accountId }, select: { status: true } }))
      .status;

  const status = await readStatus();
  const next = nextStatus(status, event);
  const { count } = await db.account.updateMany({
    where: { id: accountId, status },
    data: { status: next },
  });
  if (count === 0) throw new InvalidStatusTransitionError(await readStatus(), event);
  return next;
}
