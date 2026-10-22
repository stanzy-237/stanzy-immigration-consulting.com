import { describe, expect, it } from 'vitest';

import {
  InvalidStatusTransitionError,
  type AccountStatus,
} from '@/features/auth/lib/account-status';
import {
  transitionAccountStatus,
  type AccountStatusStore,
} from '@/features/auth/server/account-status';

/** An in-memory account table with just what the helper reads and writes. */
function storeWith(accounts: Record<string, AccountStatus>) {
  const rows = new Map(Object.entries(accounts));
  const store: AccountStatusStore = {
    account: {
      async findUniqueOrThrow({ where }) {
        const status = rows.get(where.id);
        if (!status) throw new Error(`no account ${where.id}`);
        return { status };
      },
      async updateMany({ where, data }) {
        if (rows.get(where.id) !== where.status) return { count: 0 };
        rows.set(where.id, data.status);
        return { count: 1 };
      },
    },
  };
  return { store, statusOf: (id: string) => rows.get(id) };
}

describe('transitionAccountStatus', () => {
  it('saves User → Lead → Client', async () => {
    const { store, statusOf } = storeWith({ acc_1: 'USER' });

    expect(await transitionAccountStatus(store, 'acc_1', 'START_ONBOARDING')).toBe('LEAD');
    expect(statusOf('acc_1')).toBe('LEAD');

    expect(await transitionAccountStatus(store, 'acc_1', 'PURCHASE_ACCOMPAGNEMENT')).toBe('CLIENT');
    expect(statusOf('acc_1')).toBe('CLIENT');
  });

  it('refuses an invalid transition and leaves the status alone', async () => {
    const { store, statusOf } = storeWith({ acc_1: 'USER' });

    await expect(
      transitionAccountStatus(store, 'acc_1', 'PURCHASE_ACCOMPAGNEMENT'),
    ).rejects.toBeInstanceOf(InvalidStatusTransitionError);
    expect(statusOf('acc_1')).toBe('USER');
  });

  it('refuses when the status changed between reading and saving', async () => {
    const { store, statusOf } = storeWith({ acc_1: 'USER' });
    const read = store.account.findUniqueOrThrow.bind(store.account);
    // Another request moves the Account on right after this one reads it.
    store.account.findUniqueOrThrow = async (args) => {
      const row = await read(args);
      await store.account.updateMany({
        where: { id: 'acc_1', status: 'USER' },
        data: { status: 'LEAD' },
      });
      return row;
    };

    await expect(transitionAccountStatus(store, 'acc_1', 'START_ONBOARDING')).rejects.toBeInstanceOf(
      InvalidStatusTransitionError,
    );
    expect(statusOf('acc_1')).toBe('LEAD');
  });
});
