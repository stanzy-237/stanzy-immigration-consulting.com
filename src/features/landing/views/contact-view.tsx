'use client';

import { Copy, MapPin, Phone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import type { ReactNode } from 'react';

import { toast } from '@/components/ui/toast';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { FOOTER_CONTACT, FOOTER_SOCIALS } from '@/features/landing/data/footer';
import { WHATSAPP_CHANNEL_URL } from '@/features/shared/data/links';
import { cn } from '@/lib/utils';

const EMAIL = FOOTER_CONTACT.email.replace(/^mailto:/, '');
const MAPS_URL = 'https://maps.google.com/?q=Douala%2C%20Cameroun';
/** WhatsApp here is the channel: what someone following Stanzy wants. */
const SOCIALS = [
  { key: 'whatsapp', href: WHATSAPP_CHANNEL_URL, iconSrc: '/icons/social/whatsapp.svg' },
  ...FOOTER_SOCIALS.filter((s) => s.key !== 'whatsapp' && s.key !== 'facebook'),
  ...FOOTER_SOCIALS.filter((s) => s.key === 'facebook'),
] as const;

/**
 * `/contact` (`PWA · Contact · Retenu`): Stanzy waving under his bubble, the
 * phone (call), the email (copy) and the office (map), then the networks.
 */
export function ContactView(): ReactNode {
  const t = useTranslations('Home.ContactPage');
  const tSocial = useTranslations('Home.Footer.Social');
  const copyEmail = () =>
    void navigator.clipboard
      .writeText(EMAIL)
      .then(() => toast.add({ title: t('copied'), type: 'success' }))
      .catch(() => window.prompt(t('email.label'), EMAIL));

  return (
    <>
      <SiteNav />
      <main className="mx-auto flex w-full max-w-md flex-col gap-7 px-5 pt-6 pb-12 md:pt-14">
        <h1 className="sr-only">{t('title')}</h1>
        <div className="flex flex-col items-center gap-3.5">
          <p className="flex flex-col items-center gap-0.5 rounded-2xl border border-fog-light bg-white px-5 py-3 text-center">
            <span className="font-heading text-body font-extrabold text-navy-deep">{t('hello')}</span>
            <span className="text-body-sm text-slate">{t('ask')}</span>
          </p>
          <span className="relative size-32 overflow-hidden rounded-full bg-ice-blue">
            <Image unoptimized={true} src="/stanzy/wave.svg" alt="" width={240} height={420} priority={true} className="absolute -top-4 left-1/2 h-auto w-44 max-w-none -translate-x-1/2" />
          </span>
        </div>

        <ul className="flex flex-col gap-2.5">
          <Row label={t('phone.label')} value={t('phone.value')}>
            <a href={FOOTER_CONTACT.phone} aria-label={t('call')} className={cn(ROUND, 'bg-navy-deep text-white')}>
              <Phone aria-hidden={true} className="size-5" strokeWidth={2} />
            </a>
          </Row>
          <Row label={t('email.label')} value={EMAIL}>
            <button type="button" onClick={copyEmail} aria-label={t('copy')} className={cn(ROUND, 'bg-ice-blue text-navy-deep')}>
              <Copy aria-hidden={true} className="size-5" strokeWidth={2} />
            </button>
          </Row>
          <Row label={t('office.label')} value={t('office.value')}>
            <a href={MAPS_URL} target="_blank" rel="noreferrer" aria-label={t('map')} className={cn(ROUND, 'bg-blush text-rouge')}>
              <MapPin aria-hidden={true} className="size-5" strokeWidth={2} />
            </a>
          </Row>
        </ul>

        <section aria-labelledby="follow" className="flex flex-col items-center gap-3">
          <h2 id="follow" className="text-body-sm font-semibold text-ink">
            {t('follow')}
          </h2>
          <ul className="flex gap-3.5">
            {SOCIALS.map((s) => (
              <li key={s.key}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={tSocial(s.key)}
                  className="grid size-13 place-items-center rounded-full border border-fog-light bg-white hover:border-navy-deep"
                >
                  <Image src={s.iconSrc} alt="" width={26} height={26} className="size-6.5" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

const ROUND = 'grid size-11 shrink-0 place-items-center rounded-full';

function Row({ label, value, children }: { label: string; value: string; children: ReactNode }): ReactNode {
  return (
    <li className="flex items-center gap-3.5 rounded-2xl border border-fog-light bg-white py-3 pr-3 pl-4">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-caption text-slate">{label}</span>
        <span className="truncate text-body font-bold text-ink">{value}</span>
      </span>
      {children}
    </li>
  );
}
