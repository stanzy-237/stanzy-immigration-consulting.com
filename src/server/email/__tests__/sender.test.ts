import { describe, expect, it } from 'vitest';

import { isEmailSender } from '@/server/email/sender';

describe('the senders Resend accepts', () => {
  it('takes an address, or a name with the address in angle brackets', () => {
    expect(isEmailSender('dossiers@notifications.stanzy-immigration-consulting.com')).toBe(true);
    expect(isEmailSender('Stanzy Immigration <compte@auth.stanzy-immigration-consulting.com>')).toBe(true);
  });

  it('refuses a bare domain and other near misses', () => {
    expect(isEmailSender('notifications.stanzy-immigration-consulting.com')).toBe(false);
    expect(isEmailSender('Stanzy Immigration dossiers@notifications.example.com')).toBe(false);
    expect(isEmailSender('<dossiers@notifications.example.com>')).toBe(false);
    expect(isEmailSender('Stanzy <dossiers@example>')).toBe(false);
  });
});
