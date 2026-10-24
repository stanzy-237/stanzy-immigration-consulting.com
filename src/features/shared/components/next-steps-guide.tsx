import { ArrowUpRight, CircleCheck } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { WHATSAPP_CHANNEL_URL } from '@/features/shared/data/links';
import { Link } from '@/i18n/navigation';

/**
 * The « À savoir » band beneath a calculator: what the application also
 * needs, Stanzy's support, a consultation call to action, and the WhatsApp
 * channel. Each calculator gives its own `title`, `text` and second link.
 */
export function NextStepsGuide({
  id,
  title,
  text,
  secondary,
}: {
  id: string;
  title: string;
  text: string;
  secondary: { href: string; label: string };
}): ReactNode {
  const t = useTranslations('Calculators.guide');
  const headingId = `${id}-guide-title`;

  return (
    <section aria-labelledby={headingId} className="border-t border-fog bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-14 sm:px-8 lg:flex-row">
        <div className="max-w-3xl">
          <p className="font-label text-rouge">{t('eyebrow')}</p>
          <h2 id={headingId} className="mt-3 font-heading text-h3 font-bold text-navy-deep">
            {title}
          </h2>
          <p className="mt-4 text-body text-slate">{text}</p>
          <p className="mt-6 text-body font-semibold text-navy-deep">{t('needsIntro')}</p>
          <ul className="mt-3 space-y-3">
            {(['experience', 'funds'] as const).map((need) => (
              <li key={need} className="flex items-center gap-3 text-body text-slate">
                <CircleCheck aria-hidden={true} className="mt-0.5 size-5 shrink-0 text-rouge" />
                <span>{t(`needs.${need}`)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-body text-navy-deep">{t('support')}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/services"
              className="rounded-full bg-rouge px-5 py-2.5 text-body-sm font-semibold text-white transition-colors hover:bg-crimson"
            >
              {t('consultation')}
            </Link>
            <Link
              href={secondary.href}
              className="rounded-full border border-fog px-5 py-2.5 text-body-sm font-semibold text-navy-deep transition-colors hover:bg-ice-blue"
            >
              {secondary.label}
            </Link>
            <a
              href={t('fundsUrl')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-body-sm font-semibold text-steel-blue underline-offset-2 hover:underline"
            >
              {t('fundsLink')}
              <ArrowUpRight aria-hidden={true} className="size-4" />
            </a>
          </div>
        </div>

        <aside className="mx-auto my-auto flex h-fit max-w-xl flex-col items-center rounded-2xl bg-navy-deep p-8 text-center text-white shadow-lg">
          <Image src="/icons/social/whatsapp.svg" alt="WhatsApp" width={56} height={56} className="size-14" />
          <h3 className="mt-4 font-heading text-h4 font-bold">{t('whatsappTitle')}</h3>
          <p className="mt-2 text-body-sm text-white/80">{t('whatsappText')}</p>
          <a
            href={WHATSAPP_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-whatsapp px-6 py-3 text-body-sm font-semibold text-navy-deep transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {t('whatsappCta')}
            <ArrowUpRight aria-hidden={true} className="size-4" />
          </a>
        </aside>
      </div>
    </section>
  );
}
