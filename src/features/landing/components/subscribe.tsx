'use client';

import { ArrowUpRight, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent, type ReactNode } from 'react';

import { track } from '@/lib/analytics';

const WHATSAPP_CHANNEL_HREF =
  'https://whatsapp.com/channel/0029Vb2Xp2F1CYoJfufA4c2R';

export function Subscribe(): ReactNode {
  const t = useTranslations('Home.Subscribe');
  const [email, setEmail] = useState<string>('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    track('subscribe.email');
  };
  const handleWhatsapp = (): void => {
    track('subscribe.whatsapp');
  };

  return (
    <section
      aria-labelledby="subscribe-title"
      className="bg-off-white px-5 py-14 md:px-7 md:py-[88px]"
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* Left: copy + benefits */}
          <div>
            <div className="mb-[18px] inline-flex items-center gap-2 rounded-full border-[1.5px] border-fog bg-ice-blue px-3.5 py-[5px]">
              <span
                aria-hidden={true}
                className="h-1 w-[18px] shrink-0 self-center rounded-full bg-navy-deep"
              />
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-deep">
                {t('eyebrow')}
              </span>
            </div>
            <h2
              id="subscribe-title"
              className="font-heading text-[clamp(30px,3.6vw,46px)] font-bold leading-[1.08] tracking-[-0.03em] text-navy-deep"
            >
              {t('titleLead')}
              <br />
              <span className="text-rouge">{t('titleRest')}</span>
            </h2>
            <p className="mt-4 max-w-[520px] text-[15px] leading-[1.65] text-slate">
              {t('body')}
            </p>
            <ul className="mt-6 space-y-2.5">
              {['benefit1', 'benefit2', 'benefit3'].map(
                (key: string): ReactNode => (
                  <li
                    key={key}
                    className="flex items-start gap-2.5 text-[14px] text-navy-deep"
                  >
                    <span
                      aria-hidden={true}
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ice-blue"
                    >
                      <Check
                        className="h-3 w-3 text-navy-deep"
                        strokeWidth={2.5}
                      />
                    </span>
                    {t(key)}
                  </li>
                ),
              )}
            </ul>
          </div>

          {/* Right: form card */}
          <div className="rounded-[24px] border-[1.5px] border-fog-light bg-off-white p-8 shadow-[0_12px_32px_rgba(13,31,78,0.08)]">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label
                htmlFor="subscribe-email"
                className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-navy-deep"
              >
                {t('emailLabel')}
              </label>
              <input
                id="subscribe-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                className="h-12 rounded-full border-[1.5px] border-fog bg-white px-5 text-[14px] text-navy-deep placeholder:text-slate-mute focus:border-navy-deep focus:outline-hidden"
              />
              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center rounded-full bg-rouge px-5 font-heading text-[14px] font-bold text-white shadow-[0_4px_14px_rgba(204,22,39,0.28)] transition-all hover:-translate-y-[1px] hover:bg-crimson"
              >
                {t('submit')}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-slate">
              <span className="h-px flex-1 bg-fog-light" />
              {t('or')}
              <span className="h-px flex-1 bg-fog-light" />
            </div>

            <a
              href={WHATSAPP_CHANNEL_HREF}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleWhatsapp}
              className="group flex items-center gap-3 rounded-2xl border-[1.5px] border-[#25D366] bg-white p-4 text-navy-deep no-underline transition-all hover:-translate-y-[1px] hover:bg-[#F0FDF4]"
            >
              <span
                aria-hidden={true}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5"
                  aria-hidden={true}
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </span>
              <span className="flex-1">
                <span className="block font-heading text-[14px] font-bold text-navy-deep">
                  {t('whatsappTitle')}
                </span>
                <span className="block text-[12px] text-slate">
                  {t('whatsappSub')}
                </span>
              </span>
              <ArrowUpRight
                className="h-4 w-4 text-navy-deep transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={2.5}
              />
            </a>
            <p className="mt-4 text-[12px] text-slate">{t('privacy')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
