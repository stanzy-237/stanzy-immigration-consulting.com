import { ConsultationAdminView } from '@/features/consultation/views/consultation-admin-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  prefetch(trpc.consultationAdmin.detail.queryOptions({ id }));
  return (
    <HydrateClient>
      <ConsultationAdminView id={id} />
    </HydrateClient>
  );
}
