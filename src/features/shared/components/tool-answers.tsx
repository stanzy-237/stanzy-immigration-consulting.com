'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { JsonLd } from '@/components/json-ld';

/** The tools with an « En bref » block, keyed like `ToolAnswers.<tool>` in the messages. */
export type ToolAnswersKey = 'crs' | 'fsw' | 'nclc' | 'draws' | 'ita' | 'budget' | 'checklist' | 'pdf';

const QUESTIONS = [
  { q: 'q1', a: 'a1' },
  { q: 'q2', a: 'a2' },
] as const;

/**
 * « En bref » under a calculator (Paper: Outils · Réponses en bref): the two
 * questions people search for, each an H2 with a 40–60-word answer that search
 * and answer engines can quote, plus the same pairs as FAQPage data. Both
 * answers are open on a computer; on a phone they fold, the first one open.
 * Folded answers stay in the HTML, so they are still read.
 */
export function ToolAnswers({ tool }: { tool: ToolAnswersKey }): ReactNode {
  const t = useTranslations('ToolAnswers');
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const titleId = `${tool}-answers-title`;
  const items = QUESTIONS.map(({ q, a }) => ({ question: t(`${tool}.${q}`), answer: t(`${tool}.${a}`) }));

  return (
    <section aria-labelledby={titleId} className="mx-auto max-w-6xl px-5 pb-14 sm:px-8 md:pb-16">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: items.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        }}
      />
      <p className="font-label text-rouge">{t('eyebrow')}</p>
      <p id={titleId} className="mt-2 font-heading text-2xl font-bold tracking-tight text-navy-deep md:text-h3">
        {t(`${tool}.title`)}
      </p>
      <ul className="mt-5 divide-y divide-fog border-y border-fog md:mt-8 md:grid md:grid-cols-2 md:gap-12 md:divide-y-0 md:border-y-0">
        {items.map((item, index) => {
          const open = openIndex === index;
          const answerId = `${tool}-answer-${index + 1}`;
          return (
            <li key={answerId} className="py-4 md:border-t md:border-fog md:pt-6 md:pb-0">
              <span aria-hidden={true} className="mb-3 hidden h-0.5 w-6 bg-rouge md:block" />
              <h2 className="font-heading text-lg font-bold text-navy-deep md:text-xl">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={answerId}
                  onClick={() => setOpenIndex(open ? null : index)}
                  className="flex w-full items-start justify-between gap-3 text-left md:pointer-events-none"
                >
                  <span>{item.question}</span>
                  <ChevronDown
                    aria-hidden={true}
                    className={`mt-0.5 size-5 shrink-0 transition-transform md:hidden ${open ? 'rotate-180 text-rouge' : 'text-navy-deep'}`}
                  />
                </button>
              </h2>
              <p id={answerId} className={`mt-2.5 text-body text-slate md:mt-3 md:block ${open ? 'block' : 'hidden'}`}>
                {item.answer}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
