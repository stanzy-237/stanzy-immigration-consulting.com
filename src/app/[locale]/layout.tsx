import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Plus_Jakarta_Sans, Syne, Work_Sans } from 'next/font/google';

import { JsonLd } from '@/components/json-ld';
import { NavigationProgress } from '@/components/navigation-progress';
import { ServiceWorkerRegister } from '@/components/service-worker-register';
import { SiteAnalytics } from '@/components/site-analytics';
import { ErrorTracking } from '@/features/reports/components/error-tracking';
import { organizationJsonLd } from '@/features/landing/lib/organization-json-ld';
import { Toaster } from '@/components/ui/toast';
import { DrawAlertsAuto } from '@/features/draws/components/draw-alerts-auto';
import { routing, type LocaleParams } from '@/i18n/routing';
import { ogLocale, shareImage, SITE_NAME } from '@/lib/share-metadata';
import { siteUrl } from '@/lib/site-url';
import { TRPCReactProvider } from '@/trpc/client';

import '../globals.css';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
});
const workSans = Work_Sans({
  subsets: ['latin'],
  variable: '--font-work-sans',
  display: 'swap',
});
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: '#0D1F4E',
};

export async function generateMetadata({
  params,
}: {
  params: LocaleParams;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const card = shareImage(locale, 'accueil', t('title'));
  return {
    metadataBase: new URL(siteUrl()),
    // Every page's own title, then the brand (the home page sets its whole title, see page.tsx).
    title: { default: t('title'), template: '%s | Stanzy' },
    description: t('description'),
    // The default card, for a page without its own (see shareMetadata).
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: t('title'),
      description: t('description'),
      locale: ogLocale(locale),
      images: [card],
    },
    twitter: { card: 'summary_large_image', title: t('title'), description: t('description'), images: [card.url] },
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'Stanzy',
    },
  };
}

export default async function LocaleLayout({
  children,
  modal,
  params,
}: {
  children: React.ReactNode;
  /** Parallel route: Connexion / Inscription opened as dialogs (see @modal). */
  modal: React.ReactNode;
  params: LocaleParams;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const meta = await getTranslations({ locale, namespace: 'Metadata' });

  return (
    // suppressHydrationWarning: browser extensions (e.g. LanguageTool) add
    // attributes to <html> before React hydrates. It only covers <html>'s own
    // attributes, not its children.
    <html
      lang={locale}
      className={`${syne.variable} ${workSans.variable} ${plusJakarta.variable}`}
      suppressHydrationWarning
    >
      <body>
        <NextIntlClientProvider>
          <TRPCReactProvider>
            <Toaster>
              <NavigationProgress />
              {children}
              {modal}
              <DrawAlertsAuto />
              <SiteAnalytics />
              <ErrorTracking />
            </Toaster>
          </TRPCReactProvider>
        </NextIntlClientProvider>
        <ServiceWorkerRegister />
        <JsonLd data={organizationJsonLd(siteUrl(), meta('description'))} />
      </body>
    </html>
  );
}
