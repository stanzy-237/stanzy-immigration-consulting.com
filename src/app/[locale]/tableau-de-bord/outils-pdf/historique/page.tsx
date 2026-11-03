import { PdfHistoryView } from '@/features/pdf-tools/views/pdf-history-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.pdfTools.history.list.queryOptions());
  return (
    <HydrateClient>
      <PdfHistoryView />
    </HydrateClient>
  );
}
