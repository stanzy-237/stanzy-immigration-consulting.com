import { redirect } from 'next/navigation';

// Réunions have their own room now, with or without a Dossier: links sent before land there.
export default async function Page({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  redirect(`/reunions/${meetingId}`);
}
