import { BlogEditorView } from '@/features/blog/views/blog-editor-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  prefetch(trpc.blog.dashboard.get.queryOptions({ id }));
  prefetch(trpc.blog.categories.queryOptions());
  prefetch(trpc.blog.dashboard.tags.queryOptions());
  return (
    <HydrateClient>
      <BlogEditorView id={id} />
    </HydrateClient>
  );
}
