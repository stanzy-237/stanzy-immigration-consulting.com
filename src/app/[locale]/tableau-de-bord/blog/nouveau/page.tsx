import { BlogEditorView } from '@/features/blog/views/blog-editor-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.blog.categories.queryOptions());
  prefetch(trpc.blog.dashboard.tags.queryOptions());
  return (
    <HydrateClient>
      <BlogEditorView />
    </HydrateClient>
  );
}
