import { ArrowUpRight, Mail, MapPin, Megaphone, Phone, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { WHATSAPP_MESSAGE_URL } from '@/features/landing/components/contact-button';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { WhatsAppGlyph } from '@/features/landing/components/social-glyphs';
import { FOOTER_CONTACT } from '@/features/landing/data/footer';
import { WHATSAPP_CHANNEL_URL } from '@/features/shared/data/links';

const ROWS: { key: 'email' | 'phone' | 'channel' | 'office'; href: string | null; icon: LucideIcon; external?: true }[] = [
  { key: 'email', href: FOOTER_CONTACT.email, icon: Mail },
  { key: 'phone', href: FOOTER_CONTACT.phone, icon: Phone },
  { key: 'channel', href: WHATSAPP_CHANNEL_URL, icon: Megaphone, external: true },
  { key: 'office', href: null, icon: MapPin },
];

/** `/contact`: WhatsApp first, then the email, the phone, the channel and the office, as rows. */
export function ContactView(): ReactNode {
  const t = useTranslations('Home.ContactPage');
  return (
    <>
      <SiteNav />
      <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 pt-6 pb-12 md:pt-14">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-h3 leading-9 font-extrabold tracking-tight text-navy-deep">{t('title')}</h1>
          <p className="text-body text-slate">{t('lead')}</p>
        </div>
        <a href={WHATSAPP_MESSAGE_URL} target="_blank" rel="noreferrer" className="flex h-14 items-center justify-center gap-2.5 rounded-full bg-whatsapp font-heading text-body font-bold text-white">
          <WhatsAppGlyph className="size-5.5" />
          {t('whatsapp')}
        </a>
        <ul className="flex flex-col divide-y divide-fog-light rounded-2xl border border-fog-light bg-white">
          {ROWS.map(({ key, href, icon: Icon, external }) => {
            const body = (
              <>
                <Icon aria-hidden={true} className="size-5 shrink-0 text-navy-deep" strokeWidth={2} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-caption text-slate">{t(`${key}.label`)}</span>
                  <span className="truncate text-body font-semibold text-ink">{t(`${key}.value`)}</span>
                </span>
                {external ? <ArrowUpRight aria-hidden={true} className="size-4 shrink-0 text-slate-mute" strokeWidth={2.4} /> : null}
              </>
            );
            return (
              <li key={key}>
                {href ? (
                  <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})} className="flex items-center gap-3 px-4 py-3.5">
                    {body}
                  </a>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
