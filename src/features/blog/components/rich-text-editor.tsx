'use client';

import Image from '@tiptap/extension-image';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Heading2, Heading3, ImagePlus, Images, Italic, Link2, List, ListOrdered, Quote, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, type ReactNode } from 'react';

import { safeHref, safeImageSrc, type ArticleDoc } from '@/features/blog/lib/render-article';
import { uploadBlogImage } from '@/features/blog/lib/upload-image';

/** Only what the public renderer shows: H2–H3, bold, italic, links, lists, quotes, images. */
const EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    horizontalRule: false,
    link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
  }),
  Image.configure({ allowBase64: false }),
];

type Tool = { key: string; icon: LucideIcon; run: (editor: Editor) => void; active?: (editor: Editor) => boolean };

const TOOLS: Tool[] = [
  { key: 'h2', icon: Heading2, run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), active: (e) => e.isActive('heading', { level: 2 }) },
  { key: 'h3', icon: Heading3, run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), active: (e) => e.isActive('heading', { level: 3 }) },
  { key: 'bold', icon: Bold, run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive('bold') },
  { key: 'italic', icon: Italic, run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive('italic') },
  { key: 'bulletList', icon: List, run: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive('bulletList') },
  { key: 'orderedList', icon: ListOrdered, run: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive('orderedList') },
  { key: 'quote', icon: Quote, run: (e) => e.chain().focus().toggleBlockquote().run(), active: (e) => e.isActive('blockquote') },
];

const toolButton = 'grid size-9 place-items-center rounded-lg text-navy-deep transition-colors hover:bg-ice-blue disabled:opacity-50';

/**
 * The Article's body editor (Tiptap). Links and images ask for their address
 * and alt text; images are uploaded to the Blog's storage first.
 */
export function RichTextEditor({
  initial,
  onChange,
  onUploadError,
}: {
  initial: ArticleDoc;
  onChange: (doc: ArticleDoc) => void;
  onUploadError: () => void;
}): ReactNode {
  const t = useTranslations('BlogDashboard.editor');
  const fileInput = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions: EXTENSIONS,
    content: initial,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        'aria-label': t('bodyLabel'),
        role: 'textbox',
        'aria-multiline': 'true',
        class: 'article-body min-h-80 px-5 py-4 focus:outline-none',
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getJSON() as ArticleDoc),
  });
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      Object.fromEntries(TOOLS.map((tool) => [tool.key, current ? (tool.active?.(current) ?? false) : false])),
  });

  const setLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    const answer = window.prompt(t('linkPrompt'), previous ?? 'https://');
    if (answer === null) return;
    const href = safeHref(answer);
    if (!href) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  /** Without uploads: an image already online (https) or on the site (`/blog/…`). */
  const addImageByAddress = () => {
    if (!editor) return;
    const src = safeImageSrc(window.prompt(t('imageUrlPrompt'), 'https://'));
    if (!src) return;
    // No alt text, no image: every image the Blog shows is described.
    const alt = window.prompt(t('imageAltPrompt'))?.trim();
    if (!alt) return;
    editor.chain().focus().setImage({ src, alt }).run();
  };

  const addImage = async (file: File | undefined) => {
    if (!editor || !file) return;
    try {
      const src = await uploadBlogImage(file);
      // No alt text, no image: every image the Blog shows is described.
      const alt = window.prompt(t('imageAltPrompt'))?.trim();
      if (!alt) return;
      editor.chain().focus().setImage({ src, alt }).run();
    } catch {
      onUploadError();
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-fog-light bg-white focus-within:border-navy-deep">
      <div role="toolbar" aria-label={t('toolbar.label')} className="flex flex-wrap gap-1 border-b border-fog-light bg-off-white px-2 py-1.5">
        {TOOLS.map((tool) => (
          <button
            key={tool.key}
            type="button"
            aria-label={t(`toolbar.${tool.key}`)}
            aria-pressed={active?.[tool.key] ?? false}
            disabled={!editor}
            onClick={() => editor && tool.run(editor)}
            className={`${toolButton} aria-pressed:bg-navy-deep aria-pressed:text-white`}
          >
            <tool.icon aria-hidden={true} className="size-4" />
          </button>
        ))}
        <button type="button" aria-label={t('toolbar.link')} disabled={!editor} onClick={setLink} className={toolButton}>
          <Link2 aria-hidden={true} className="size-4" />
        </button>
        <button
          type="button"
          aria-label={t('toolbar.image')}
          disabled={!editor}
          onClick={() => fileInput.current?.click()}
          className={toolButton}
        >
          <ImagePlus aria-hidden={true} className="size-4" />
        </button>
        <button type="button" aria-label={t('toolbar.imageUrl')} disabled={!editor} onClick={addImageByAddress} className={toolButton}>
          <Images aria-hidden={true} className="size-4" />
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          tabIndex={-1}
          aria-hidden={true}
          onChange={(event) => {
            void addImage(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
