import { describe, expect, it, vi } from 'vitest';

import { consultantInboxes } from '@/features/notifications/server/consultant-inbox';

const db = (emails: string[]) =>
  ({
    account: { findMany: vi.fn(async () => emails.map((email) => ({ email, locale: 'en' }))) },
  }) as unknown as Parameters<typeof consultantInboxes>[0];

describe('consultantInboxes', () => {
  it('sends to CONSULTANT_INBOX alone when it is set', async () => {
    const accounts = db(['stanzy@example.com']);
    expect(await consultantInboxes(accounts, ' inbox@example.com ')).toEqual([{ email: 'inbox@example.com', locale: 'fr' }]);
    expect(accounts.account.findMany).not.toHaveBeenCalled();
  });

  it('otherwise sends to every consultant Account', async () => {
    expect(await consultantInboxes(db(['a@example.com', 'b@example.com']), undefined)).toEqual([
      { email: 'a@example.com', locale: 'en' },
      { email: 'b@example.com', locale: 'en' },
    ]);
  });
});
