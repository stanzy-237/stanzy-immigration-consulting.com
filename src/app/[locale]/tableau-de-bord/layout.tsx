import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';

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
export default async function DashboardLayout({
  children,
  modal,
  params,
}: {
  children: React.ReactNode;
  /** Parallel route: dialogs over the current page, e.g. « Ouvrir un dossier » (see @modal). */
  modal: React.ReactNode;
  params: LocaleParams;
}) {
  const { locale } = await params;
  const session = await requireConsultant({ locale, next: '/tableau-de-bord' });
  // The sidebar opens folded or not, as the consultant left it (shadcn's cookie).
  const sidebarOpen = (await cookies()).get('sidebar_state')?.value !== 'false';
  return (
    <DashboardShell name={session.account.name} siteUrl={`${siteUrl()}/${locale}`} defaultOpen={sidebarOpen}>
      {children}
      {modal}
    </DashboardShell>
  );
}
