import { describe, expect, it, vi } from 'vitest';

import { pushNotification } from '@/features/notifications/server/push-notifications';
import type { PushSender } from '@/server/push/web-push';
import type { TRPCContext } from '@/server/trpc/context';

/** Seam: one Notification pushed over an in-memory push_subscription table and a recording sender. */
type Device = {
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string;
  accountId: string | null;
  notifications: boolean;
};

function fakeDatabase(devices: Device[]) {
  const prisma = {
    pushSubscription: {
      async findMany({ where }: { where: { accountId: string; notifications: boolean } }) {
        return devices.filter((d) => d.accountId === where.accountId && d.notifications === where.notifications);
      },
      async deleteMany({ where }: { where: { endpoint: { in: string[] } } }) {
        for (const endpoint of where.endpoint.in)
          devices.splice(
            devices.findIndex((d) => d.endpoint === endpoint),
            1,
          );
      },
    },
  };
  return { prisma: prisma as unknown as TRPCContext['prisma'], devices };
}

const device = (endpoint: string, extra: Partial<Device> = {}): Device => ({
  endpoint,
  p256dh: 'k',
  auth: 'a',
  locale: 'fr',
  accountId: 'acc_1',
  notifications: true,
  ...extra,
});

const message = {
  id: 'n1',
  kind: 'MESSAGE_POSTED' as const,
  recipientId: 'acc_1',
  audience: 'client' as const,
  target: { dossierId: 'dos_1', documentId: 'doc_1', commentId: 'com_1' },
};

describe('pushing a Notification', () => {
  it('reaches only the recipient’s devices that turned it on, in general words, in each one’s language', async () => {
    const db = fakeDatabase([
      device('phone'),
      device('laptop', { locale: 'en' }),
      device('tablet', { notifications: false }),
      device('other', { accountId: 'acc_2' }),
    ]);
    const send = vi.fn<PushSender>(async () => 'sent');
    await pushNotification(db.prisma, message, send);

    expect(send.mock.calls.map(([d]) => d.endpoint)).toEqual(['phone', 'laptop']);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'phone' }), {
      title: 'Stanzy',
      body: 'Nouveau message.',
      url: '/fr/mon-espace/dossiers/dos_1?document=doc_1&message=com_1#documents',
      tag: 'n1',
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'laptop' }),
      expect.objectContaining({ body: 'New message.' }),
    );
  });

  it('opens the consultant’s link on the Tableau de bord', async () => {
    const db = fakeDatabase([device('desk')]);
    const send = vi.fn<PushSender>(async () => 'sent');
    await pushNotification(db.prisma, { ...message, audience: 'consultant' }, send);
    expect(send).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ url: '/dossiers/dos_1?document=doc_1&message=com_1#documents' }),
    );
  });

  it('forgets expired devices, and doesn’t push what already has its own push', async () => {
    const db = fakeDatabase([device('old'), device('phone')]);
    const send = vi.fn<PushSender>(async (d) => (d.endpoint === 'old' ? 'gone' : 'sent'));
    await pushNotification(db.prisma, message, send);
    expect(db.devices.map((d) => d.endpoint)).toEqual(['phone']);

    send.mockClear();
    await pushNotification(db.prisma, { ...message, kind: 'DRAW_PUBLISHED' }, send);
    expect(send).not.toHaveBeenCalled();
  });

  it('does nothing without push keys', async () => {
    const db = fakeDatabase([device('phone')]);
    const findMany = vi.spyOn(db.prisma.pushSubscription, 'findMany');
    await pushNotification(db.prisma, message, null);
    expect(findMany).not.toHaveBeenCalled();
  });
});
