import type { NextConfig } from 'next';
import { withBotId } from 'botid/next/config';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// Where the public R2 bucket is served (#87); read at build time.
const R2_PUBLIC_HOST = process.env.NEXT_PUBLIC_R2_PUBLIC_URL
  ? new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL).hostname
  : null;

const nextConfig: NextConfig = {
  // The letterhead Factures are printed on, read from disk by whichever route builds one (#79).
  outputFileTracingIncludes: {
    '/api/**/*': ['./src/features/invoices/assets/letterhead.pdf'],
  },
  images: {
    // AVIF first, WebP for browsers without it (#165).
    formats: ['image/avif', 'image/webp'],
    // Blog covers, uploaded by the consultant to the public R2 bucket (#87).
    remotePatterns: R2_PUBLIC_HOST ? [{ protocol: 'https', hostname: R2_PUBLIC_HOST }] : [],
  },
  env: {
    // Derived, never set by hand: tells the browser bundle whether the server
    // has a Google OAuth client, so "Continuer avec Google" only shows when it
    // can work. Changing the Google vars in Vercel needs a redeploy.
    GOOGLE_SIGN_IN_ENABLED: String(
      Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    ),
    // Derived for Rollbar (#160): which deployment an error comes from, the
    // same in the browser and on the server.
    RELEASE: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
    DEPLOY_ENV: process.env.VERCEL_ENV ?? 'development',
  },
};

// BotID (#162) proxies its challenge through this site's own paths.
export default withBotId(withNextIntl(nextConfig));
