import { getTranslations, setRequestLocale } from 'next-intl/server';

import { requireSession } from '@/features/auth/server/guards';
import { InvitationView } from '@/features/meetings/views/invitation-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

type Params = Promise<{ locale: string; token: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Meetings.hub.invitation' });
  return { title: t('title'), robots: { index: false } };
}

// Signed in only: everyone joins with their account (ADR 0005).
export default async function Page({ params }: { params: Params }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  await requireSession({ locale, next: `/reunion/${token}` });
  prefetch(trpc.meetings.invitation.get.queryOptions({ token }));
  return (
    <HydrateClient>
      <InvitationView token={token} />
    </HydrateClient>
  );
}
