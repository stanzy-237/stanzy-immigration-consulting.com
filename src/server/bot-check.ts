import { checkBotId } from 'botid/server';

/**
 * Whether Vercel BotID classifies this request as a bot (#162). Basic mode
 * (free); `headers` lets a tRPC procedure pass its own request's. Fails open:
 * if BotID itself can't answer, a real visitor isn't locked out. In local dev
 * BotID answers « human ».
 */
export async function isBotRequest(headers?: Headers): Promise<boolean> {
  try {
    const verdict = await checkBotId(headers ? { advancedOptions: { headers: Object.fromEntries(headers.entries()) } } : undefined);
    return verdict.isBot && !verdict.isVerifiedBot;
  } catch (error) {
    console.error('[botid] check failed, letting the request through', error);
    return false;
  }
}
