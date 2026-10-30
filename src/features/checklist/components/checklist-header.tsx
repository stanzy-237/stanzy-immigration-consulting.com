import type { ReactNode } from 'react';

/** The Checklist pages' header, like the other tools'. */
export function ChecklistHeader({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }): ReactNode {
  return (
    <header className="mx-auto max-w-3xl px-5 pt-12 pb-8 text-center sm:px-8 lg:pt-16">
      <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose bg-blush px-3 py-1 font-label uppercase tracking-widest text-rouge">
        <span aria-hidden={true} className="size-1.5 rounded-full bg-rouge" />
        {eyebrow}
      </p>
      <h1 className="font-heading text-h2 font-bold leading-tight tracking-tight text-navy-deep sm:text-h1">{title}</h1>
      <p className="mx-auto mt-4 max-w-xl text-body text-slate">{lead}</p>
    </header>
  );
}
