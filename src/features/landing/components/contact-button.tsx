'use client';

import { ArrowUpRight, ChevronRight, Mail, Megaphone, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useState, type ReactNode } from 'react';

import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { WhatsAppGlyph } from '@/features/landing/components/social-glyphs';
import { WHATSAPP_CHANNEL_URL } from '@/features/shared/data/links';
import { Link } from '@/i18n/navigation';

/** Stanzy's WhatsApp, for a message. */
export const WHATSAPP_MESSAGE_URL = 'https://wa.me/237679306015';

/** Stanzy's face, from his drawing (`public/stanzy/idle.svg`), cropped to the head. */
function StanzyFace({ size }: { size: 'sm' | 'md' }): ReactNode {
  return (
    <span className={size === 'md' ? 'relative block size-15 shrink-0 overflow-hidden rounded-full bg-ice-blue' : 'relative block size-14 shrink-0 overflow-hidden rounded-full bg-ice-blue'}>
      <Image unoptimized={true} src="/stanzy/idle.svg" alt="" width={240} height={420} className="absolute -top-3 left-1/2 h-auto w-30 max-w-none -translate-x-1/2" />
    </span>
  );
}

/**
 * The phone's contact button (`PWA · Pied de page mobile · C Retenu`):
 * Stanzy's face above the tab bar, a green « en ligne » dot. It opens
 * « Parler à Stanzy »: a WhatsApp message, the WhatsApp channel, the
 * Contact page. Hidden from `md` up.
 */
export function ContactButton(): ReactNode {
  const t = useTranslations('Home.ContactButton');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('open')}
        className="fixed right-4 z-40 block rounded-full border-3 border-white shadow-lg shadow-navy-deep/25 md:hidden"
        style={{ bottom: 'calc(5.25rem + max(0px, env(safe-area-inset-bottom) - 0.75rem))' }}
      >
        <StanzyFace size="md" />
        <span aria-hidden={true} className="absolute -top-0.5 -right-0.5 size-3.5 rounded-full border-2 border-white bg-leaf" />
      </button>
      <Drawer open={open} onOpenChange={setOpen} showSwipeHandle={true}>
        <DrawerContent className="rounded-t-3xl bg-white px-5 pt-2 md:hidden" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          <div className="flex items-center gap-3.5 py-4">
            <StanzyFace size="sm" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <DrawerTitle className="font-heading text-h4 font-extrabold tracking-tight text-navy-deep">{t('title')}</DrawerTitle>
              <p className="flex items-center gap-1.5 text-body-sm text-slate">
                <span aria-hidden={true} className="size-2 rounded-full bg-leaf" />
                {t('reply')}
              </p>
            </div>
            <DrawerClose aria-label={t('close')} className="grid size-9 shrink-0 place-items-center rounded-full bg-ice-blue text-navy-deep">
              <X aria-hidden={true} className="size-4" strokeWidth={2.6} />
            </DrawerClose>
          </div>
          <a
            href={WHATSAPP_MESSAGE_URL}
            target="_blank"
            rel="noreferrer"
            className="flex h-14 items-center justify-center gap-2.5 rounded-full bg-whatsapp font-heading text-body font-bold text-white"
          >
            <WhatsAppGlyph className="size-5.5" />
            {t('message')}
          </a>
          <ul className="mt-4 flex flex-col divide-y divide-fog-light rounded-2xl border border-fog-light">
            <li>
              <a href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3.5">
                <Megaphone aria-hidden={true} className="size-5.5 shrink-0 text-navy-deep" strokeWidth={2} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body font-bold text-ink">{t('channel')}</span>
                  <span className="text-caption text-slate">{t('channelLead')}</span>
                </span>
                <ArrowUpRight aria-hidden={true} className="size-4 shrink-0 text-slate-mute" strokeWidth={2.4} />
              </a>
            </li>
            <li>
              <Link href="/contact" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-3.5">
                <Mail aria-hidden={true} className="size-5.5 shrink-0 text-rouge" strokeWidth={2} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body font-bold text-ink">{t('contact')}</span>
                  <span className="text-caption text-slate">{t('contactLead')}</span>
                </span>
                <ChevronRight aria-hidden={true} className="size-4 shrink-0 text-slate-mute" strokeWidth={2.4} />
              </Link>
            </li>
          </ul>
        </DrawerContent>
      </Drawer>
    </>
  );
}
