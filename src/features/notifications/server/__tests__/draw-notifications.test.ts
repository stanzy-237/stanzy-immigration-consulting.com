import { describe, expect, it, vi } from 'vitest';

const notifier = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('@/features/notifications/server/notify', () => notifier);

import { notifyDrawPublished } from '@/features/notifications/server/draw-notifications';
import type { NormalizedDraw } from '@/features/draws/lib/normalize-ircc-rounds';
import type { TRPCContext } from '@/server/trpc/context';

/** Seam: a new Tirage put in the bells of Accounts with Alertes tirages on. */
const draw = { round: '449', crsMin: 489, invitations: 3000 } as NormalizedDraw;
const db = (devices: { accountId: string | null; drawAlerts: boolean }[]) =>
  ({
    pushSubscription: {
      async findMany() {
        return devices.filter((d) => d.drawAlerts && d.accountId !== null);
      },
    },
  }) as unknown as TRPCContext['prisma'];

describe('a new Tirage in the bell', () => {
  it('reaches each Account with Alertes tirages on once, whatever its number of devices', async () => {
    await notifyDrawPublished(
      db([
        { accountId: 'acc_1', drawAlerts: true },
        { accountId: 'acc_1', drawAlerts: true },
        { accountId: null, drawAlerts: true },
        { accountId: 'acc_2', drawAlerts: false },
      ]),
      draw,
    );
    expect(notifier.notify).toHaveBeenCalledWith(expect.anything(), {
      kind: 'DRAW_PUBLISHED',
      actorId: null,
      recipients: ['acc_1'],
      target: {},
      params: { round: '449', crs: '489', invitations: '3000' },
    });
  });

  it('notifies nobody when no signed-in device has the alerts', async () => {
    notifier.notify.mockClear();
    await notifyDrawPublished(db([{ accountId: null, drawAlerts: true }]), draw);
    expect(notifier.notify).not.toHaveBeenCalled();
  });
});
