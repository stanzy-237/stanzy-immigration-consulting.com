'use client';

import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Heading2, Heading3, Italic, List, ListOrdered, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, type ReactNode } from 'react';

import { HANDOFF_FIELDS, type HandoffField, type NoteDoc } from '@/features/document-services/lib/handoff';

/** What the note's PDF draws (#148): titles, bold, italic, bullets and numbers. */
const EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    horizontalRule: false,
    link: false,
  }),
];

type Tool = { key: string; icon: LucideIcon; run: (editor: Editor) => void; active: (editor: Editor) => boolean };

const TOOLS: Tool[] = [
  { key: 'h2', icon: Heading2, run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), active: (e) => e.isActive('heading', { level: 2 }) },
  { key: 'h3', icon: Heading3, run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), active: (e) => e.isActive('heading', { level: 3 }) },
  { key: 'bold', icon: Bold, run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive('bold') },
  { key: 'italic', icon: Italic, run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive('italic') },
  { key: 'bulletList', icon: List, run: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive('bulletList') },
  { key: 'orderedList', icon: ListOrdered, run: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive('orderedList') },
];

const toolButton =
  'grid size-9 place-items-center rounded-lg text-navy-deep transition-colors hover:bg-ice-blue aria-pressed:bg-ice-blue';

/**
 * The partner note's editor (#148), Word-like: titles, bold, italic,
 * lists, and « Insérer un champ » for a placeholder ({client}…) where the
 * cursor is. `label` names the text area for screen readers.
 */
export function NoteEditor({
  initial,
  label,
  onChange,
}: {
  initial: NoteDoc;
  label: string;
  onChange: (doc: NoteDoc) => void;
}): ReactNode {
  const t = useTranslations('DocumentServices.handoff');
  const fieldsId = useId();
  const editor = useEditor({
    extensions: EXTENSIONS,
    content: initial,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        'aria-label': label,
        role: 'textbox',
        'aria-multiline': 'true',
        class: 'article-body min-h-60 px-5 py-4 text-sm text-navy-deep focus:outline-none',
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getJSON() as NoteDoc),
  });
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => Object.fromEntries(TOOLS.map((tool) => [tool.key, current ? tool.active(current) : false])),
  });

  const insert = (field: HandoffField) => editor?.chain().focus().insertContent(`{${field}}`).run();

  return (
    <div className="overflow-hidden rounded-xl border-2 border-fog-light bg-white focus-within:border-navy-deep">
      <div role="toolbar" aria-label={t('toolbar')} className="flex flex-wrap items-center gap-1 border-b border-fog-light bg-off-white px-2 py-1.5">
        {TOOLS.map((tool) => (
          <button
            key={tool.key}
            type="button"
            title={t(`tools.${tool.key}`)}
            aria-label={t(`tools.${tool.key}`)}
            aria-pressed={active?.[tool.key] ?? false}
            disabled={!editor}
            onClick={() => editor && tool.run(editor)}
            className={toolButton}
          >
            <tool.icon aria-hidden={true} className="size-4" />
          </button>
        ))}
        <label htmlFor={fieldsId} className="sr-only">
          {t('insertField')}
        </label>
        <select
          id={fieldsId}
          value=""
          disabled={!editor}
          onChange={(event) => {
            if (event.target.value) insert(event.target.value as HandoffField);
          }}
          className="ml-auto h-9 rounded-lg border border-fog-light bg-white px-2 text-sm font-semibold text-navy-deep"
        >
          <option value="">{t('insertField')}</option>
          {HANDOFF_FIELDS.map((field) => (
            <option key={field} value={field}>
              {t(`fields.${field}`)}
            </option>
          ))}
        </select>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
