import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Seam: Better Auth's handler and the BotID verdict, around the auth route (#162). */
const seams = vi.hoisted(() => ({ post: vi.fn(async () => new Response('{}', { status: 200 })), isBot: vi.fn(async () => false) }));
vi.mock('better-auth/next-js', () => ({ toNextJsHandler: () => ({ GET: vi.fn(), POST: seams.post }) }));
vi.mock('@/server/auth/auth', () => ({ auth: {} }));
vi.mock('@/server/bot-check', () => ({ isBotRequest: seams.isBot }));

import { POST } from '../route';

beforeEach(() => vi.clearAllMocks());

const post = (path: string) => POST(new NextRequest(`https://site.com${path}`, { method: 'POST', body: '{}' }));

describe('the auth API and BotID (#162)', () => {
  it('refuses a bot’s sign-in, sign-up and password reset as 403 BOT_DETECTED, before Better Auth sees it', async () => {
    seams.isBot.mockResolvedValue(true);
    for (const path of ['/api/auth/sign-in/email', '/api/auth/sign-up/email', '/api/auth/request-password-reset']) {
      const response = await post(path);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ code: 'BOT_DETECTED', message: 'BOT_DETECTED' });
    }
    expect(seams.post).not.toHaveBeenCalled();
  });

  it('lets a visitor through, and never checks the other auth calls', async () => {
    seams.isBot.mockResolvedValue(false);
    expect((await post('/api/auth/sign-in/email')).status).toBe(200);
    seams.isBot.mockResolvedValue(true);
    expect((await post('/api/auth/sign-out')).status).toBe(200);
    expect(seams.isBot).toHaveBeenCalledTimes(1);
  });
});
