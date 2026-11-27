import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import type { ReactNode } from 'react';

import { LastDrawCard } from '@/features/landing/components/last-draw-card';
import { LocaleToggle } from '@/features/landing/components/locale-toggle';
import { Link } from '@/i18n/navigation';

const SERVICES = [
  { key: 'consultation', href: '/services/consultation' },
  { key: 'accompagnement', href: '/services/accompagnement' },
  { key: 'documents', href: '/services#services-documents' },
] as const;

/**
 * The home page on a phone (`PWA · Visiteur · 1 Accueil`): the logo and
 * FR / EN, the promise, « Réserver une consultation » and « Calculer mon
 * score CRS », the last Tirage, the three services as rows. The rest of the
 * home page follows below; the desktop hero is hidden.
 */
export function PhoneHome(): ReactNode {
  const t = useTranslations('Home.Phone');
  const tNav = useTranslations('Home.Nav');
  return (
    <section aria-labelledby="phone-home" className="flex flex-col gap-5 bg-off-white px-5 pt-4 pb-8 md:hidden">
      <div className="flex items-center justify-between">
        <Image src="/logo2.png" alt={tNav('brand')} width={502} height={468} priority={true} className="size-10" />
        <LocaleToggle ariaLabel={tNav('localeToggle')} />
      </div>
      <div className="flex flex-col gap-3">
        <p className="font-label text-caption font-bold tracking-wide text-rouge uppercase">{t('eyebrow')}</p>
        <h1 id="phone-home" className="font-heading text-h3 leading-9 font-extrabold tracking-tight text-navy-deep">
          {t('title')}
        </h1>
        <p className="text-body leading-6 text-slate">{t('lead')}</p>
      </div>
      <div className="flex flex-col gap-2.5">
        <Link href="/services/consultation" className="flex h-13 items-center justify-center rounded-full bg-rouge font-heading text-body font-bold text-white">
          {t('book')}
        </Link>
        <Link href="/outils/crs" className="flex h-13 items-center justify-center rounded-full border-2 border-navy-deep font-heading text-body font-bold text-navy-deep">
          {t('crs')}
        </Link>
      </div>
      <LastDrawCard />
      <div className="flex flex-col gap-2">
        <h2 className="px-1 font-label text-caption font-bold tracking-wide text-slate uppercase">{t('services')}</h2>
        <ul className="flex flex-col divide-y divide-fog-light rounded-2xl border border-fog-light bg-white">
          {SERVICES.map(({ key, href }) => (
            <li key={key}>
              <Link href={href} className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body font-bold text-ink">{t(`service.${key}.name`)}</span>
                  <span className="truncate text-caption text-slate">{t(`service.${key}.lead`)}</span>
                </span>
                <ChevronRight aria-hidden={true} className="size-4 shrink-0 text-slate-mute" strokeWidth={2.4} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
