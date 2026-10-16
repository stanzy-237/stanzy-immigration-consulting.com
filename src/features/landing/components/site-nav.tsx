'use client';

import { ChevronDown, Leaf, Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import {
  SERVICE_ENTRIES,
  TOOL_ENTRIES,
  type NavMenuEntry,
} from '@/features/landing/data/nav';

type MenuKey = 'tools' | 'services';

// Hover-intent delay from the MagicPath design (issue #12 Further Notes).
const HOVER_CLOSE_DELAY_MS = 130;

export function SiteNav() {
  const t = useTranslations('Home.Nav');
  const tTools = useTranslations('Home.Nav.Tools');
  const tServices = useTranslations('Home.Nav.Services');

  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const openOnHover = useCallback(
    (key: MenuKey) => {
      clearCloseTimer();
      setOpenMenu(key);
    },
    [clearCloseTimer],
  );

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => {
      setOpenMenu(null);
    }, HOVER_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  const toolsId = useId();
  const servicesId = useId();

  return (
    <nav
      aria-label={t('ariaLabel')}
      className="bg-surface/95 border-fog sticky top-0 z-40 w-full border-b backdrop-blur supports-[backdrop-filter]:bg-surface/80"
    >
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-4 py-3 md:px-6">
        <Link href="/" aria-label={t('brand')} className="inline-flex items-center">
          <Image
            src="/logo2.png"
            alt={t('brand')}
            width={502}
            height={468}
            priority
            className="h-9 w-auto"
          />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          <li>
            <Link
              href="/"
              className="text-navy-deep hover:bg-fog/40 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            >
              {t('home')}
            </Link>
          </li>
          <HoverDropdown
            id={toolsId}
            label={t('tools')}
            ariaLabel={t('toolsAriaLabel')}
            open={openMenu === 'tools'}
            onOpen={() => openOnHover('tools')}
            onClose={scheduleClose}
            onToggle={() =>
              setOpenMenu((v) => (v === 'tools' ? null : 'tools'))
            }
            panel={
              <DropdownPanel
                id={toolsId}
                open={openMenu === 'tools'}
                entries={TOOL_ENTRIES}
                getName={(e) => tTools(e.labelKey)}
                getDesc={(e) => tTools(e.descKey)}
                mapleLabel={t('liveMarker')}
                onNavigate={() => setOpenMenu(null)}
              />
            }
          />
          <li>
            <Link
              href="/blog"
              className="text-navy-deep hover:bg-fog/40 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            >
              {t('blog')}
            </Link>
          </li>
          <HoverDropdown
            id={servicesId}
            label={t('services')}
            ariaLabel={t('servicesAriaLabel')}
            open={openMenu === 'services'}
            onOpen={() => openOnHover('services')}
            onClose={scheduleClose}
            onToggle={() =>
              setOpenMenu((v) => (v === 'services' ? null : 'services'))
            }
            panel={
              <DropdownPanel
                id={servicesId}
                open={openMenu === 'services'}
                entries={SERVICE_ENTRIES}
                getName={(e) => tServices(e.labelKey)}
                getDesc={(e) => tServices(e.descKey)}
                onNavigate={() => setOpenMenu(null)}
              />
            }
          />
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/connexion"
            className="text-navy-deep hover:bg-fog/40 rounded-md px-3 py-2 text-sm font-medium transition-colors"
          >
            {t('login')}
          </Link>
          <Link
            href="/commencer"
            className="bg-rouge rounded-md px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-rouge/90"
          >
            {t('start')}
          </Link>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <button
                type="button"
                aria-label={t('openMenu')}
                className="text-navy-deep hover:bg-fog/40 inline-flex h-9 w-9 items-center justify-center rounded-md md:hidden"
              >
                <Menu aria-hidden className="h-5 w-5" />
              </button>
            }
          />
          <SheetContent side="right" className="bg-surface w-80 p-0">
            <SheetHeader>
              <SheetTitle>{t('brand')}</SheetTitle>
            </SheetHeader>
            <nav aria-label={t('ariaLabel')} className="flex flex-col pb-4">
              <MobileSection
                label={t('home')}
                href="/"
                onNavigate={() => setMobileOpen(false)}
              />
              <MobileGroup
                label={t('tools')}
                entries={TOOL_ENTRIES}
                getName={(e) => tTools(e.labelKey)}
                onNavigate={() => setMobileOpen(false)}
              />
              <MobileSection
                label={t('blog')}
                href="/blog"
                onNavigate={() => setMobileOpen(false)}
              />
              <MobileGroup
                label={t('services')}
                entries={SERVICE_ENTRIES}
                getName={(e) => tServices(e.labelKey)}
                onNavigate={() => setMobileOpen(false)}
              />
              <div className="mt-4 flex flex-col gap-2 px-4">
                <Link
                  href="/connexion"
                  className="text-navy-deep rounded-md border border-fog px-3 py-2 text-center text-sm font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  {t('login')}
                </Link>
                <Link
                  href="/commencer"
                  className="bg-rouge rounded-md px-3 py-2 text-center text-sm font-semibold text-white"
                  onClick={() => setMobileOpen(false)}
                >
                  {t('start')}
                </Link>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}

function HoverDropdown({
  id,
  label,
  ariaLabel,
  open,
  onOpen,
  onClose,
  onToggle,
  panel,
}: {
  id: string;
  label: string;
  ariaLabel: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
  panel: React.ReactNode;
}) {
  return (
    <li
      className="relative"
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      onFocus={onOpen}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          onClose();
        }
      }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className={cn(
          'text-navy-deep hover:bg-fog/40 inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          open && 'bg-fog/40',
        )}
      >
        {label}
        <ChevronDown
          aria-hidden
          className={cn(
            'h-3.5 w-3.5 transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>
      {panel}
    </li>
  );
}

function DropdownPanel({
  id,
  open,
  entries,
  getName,
  getDesc,
  mapleLabel,
  onNavigate,
}: {
  id: string;
  open: boolean;
  entries: ReadonlyArray<NavMenuEntry>;
  getName: (e: NavMenuEntry) => string;
  getDesc: (e: NavMenuEntry) => string;
  mapleLabel?: string;
  onNavigate: () => void;
}) {
  // The panel always renders so the left-to-right blur transition has a
  // target to animate towards; `pointer-events-none` keeps it inert while
  // closed and screen readers skip it via `aria-hidden`.
  return (
    <div
      id={id}
      aria-hidden={!open}
      className={cn(
        'absolute left-0 top-full z-50 mt-1 w-[32rem] origin-left rounded-xl border border-fog bg-surface p-2 shadow-lg transition-[opacity,filter,transform] duration-200 ease-out',
        'grid gap-1 md:grid-cols-2',
        open
          ? 'pointer-events-auto opacity-100 blur-0 translate-x-0'
          : 'pointer-events-none opacity-0 blur-sm -translate-x-4',
      )}
    >
      {entries.map((entry) => {
        const Icon = entry.icon;
        return (
          <Link
            key={entry.href}
            href={entry.href}
            tabIndex={open ? 0 : -1}
            onClick={onNavigate}
            className="hover:bg-fog/40 group flex items-start gap-3 rounded-lg px-3 py-2 transition-colors"
          >
            <span className="bg-rouge/10 text-rouge inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
              <Icon aria-hidden className="h-4 w-4" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-navy-deep flex items-center gap-1.5 text-sm font-medium">
                {getName(entry)}
                {entry.maple && mapleLabel ? (
                  <Leaf
                    aria-label={mapleLabel}
                    className="text-rouge h-3.5 w-3.5"
                  />
                ) : null}
              </span>
              <span className="text-navy-deep/60 text-xs">
                {getDesc(entry)}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function MobileSection({
  label,
  href,
  onNavigate,
}: {
  label: string;
  href: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="text-navy-deep hover:bg-fog/40 block border-b border-fog/70 px-4 py-3 text-sm font-medium"
    >
      {label}
    </Link>
  );
}

function MobileGroup({
  label,
  entries,
  getName,
  onNavigate,
}: {
  label: string;
  entries: ReadonlyArray<NavMenuEntry>;
  getName: (e: NavMenuEntry) => string;
  onNavigate: () => void;
}) {
  return (
    <details className="border-b border-fog/70">
      <summary className="text-navy-deep cursor-pointer px-4 py-3 text-sm font-semibold">
        {label}
      </summary>
      <ul className="bg-fog/20 pb-2">
        {entries.map((entry) => (
          <li key={entry.href}>
            <Link
              href={entry.href}
              onClick={onNavigate}
              className="text-navy-deep block px-6 py-2 text-sm"
            >
              {getName(entry)}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
