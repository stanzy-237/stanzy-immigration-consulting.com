'use client';

import { useLocale } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

const LABELS: Record<string, string> = {
  fr: 'Français',
  en: 'English',
};

/**
 * Switches locale while staying on the current page. Demonstrates the
 * locale-aware navigation helpers and makes `/fr` ↔ `/en` reachable from the UI.
 */
export function LocaleSwitcher({ label }: { label: string }) {
  const pathname = usePathname();
  const active = useLocale();

  return (
    <nav aria-label={label} className="flex gap-3 text-sm font-label">
      {routing.locales.map((locale) => (
        <Link
          key={locale}
          href={pathname}
          locale={locale}
          aria-current={locale === active ? 'true' : undefined}
          className={
            locale === active
              ? 'font-semibold text-rouge underline'
              : 'text-bleu/60 hover:text-bleu'
          }
        >
          {LABELS[locale]}
        </Link>
      ))}
    </nav>
  );
}
