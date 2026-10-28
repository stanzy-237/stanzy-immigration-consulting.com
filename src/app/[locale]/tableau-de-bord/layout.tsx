import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { requireConsultant } from '@/features/auth/server/guards';
import { DashboardShell } from '@/features/dashboard/components/dashboard-shell';
import type { LocaleParams } from '@/i18n/routing';
import { siteUrl } from '@/lib/site-url';

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Dashboard' });
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

// Served on admin.<site> (src/proxy.ts). The consultant only: anyone else
// signed in gets a 404 (ADR 0005: one guard call).
export default async function DashboardLayout({ children, params }: { children: React.ReactNode; params: LocaleParams }) {
  const { locale } = await params;
  const session = await requireConsultant({ locale, next: '/tableau-de-bord' });
  return (
    <DashboardShell name={session.account.name} siteUrl={`${siteUrl()}/${locale}`}>
      {children}
    </DashboardShell>
  );
}
