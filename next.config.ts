import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  env: {
    // Derived, never set by hand: tells the browser bundle whether the server
    // has a Google OAuth client, so "Continuer avec Google" only shows when it
    // can work. Changing the Google vars in Vercel needs a redeploy.
    GOOGLE_SIGN_IN_ENABLED: String(
      Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    ),
  },
};

export default withNextIntl(nextConfig);
