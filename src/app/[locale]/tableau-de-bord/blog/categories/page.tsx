import { BlogCategoriesView } from '@/features/blog/views/blog-categories-view';
import { HydrateClient, prefetch, trpc } from '@/trpc/server';

export default function Page() {
  prefetch(trpc.blog.categories.queryOptions());
  return (
    <HydrateClient>
      <BlogCategoriesView />
    </HydrateClient>
  );
}
