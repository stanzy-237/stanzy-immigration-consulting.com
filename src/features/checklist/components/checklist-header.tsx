import type { ReactNode } from 'react';

/** The Checklist pages' header, as on the calculators: left-aligned, the title's end in red. */
export function ChecklistHeader({
  eyebrow,
  title,
  accent,
  lead,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  lead: string;
}): ReactNode {
  return (
    <header className="mx-auto max-w-6xl px-5 pb-10 pt-12 sm:px-8 lg:pt-16">
      <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose bg-blush px-3 py-1 font-label text-rouge">
        <span aria-hidden={true} className="size-2 rounded-full bg-rouge" />
        {eyebrow}
      </p>
      <h1 className="font-heading text-h2 font-bold leading-tight text-navy-deep sm:text-h1">
        {title} <span className="text-rouge">— {accent}</span>
      </h1>
      <p className="mt-5 max-w-2xl text-body-lg text-slate">{lead}</p>
    </header>
  );
}
