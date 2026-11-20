import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isBotRequest } from '@/server/bot-check';

/** Seam: Vercel BotID's server verdict (#162). */
const botid = vi.hoisted(() => ({ checkBotId: vi.fn() }));
vi.mock('botid/server', () => botid);

beforeEach(() => vi.clearAllMocks());

describe('isBotRequest (#162)', () => {
  it('refuses a bot, lets a visitor and a verified bot through', async () => {
    botid.checkBotId.mockResolvedValueOnce({ isBot: true, isVerifiedBot: false });
    expect(await isBotRequest()).toBe(true);
    botid.checkBotId.mockResolvedValueOnce({ isBot: false, isVerifiedBot: false });
    expect(await isBotRequest()).toBe(false);
    botid.checkBotId.mockResolvedValueOnce({ isBot: true, isVerifiedBot: true });
    expect(await isBotRequest()).toBe(false);
  });

  it('checks the request it is given, by its headers', async () => {
    botid.checkBotId.mockResolvedValueOnce({ isBot: false, isVerifiedBot: false });
    await isBotRequest(new Headers({ 'x-is-human': 'token' }));
    expect(botid.checkBotId).toHaveBeenCalledWith({ advancedOptions: { headers: { 'x-is-human': 'token' } } });
  });

  it('lets the request through when BotID itself fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    botid.checkBotId.mockRejectedValueOnce(new Error('BotID unreachable'));
    expect(await isBotRequest()).toBe(false);
  });
});
