import { describe, expect, it } from 'vitest';

import { authErrorKey } from '@/features/auth/lib/auth-errors';
import { BOT_PROTECTED_ROUTES, isBotRefusal } from '@/lib/bot-protection';

describe('the requests BotID protects (#162)', () => {
  it('marks sign-up, sign-in, the reset and each public form as POSTs', () => {
    const paths = BOT_PROTECTED_ROUTES.map((route) => route.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/auth/sign-up/email',
        '/api/auth/sign-in/email',
        '/api/auth/sign-in/social',
        '/api/auth/request-password-reset',
        '/api/trpc/accompagnement.submit',
        '/api/trpc/draws.subscribe',
        '/api/trpc/pdfTools.quota.use',
      ]),
    );
    expect(new Set(BOT_PROTECTED_ROUTES.map((route) => route.method))).toEqual(new Set(['POST']));
  });

  it('recognises a refusal from tRPC or Better Auth, and says so on the sign-in forms', () => {
    expect(isBotRefusal({ message: 'BOT_DETECTED' })).toBe(true);
    expect(isBotRefusal({ code: 'BOT_DETECTED', status: 403 })).toBe(true);
    expect(isBotRefusal(new Error('INVOICE_NOT_PAYABLE'))).toBe(false);
    expect(isBotRefusal(null)).toBe(false);
    expect(authErrorKey({ code: 'BOT_DETECTED', status: 403 })).toBe('botDetected');
  });
});
