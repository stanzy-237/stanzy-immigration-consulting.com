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

/** « Ce que vous obtenez »: a band under the form, what the list gives in detail. */
export function ChecklistIntro(): ReactNode {
  const t = useTranslations('Checklist.intro');
  return (
    <section aria-labelledby="checklist-intro" className="border-t border-fog bg-white">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <p className="font-label text-rouge">{t('free')}</p>
        <h2 id="checklist-intro" className="mt-3 font-heading text-h3 font-bold text-navy-deep">
          {t('title')}
        </h2>
        <ul className="mt-8 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map(({ key, icon: Icon }) => (
            <li key={key} className="flex gap-3.5">
              <span aria-hidden={true} className="grid size-11 shrink-0 place-items-center rounded-xl bg-blush text-rouge">
                <Icon className="size-5" />
              </span>
              <div>
                <h3 className="font-heading text-body font-bold text-navy-deep">{t(`items.${key}.title`)}</h3>
                <p className="mt-1 text-body-sm leading-relaxed text-slate">{t(`items.${key}.text`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
