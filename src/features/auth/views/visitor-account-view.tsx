'use client';

import { ArrowUpRight, ChevronRight, Share, SquarePlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useEffect, useState, type ReactNode } from 'react';

import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { LocaleToggle } from '@/features/landing/components/locale-toggle';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { Link } from '@/i18n/navigation';

const WHATSAPP_URL = 'https://wa.me/237679306015';

/** Chrome's install prompt, kept until « Installer l'app » is tapped. */
type InstallPrompt = Event & { prompt: () => Promise<void> };

/**
 * « Compte » for a visitor (`PWA · Visiteur · 3 Compte`): Stanzy waving,
 * « Se connecter » and « Créer un compte », then the language, installing
 * the app on this phone and WhatsApp. Signed in, /compte is « Mon compte ».
 */
export function VisitorAccountView(): ReactNode {
  const t = useTranslations('Auth.Visitor');
  const tNav = useTranslations('Home.Nav');
  const [installing, setInstalling] = useState(false);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  useEffect(() => {
    const keep = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', keep);
    return () => window.removeEventListener('beforeinstallprompt', keep);
  }, []);
  const install = () => {
    // Android / Chrome: its own prompt. iPhone: how to add it from Safari.
    if (prompt) void prompt.prompt().finally(() => setPrompt(null));
    else setInstalling(true);
  };
  const row = 'flex w-full items-center gap-3 px-4 py-3.5 text-left text-body text-ink';

  return (
    <>
      <SiteNav />
      <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-5 pt-6 pb-10 md:pt-12">
        <h1 className="font-heading text-h3 leading-9 font-extrabold tracking-tight text-navy-deep">{t('title')}</h1>
        <section aria-labelledby="visitor-space" className="flex flex-col items-center gap-4 rounded-3xl border border-fog-light bg-white p-5 text-center">
          <div className="relative size-30 overflow-hidden rounded-full bg-ice-blue">
            <Image unoptimized={true} src="/stanzy/wave.svg" alt="" width={150} height={262} className="absolute top-3 left-1/2 h-auto w-24 -translate-x-1/2" />
          </div>
          <h2 id="visitor-space" className="font-heading text-h4 leading-7 font-extrabold text-navy-deep">
            {t('spaceTitle')}
          </h2>
          <p className="text-body-sm leading-5 text-slate">{t('spaceLead')}</p>
          <div className="flex w-full flex-col gap-2.5">
            <Link href="/connexion?next=%2Fmon-espace" className="flex h-13 items-center justify-center rounded-full bg-rouge font-heading text-body font-bold text-white">
              {t('signIn')}
            </Link>
            <Link href="/inscription?next=%2Fmon-espace" className="flex h-13 items-center justify-center rounded-full border-2 border-navy-deep font-heading text-body font-bold text-navy-deep">
              {t('signUp')}
            </Link>
          </div>
        </section>
        <ul className="flex flex-col divide-y divide-fog-light rounded-2xl border border-fog-light bg-white">
          <li className={row}>
            <span className="flex-1">{t('language')}</span>
            <LocaleToggle ariaLabel={tNav('localeToggle')} />
          </li>
          <li>
            <button type="button" onClick={install} className={row}>
              <span className="flex-1">{t('install')}</span>
              <ChevronRight aria-hidden={true} className="size-4 text-slate-mute" strokeWidth={2.4} />
            </button>
          </li>
          <li>
            <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className={row}>
              <span className="flex-1">{t('whatsapp')}</span>
              <ArrowUpRight aria-hidden={true} className="size-4 text-slate-mute" strokeWidth={2.4} />
            </a>
          </li>
        </ul>
      </main>
      <SiteFooter />
      <Drawer open={installing} onOpenChange={setInstalling} showSwipeHandle={true}>
        <DrawerContent className="rounded-t-3xl bg-white px-5 pt-2 pb-8">
          <DrawerTitle className="py-4 font-heading text-h4 font-bold text-navy-deep">{t('installTitle')}</DrawerTitle>
          <ol className="flex flex-col gap-3 text-body-sm text-ink">
            <li className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ice-blue text-navy-deep">
                <Share aria-hidden={true} className="size-4" strokeWidth={2.2} />
              </span>
              {t('installShare')}
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ice-blue text-navy-deep">
                <SquarePlus aria-hidden={true} className="size-4" strokeWidth={2.2} />
              </span>
              {t('installAdd')}
            </li>
          </ol>
          <p className="pt-4 text-caption text-slate">{t('installAndroid')}</p>
        </DrawerContent>
      </Drawer>
    </>
  );
}
