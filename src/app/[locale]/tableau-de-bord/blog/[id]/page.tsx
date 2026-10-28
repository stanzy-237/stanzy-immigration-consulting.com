import { BlogEditorView } from '@/features/blog/views/blog-editor-view';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BlogEditorView id={id} />;
}
