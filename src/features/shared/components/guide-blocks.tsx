'use client';

import { ArrowRight, ExternalLink, Info, MessageCircle, XIcon } from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { GuideBlock } from '@/features/shared/lib/guide-blocks';
import { Link } from '@/i18n/navigation';

/** A page of this site (`/…`) opens in the visitor's language; anything else in a new tab. */
function GuideLink({ href, className, children }: { href: string; className: string; children: ReactNode }): ReactNode {
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  );
}

/** A two-column table; its title sits above the rounded frame and names it. */
function GuideTable({ block }: { block: Extract<GuideBlock, { kind: 'table' }> }): ReactNode {
  const id = useId();
  return (
    <div>
      <p id={id} className="mb-2 font-heading text-body-sm font-bold text-navy-deep">
        {block.caption}
      </p>
      <div className="overflow-hidden rounded-xl border border-fog-light">
        <table aria-labelledby={id} className="w-full text-body-sm">
          {block.head && (
            <thead className="bg-off-white">
              <tr>
                {block.head.map((cell) => (
                  <th key={cell} scope="col" className="px-3.5 py-2 text-left font-label uppercase tracking-wider text-slate">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {block.rows.map(([label, value]) => (
              <tr key={label} className="border-t border-fog-light first:border-t-0">
                <th scope="row" className="px-3.5 py-2.5 text-left font-medium leading-relaxed text-slate">
                  {label}
                </th>
                <td className="px-3.5 py-2.5 text-right font-heading font-bold text-navy-deep tabular-nums">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Block({ block }: { block: GuideBlock }): ReactNode {
  switch (block.kind) {
    case 'text':
      return <p className="text-body-sm leading-relaxed text-slate">{block.text}</p>;
    case 'table':
      return <GuideTable block={block} />;
    case 'list':
      return (
        <div>
          {block.title && <h3 className="mb-1.5 font-heading text-body-sm font-bold text-navy-deep">{block.title}</h3>}
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-body-sm leading-relaxed text-slate marker:text-rouge">
            {block.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      );
    case 'note':
      return (
        <p className="flex gap-2 rounded-xl border border-rose bg-blush px-3.5 py-3 text-body-sm font-medium leading-relaxed text-navy-deep">
          <Info aria-hidden={true} className="mt-0.5 size-4 shrink-0 text-rouge" />
          {block.text}
        </p>
      );
    case 'link':
      return (
        <GuideLink
          href={block.href}
          className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-navy-deep underline underline-offset-2 hover:text-rouge"
        >
          {block.label}
          {!block.href.startsWith('/') && <ExternalLink aria-hidden={true} className="size-3.5" />}
        </GuideLink>
      );
    case 'cta':
      return (
        <GuideLink
          href={block.href}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-center font-heading text-body-sm font-bold text-white hover:opacity-90 ${
            block.tone === 'whatsapp' ? 'bg-whatsapp' : 'bg-rouge'
          }`}
        >
          {block.tone === 'whatsapp' ? (
            <MessageCircle aria-hidden={true} className="size-4 shrink-0" />
          ) : (
            <ArrowRight aria-hidden={true} className="size-4 shrink-0" />
          )}
          {block.label}
        </GuideLink>
      );
  }
}

/** A guide's blocks, one under the other: the body of an « En savoir plus » dialog. */
export function GuideBlocks({ blocks }: { blocks: GuideBlock[] }): ReactNode {
  return blocks.map((block, i) => <Block key={i} block={block} />);
}

/**
 * The « En savoir plus » dialog: a title bar that stays on top while the guide
 * scrolls, then the guide. `header` sits under the title (e.g. a document's
 * « Obligatoire » badge).
 */
export function GuideDialog({
  open,
  onOpenChange,
  title,
  closeLabel,
  header,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  header?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-h-9/10 gap-0 overflow-y-auto p-0 sm:max-w-lg lg:max-w-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-fog-light bg-white px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <DialogTitle className="font-heading text-h4 font-bold text-navy-deep">{title}</DialogTitle>
            {header}
          </div>
          <DialogClose
            aria-label={closeLabel}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-off-white text-navy-deep hover:bg-ice-blue"
          >
            <XIcon aria-hidden={true} className="size-4" />
          </DialogClose>
        </div>
        <div className="flex flex-col gap-5 px-5 py-5 lg:px-7 lg:py-6">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
