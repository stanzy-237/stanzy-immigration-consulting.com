import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireSession } from '@/features/auth/server/guards';
import { PAGE_SIZE } from '@/features/notifications/lib/notification-schema';
import { MyNotificationsView } from '@/features/notifications/views/my-notifications-view';
import type { LocaleParams } from '@/i18n/routing';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export async function generateMetadata({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Notifications' });
  return { title: t('metaTitle'), robots: { index: false } };
}

// An Account's own Notifications (ADR 0005: one guard call in the shell).
export default async function Page({ params }: { params: LocaleParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireSession({ locale, next: '/mon-espace/notifications' });
  prefetch(trpc.notifications.unreadCount.queryOptions());
  prefetch(
    trpc.notifications.list.infiniteQueryOptions(
      { filter: 'ALL', limit: PAGE_SIZE },
      { getNextPageParam: (page) => page.next },
    ),
  );
  return (
    <HydrateClient>
      <MyNotificationsView />
    </HydrateClient>
  );
}
