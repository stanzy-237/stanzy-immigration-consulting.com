'use client';

import { ChevronDown, Leaf, Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import {
  SERVICE_ENTRIES,
  TOOL_ENTRIES,
  type NavMenuEntry,
} from '@/features/landing/data/nav';

type MenuKey = 'tools' | 'services';

export function SiteNav() {
  const t = useTranslations('Home.Nav');
  const tTools = useTranslations('Home.Nav.Tools');
  const tServices = useTranslations('Home.Nav.Services');

  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  const closeMenus = useCallback(() => setOpenMenu(null), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    }
    function onPointer(e: MouseEvent) {
      if (!navRef.current) return;
      if (!navRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, []);

  const toolsId = useId();
  const servicesId = useId();
  const mobileId = useId();

  return (
    <nav
      ref={navRef}
      aria-label={t('ariaLabel')}
      className="bg-surface/95 border-fog sticky top-0 z-40 w-full border-b backdrop-blur supports-[backdrop-filter]:bg-surface/80"
    >
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-6 px-4 py-3 md:px-6">
        <Link
          href="/"
          className="font-heading text-navy-deep text-xl font-bold tracking-tight"
          onClick={closeMenus}
        >
          {t('brand')}
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
          <li>
            <DropdownTrigger
              id={toolsId}
              label={t('tools')}
              ariaLabel={t('toolsAriaLabel')}
              open={openMenu === 'tools'}
              onToggle={() =>
                setOpenMenu((v) => (v === 'tools' ? null : 'tools'))
              }
            />
            {openMenu === 'tools' ? (
              <DropdownPanel
                id={toolsId}
                entries={TOOL_ENTRIES}
                getName={(e) => tTools(e.labelKey)}
                getDesc={(e) => tTools(e.descKey)}
                mapleLabel={t('liveMarker')}
                onNavigate={closeMenus}
              />
            ) : null}
          </li>
          <li>
            <Link
              href="/blog"
              className="text-navy-deep hover:bg-fog/40 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            >
              {t('blog')}
            </Link>
          </li>
          <li>
            <DropdownTrigger
              id={servicesId}
              label={t('services')}
              ariaLabel={t('servicesAriaLabel')}
              open={openMenu === 'services'}
              onToggle={() =>
                setOpenMenu((v) => (v === 'services' ? null : 'services'))
              }
            />
            {openMenu === 'services' ? (
              <DropdownPanel
                id={servicesId}
                entries={SERVICE_ENTRIES}
                getName={(e) => tServices(e.labelKey)}
                getDesc={(e) => tServices(e.descKey)}
                onNavigate={closeMenus}
              />
            ) : null}
          </li>
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

        <button
          type="button"
          aria-label={mobileOpen ? t('closeMenu') : t('openMenu')}
          aria-expanded={mobileOpen}
          aria-controls={mobileId}
          className="text-navy-deep hover:bg-fog/40 inline-flex h-9 w-9 items-center justify-center rounded-md md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? (
            <X aria-hidden className="h-5 w-5" />
          ) : (
            <Menu aria-hidden className="h-5 w-5" />
          )}
        </button>
      </div>

      {mobileOpen ? (
        <div
          id={mobileId}
          className="border-fog bg-surface border-t md:hidden"
        >
          <MobileSection label={t('home')} href="/" onNavigate={() => setMobileOpen(false)} />
          <MobileGroup
            label={t('tools')}
            entries={TOOL_ENTRIES}
            getName={(e) => tTools(e.labelKey)}
            onNavigate={() => setMobileOpen(false)}
          />
          <MobileSection label={t('blog')} href="/blog" onNavigate={() => setMobileOpen(false)} />
          <MobileGroup
            label={t('services')}
            entries={SERVICE_ENTRIES}
            getName={(e) => tServices(e.labelKey)}
            onNavigate={() => setMobileOpen(false)}
          />
          <div className="border-fog flex flex-col gap-2 border-t px-4 py-4">
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
        </div>
      ) : null}
    </nav>
  );
}

function DropdownTrigger({
  id,
  label,
  ariaLabel,
  open,
  onToggle,
}: {
  id: string;
  label: string;
  ariaLabel: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-haspopup="menu"
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
          'h-3.5 w-3.5 transition-transform',
          open && 'rotate-180',
        )}
      />
    </button>
  );
}

function DropdownPanel({
  id,
  entries,
  getName,
  getDesc,
  mapleLabel,
  onNavigate,
}: {
  id: string;
  entries: ReadonlyArray<NavMenuEntry>;
  getName: (e: NavMenuEntry) => string;
  getDesc: (e: NavMenuEntry) => string;
  mapleLabel?: string;
  onNavigate: () => void;
}) {
  return (
    <div
      id={id}
      role="menu"
      className="border-fog bg-surface absolute left-4 right-4 top-full z-50 mt-1 grid gap-1 rounded-xl border p-2 shadow-lg md:left-auto md:right-auto md:w-[32rem] md:grid-cols-2"
    >
      {entries.map((entry) => {
        const Icon = entry.icon;
        return (
          <Link
            key={entry.href}
            href={entry.href}
            role="menuitem"
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
