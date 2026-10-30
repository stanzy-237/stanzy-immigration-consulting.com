import { BookOpenText, ClipboardCheck, Link2, ListChecks, Receipt, Users, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

const ITEMS: ReadonlyArray<{ key: 'people' | 'need' | 'guides' | 'fees' | 'progress' | 'prefill'; icon: LucideIcon }> = [
  { key: 'people', icon: Users },
  { key: 'need', icon: ListChecks },
  { key: 'guides', icon: BookOpenText },
  { key: 'fees', icon: Receipt },
  { key: 'progress', icon: ClipboardCheck },
  { key: 'prefill', icon: Link2 },
];

/** « Ce que vous obtenez »: what the list gives, before the questions. */
export function ChecklistIntro(): ReactNode {
  const t = useTranslations('Checklist.intro');
  return (
    <section aria-labelledby="checklist-intro" className="mb-6 rounded-2xl border border-fog bg-white p-5 shadow-sm sm:p-6">
      <h2 id="checklist-intro" className="font-heading text-h4 font-bold text-navy-deep">
        {t('title')}
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {ITEMS.map(({ key, icon: Icon }) => (
          <li key={key} className="flex gap-3">
            <span aria-hidden={true} className="grid size-10 shrink-0 place-items-center rounded-xl bg-blush text-rouge">
              <Icon className="size-5" />
            </span>
            <div>
              <h3 className="font-heading text-body font-bold text-navy-deep">{t(`items.${key}.title`)}</h3>
              <p className="mt-0.5 text-body-sm leading-relaxed text-slate">{t(`items.${key}.text`)}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-5 border-t border-fog-light pt-4 font-label text-rouge">{t('free')}</p>
    </section>
  );
}
