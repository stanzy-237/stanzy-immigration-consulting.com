import { Leaf, Mail, Phone, MapPin, CalendarCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import {
  FOOTER_CONTACT,
  FOOTER_CONTENT_LINKS,
  FOOTER_LEGAL_LINKS,
  FOOTER_SERVICE_LINKS,
  FOOTER_SOCIALS,
  FOOTER_TOOL_LINKS,
} from '@/features/landing/data/footer';

export function SiteFooter() {
  const t = useTranslations('Home.Footer');
  const tNav = useTranslations('Home.Nav');
  const tTools = useTranslations('Home.Nav.Tools');
  const tServices = useTranslations('Home.Nav.Services');
  const tSocial = useTranslations('Home.Footer.Social');
  const tContent = useTranslations('Home.Footer.content');
  const tLegal = useTranslations('Home.Footer.legal');

  const year = new Date().getFullYear();

  return (
    <footer
      aria-label={t('ariaLabel')}
      className="bg-navy-deep text-white mt-24 w-full"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-12 px-4 py-16 md:px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2 flex flex-col gap-4">
            <Link
              href="/"
              className="font-heading text-2xl font-bold tracking-tight"
            >
              {tNav('brand')}
            </Link>
            <p className="text-white/70 text-sm max-w-sm">{t('tagline')}</p>
            <ul className="flex gap-3">
              {FOOTER_SOCIALS.map((s) => {
                const Icon = s.icon;
                const label = tSocial(s.key);
                return (
                  <li key={s.key}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="hover:bg-white/10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 transition-colors"
                    >
                      <Icon aria-hidden className="h-4 w-4" />
                    </a>
                  </li>
                );
              })}
            </ul>
            <span className="mt-2 inline-flex items-center gap-1.5 self-start rounded-full border border-white/20 px-2.5 py-1 text-xs text-white/80">
              <Leaf aria-hidden className="text-rouge h-3.5 w-3.5" />
              {t('canadaBadge')}
            </span>
          </div>

          <FooterColumn title={t('columns.tools')}>
            {FOOTER_TOOL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-white/70 hover:text-white">
                  {tTools(link.labelKey)}
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title={t('columns.services')}>
            {FOOTER_SERVICE_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-white/70 hover:text-white">
                  {tServices(link.labelKey)}
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title={t('columns.content')}>
            {FOOTER_CONTENT_LINKS.map((link) =>
              link.external ? (
                <li key={link.key}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/70 hover:text-white"
                  >
                    {tContent(link.labelKey)}
                  </a>
                </li>
              ) : (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    className="text-white/70 hover:text-white"
                  >
                    {tContent(link.labelKey)}
                  </Link>
                </li>
              ),
            )}
          </FooterColumn>

          <FooterColumn title={t('columns.contact')}>
            <li>
              <a
                href={FOOTER_CONTACT.email}
                className="inline-flex items-center gap-2 text-white/70 hover:text-white"
              >
                <Mail aria-hidden className="h-4 w-4" />
                {t('contact.email')}
              </a>
            </li>
            <li>
              <a
                href={FOOTER_CONTACT.phone}
                className="inline-flex items-center gap-2 text-white/70 hover:text-white"
              >
                <Phone aria-hidden className="h-4 w-4" />
                {t('contact.phone')}
              </a>
            </li>
            <li className="inline-flex items-start gap-2 text-white/70">
              <MapPin aria-hidden className="mt-0.5 h-4 w-4" />
              <span>{t('contact.region')}</span>
            </li>
            <li>
              <Link
                href={FOOTER_CONTACT.bookingHref}
                className="bg-rouge mt-2 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white hover:bg-rouge/90"
              >
                <CalendarCheck aria-hidden className="h-4 w-4" />
                {t('contact.book')}
              </Link>
            </li>
          </FooterColumn>
        </div>

        <div className="border-t border-white/15 pt-6 flex flex-col-reverse items-start gap-4 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
          <p>{t('copyright', { year })}</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {FOOTER_LEGAL_LINKS.map((link) => (
              <li key={link.key}>
                <Link href={link.href} className="hover:text-white">
                  {tLegal(link.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-white/90">
        {title}
      </h3>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  );
}
