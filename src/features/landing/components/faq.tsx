'use client';

import { ArrowRight, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { Link } from '@/i18n/navigation';
import { FAQ_ITEMS, type FaqItem } from '@/features/landing/data/faq';

export function Faq(): ReactNode {
  const t = useTranslations('Home.Faq');
  const tItems = useTranslations('Home.Faq.Items');
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0]?.id ?? null);

  return (
    <section
      aria-labelledby="faq-title"
      className="bg-navy-deep px-5 py-14 md:px-7 md:py-24 text-white"
    >
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Left column */}
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3.5 py-1.5">
            <span
              aria-hidden={true}
              className="h-1 w-4 shrink-0 self-center rounded-full bg-rouge"
            />
            <span className="font-sans text-xs font-semibold uppercase tracking-widest text-white">
              {t('eyebrow')}
            </span>
          </div>
          <h2
            id="faq-title"
            className="font-heading text-[clamp(32px,4vw,50px)] font-bold leading-none tracking-tight text-white"
          >
            {t('titleLead')}
            <br />
            <span className="text-rouge">{t('titleAccent')}</span>
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/70">
            {t('contactDesc')}
          </p>
          <Link
            href="/services/consultation"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border-2 border-rouge bg-rouge px-5 font-heading text-sm font-semibold text-white transition-all hover:-translate-y-px hover:bg-crimson"
          >
            {t('ctaContact')}
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </Link>
        </div>

        {/* Right: accordion */}
        <ul role="list" className="divide-y divide-white/10 border-y border-white/10">
          {FAQ_ITEMS.map((item: FaqItem): ReactNode => {
            const open = openId === item.id;
            return (
              <li key={item.id} role="listitem">
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`faq-a-${item.id}`}
                  onClick={() => setOpenId(open ? null : item.id)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left font-heading text-base font-semibold text-white transition-colors hover:text-rouge"
                >
                  <span>{tItems(item.qKey)}</span>
                  <span
                    aria-hidden={true}
                    className={
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 transition-all duration-200 ' +
                      (open
                        ? 'rotate-45 border-rouge bg-rouge'
                        : 'bg-transparent')
                    }
                  >
                    <Plus className="h-4 w-4 text-white" strokeWidth={2.5} />
                  </span>
                </button>
                <div
                  id={`faq-a-${item.id}`}
                  role="region"
                  className={
                    'grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out ' +
                    (open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')
                  }
                >
                  <div className="min-h-0">
                    <p className="pb-5 pr-10 text-sm leading-relaxed text-white/70">
                      {tItems(item.aKey)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
