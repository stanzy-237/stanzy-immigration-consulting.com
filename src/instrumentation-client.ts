import { initBotId } from 'botid/client/core';

import { BOT_PROTECTED_ROUTES } from '@/lib/bot-protection';

// Vercel BotID (#162): marks the sign-in, sign-up and public form requests so
// the server can tell a visitor from a bot. Invisible; skipped in local dev.
initBotId({ protect: BOT_PROTECTED_ROUTES });
