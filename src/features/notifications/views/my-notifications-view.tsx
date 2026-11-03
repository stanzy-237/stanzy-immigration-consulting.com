'use client';

import type { ReactNode } from 'react';

import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { NotificationsView } from '@/features/notifications/views/notifications-view';

/** « Mon espace → Notifications »: the full list, inside the site's header and footer. */
export function MyNotificationsView(): ReactNode {
  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-off-white px-4 py-10 md:py-14">
        <NotificationsView audience="client" />
      </main>
      <SiteFooter />
    </>
  );
}
