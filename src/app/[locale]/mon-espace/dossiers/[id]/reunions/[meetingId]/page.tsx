import { redirect } from '@/i18n/navigation';

type Params = Promise<{ locale: string; meetingId: string }>;

// Réunions have their own room now, with or without a Dossier: links sent before land there.
export default async function Page({ params }: { params: Params }) {
  const { locale, meetingId } = await params;
  redirect({ href: `/mon-espace/reunions/${meetingId}`, locale });
}
