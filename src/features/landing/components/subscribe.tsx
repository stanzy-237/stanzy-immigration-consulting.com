'use client';

import { ArrowRight, ArrowUpRight, Check } from 'lucide-react';
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
      className="bg-[#F7F8FC] px-7 py-[88px]"
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* Left: copy + benefits */}
          <div>
            <div className="mb-[18px] inline-flex items-center gap-2 rounded-full border-[1.5px] border-[#CBD5E0] bg-[#E8EDF5] px-3.5 py-[5px]">
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
            <p className="mt-4 max-w-[520px] text-[15px] leading-[1.65] text-[#4A5568]">
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
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E8EDF5]"
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
          <div className="rounded-[24px] border-[1.5px] border-[#E2E8F0] bg-[#F7F8FC] p-8 shadow-[0_12px_32px_rgba(13,31,78,0.08)]">
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
                className="h-12 rounded-full border-[1.5px] border-[#CBD5E0] bg-white px-5 text-[14px] text-navy-deep placeholder:text-[#9CA3AF] focus:border-navy-deep focus:outline-hidden"
              />
              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center rounded-full bg-rouge px-5 font-heading text-[14px] font-bold text-white shadow-[0_4px_14px_rgba(204,22,39,0.28)] transition-all hover:-translate-y-[1px] hover:bg-[#D93344]"
              >
                {t('submit')}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#4A5568]">
              <span className="h-px flex-1 bg-[#E2E8F0]" />
              {t('or')}
              <span className="h-px flex-1 bg-[#E2E8F0]" />
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
                <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
              </span>
              <span className="flex-1">
                <span className="block font-heading text-[14px] font-bold text-navy-deep">
                  {t('whatsappTitle')}
                </span>
                <span className="block text-[12px] text-[#4A5568]">
                  {t('whatsappSub')}
                </span>
              </span>
              <ArrowUpRight
                className="h-4 w-4 text-navy-deep transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={2.5}
              />
            </a>
            <p className="mt-4 text-[12px] text-[#4A5568]">{t('privacy')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
