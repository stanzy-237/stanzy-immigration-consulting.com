'use client';

import { ChevronDown, LayoutDashboard, LogOut, Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type ReactNode,
} from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useCurrentAccount } from '@/features/auth/hooks/use-current-account';
import { withNext } from '@/features/auth/lib/safe-next-path';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

import { MapleLeafIcon } from '@/features/landing/components/brand-icons';
import { LocaleToggle } from '@/features/landing/components/locale-toggle';
import {
  SERVICE_ENTRIES,
  TOOL_ENTRIES,
  type NavMenuEntry,
} from '@/features/landing/data/nav';
// Pure host helper only: the dashboard's components stay in their feature (folder rule 3).
import { dashboardOrigin } from '@/features/dashboard/lib/dashboard-host';

type MenuKey = 'tools' | 'services';

// Hover-intent delay from the MagicPath design (issue #12 Further Notes).
const HOVER_CLOSE_DELAY_MS = 130;

export function SiteNav(): ReactNode {
  const t = useTranslations('Home.Nav');
  const tTools = useTranslations('Home.Nav.Tools');
  const tServices = useTranslations('Home.Nav.Services');

  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname: string = usePathname() ?? '/';
  const router = useRouter();
  // Read client-side (not passed down as a prop) so every page that renders
  // the nav stays statically rendered; see #26.
  const { account, signOut: endSession } = useCurrentAccount();
  const accountName: string | null = account?.name ?? null;
  // The Tableau de bord lives on admin.<this site>; the session only exists in the browser.
  const dashboardUrl: string | null =
    account?.isConsultant && typeof window !== 'undefined' ? `${dashboardOrigin(window.location.origin)}/` : null;

  // Stay on the page: refreshing re-renders it signed out, and a protected
  // page's own guard sends the visitor to Connexion with `next`.
  const signOut = useCallback(async (): Promise<void> => {
    await endSession();
    router.refresh();
  }, [endSession, router]);
  // Sign-in and sign-up bring the visitor back to the page they are on.
  const loginHref: string = withNext('/connexion', pathname);
  const signUpHref: string = withNext('/inscription', pathname);

  const isActive = (href: string): boolean =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);
  const isGroupActive = (prefix: string): boolean => pathname.startsWith(prefix);

  const clearCloseTimer = useCallback((): void => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const openOnHover = useCallback(
    (key: MenuKey): void => {
      clearCloseTimer();
      setOpenMenu(key);
    },
    [clearCloseTimer],
  );

  const scheduleClose = useCallback((): void => {
    clearCloseTimer();
    closeTimer.current = setTimeout((): void => {
      setOpenMenu(null);
    }, HOVER_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  useEffect((): (() => void) => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return (): void => {
      document.removeEventListener('keydown', onKey);
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  const toolsId: string = useId();
  const servicesId: string = useId();

  const closeDropdown = useCallback((): void => setOpenMenu(null), []);
  const closeMobile = useCallback((): void => setMobileOpen(false), []);

  return (
    <nav
      aria-label={t('ariaLabel')}
      className="bg-surface/95 border-fog sticky top-0 z-40 w-full border-b backdrop-blur supports-backdrop-filter:bg-surface/80"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-2 md:px-6">
        <Link
          href="/"
          aria-label={t('brand')}
          className="inline-flex items-center"
        >
          <Image
            src="/logo2.png"
            alt={t('brand')}
            width={502}
            height={468}
            priority
            className="h-14 w-auto md:h-16"
          />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          <NavItem href="/" active={pathname === '/'}>
            {t('home')}
          </NavItem>
          <HoverDropdown
            id={toolsId}
            label={t('tools')}
            ariaLabel={t('toolsAriaLabel')}
            active={isGroupActive('/outils')}
            open={openMenu === 'tools'}
            onOpen={(): void => openOnHover('tools')}
            onClose={scheduleClose}
            onToggle={(): void =>
              setOpenMenu((v: MenuKey | null): MenuKey | null =>
                v === 'tools' ? null : 'tools',
              )
            }
            panel={
              <DropdownPanel
                id={toolsId}
                open={openMenu === 'tools'}
                entries={TOOL_ENTRIES}
                getName={(e: NavMenuEntry): string => tTools(e.labelKey)}
                getDesc={(e: NavMenuEntry): string => tTools(e.descKey)}
                mapleLabel={t('liveMarker')}
                comingSoonLabel={t('comingSoon')}
                onNavigate={closeDropdown}
              />
            }
          />
          <NavItem href="/blog" active={isActive('/blog')}>
            {t('blog')}
          </NavItem>
          <HoverDropdown
            id={servicesId}
            label={t('services')}
            ariaLabel={t('servicesAriaLabel')}
            active={isGroupActive('/services')}
            open={openMenu === 'services'}
            onOpen={(): void => openOnHover('services')}
            onClose={scheduleClose}
            onToggle={(): void =>
              setOpenMenu((v: MenuKey | null): MenuKey | null =>
                v === 'services' ? null : 'services',
              )
            }
            panel={
              <DropdownPanel
                id={servicesId}
                open={openMenu === 'services'}
                entries={SERVICE_ENTRIES}
                getName={(e: NavMenuEntry): string => tServices(e.labelKey)}
                getDesc={(e: NavMenuEntry): string => tServices(e.descKey)}
                onNavigate={closeDropdown}
              />
            }
          />
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          <LocaleToggle ariaLabel={t('localeToggle')} />
          {accountName ? (
            <AccountMenu
              name={accountName}
              triggerLabel={t('account', { name: accountName })}
              dashboard={dashboardUrl ? { href: dashboardUrl, label: t('dashboard') } : null}
              signOutLabel={t('signOut')}
              onSignOut={signOut}
            />
          ) : (
            <Link
              href={loginHref}
              className="text-navy-deep hover:bg-fog/40 rounded-md px-3 py-2 text-sm font-medium transition-colors"
            >
              {t('login')}
            </Link>
          )}
          {accountName ? null : (
            <Link
              href={signUpHref}
              className="bg-rouge rounded-md px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-rouge/90"
            >
              {t('start')}
            </Link>
          )}
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <button
                type="button"
                aria-label={t('openMenu')}
                className="text-navy-deep hover:bg-fog/40 inline-flex h-9 w-9 items-center justify-center rounded-md md:hidden"
              >
                <Menu aria-hidden={true} className="h-5 w-5" />
              </button>
            }
          />
          <SheetContent side="right" className="bg-surface w-80 p-0">
            <SheetHeader>
              <SheetTitle className="flex items-center">
                <Image
                  src="/logo2.png"
                  alt={t('brand')}
                  width={502}
                  height={468}
                  className="h-10 w-auto"
                />
              </SheetTitle>
            </SheetHeader>
            <nav aria-label={t('ariaLabel')} className="flex flex-col pb-4">
              <MobileSection
                label={t('home')}
                href="/"
                onNavigate={closeMobile}
              />
              <MobileGroup
                label={t('tools')}
                entries={TOOL_ENTRIES}
                getName={(e: NavMenuEntry): string => tTools(e.labelKey)}
                comingSoonLabel={t('comingSoon')}
                onNavigate={closeMobile}
              />
              <MobileSection
                label={t('blog')}
                href="/blog"
                onNavigate={closeMobile}
              />
              <MobileGroup
                label={t('services')}
                entries={SERVICE_ENTRIES}
                getName={(e: NavMenuEntry): string => tServices(e.labelKey)}
                onNavigate={closeMobile}
              />
              <div className="mt-4 flex flex-col gap-3 px-4">
                <LocaleToggle
                  ariaLabel={t('localeToggle')}
                  className="self-start"
                />
                {accountName ? (
                  <p className="text-navy-deep truncate text-sm font-semibold">
                    {accountName}
                  </p>
                ) : null}
                {dashboardUrl ? (
                  <a
                    href={dashboardUrl}
                    className="text-navy-deep inline-flex items-center justify-center gap-2 rounded-md border border-fog px-3 py-2 text-sm font-semibold"
                    onClick={closeMobile}
                  >
                    <LayoutDashboard aria-hidden={true} className="size-4" />
                    {t('dashboard')}
                  </a>
                ) : null}
                {accountName ? (
                  <button
                    type="button"
                    className="text-navy-deep rounded-md border border-fog px-3 py-2 text-center text-sm font-medium"
                    onClick={(): void => {
                      closeMobile();
                      void signOut();
                    }}
                  >
                    {t('signOut')}
                  </button>
                ) : (
                  <Link
                    href={loginHref}
                    className="text-navy-deep rounded-md border border-fog px-3 py-2 text-center text-sm font-medium"
                    onClick={closeMobile}
                  >
                    {t('login')}
                  </Link>
                )}
                {accountName ? null : (
                  <Link
                    href={signUpHref}
                    className="bg-rouge rounded-md px-3 py-2 text-center text-sm font-semibold text-white"
                    onClick={closeMobile}
                  >
                    {t('start')}
                  </Link>
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}

type AccountMenuProps = {
  name: string;
  triggerLabel: string;
  /** The consultant only: the way into the Tableau de bord, on its subdomain. */
  dashboard: { href: string; label: string } | null;
  signOutLabel: string;
  onSignOut: () => Promise<void>;
};

function AccountMenu({
  name,
  triggerLabel,
  dashboard,
  signOutLabel,
  onSignOut,
}: AccountMenuProps): ReactNode {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={triggerLabel}
        className="text-navy-deep hover:bg-fog/40 inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors"
      >
        <span
          aria-hidden={true}
          className="bg-navy-deep inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
        >
          {name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="max-w-32 truncate">{name}</span>
        <ChevronDown aria-hidden={true} className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {dashboard ? (
          <DropdownMenuItem render={<a href={dashboard.href} />}>
            <LayoutDashboard aria-hidden={true} />
            {dashboard.label}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={(): void => void onSignOut()}>
          <LogOut aria-hidden={true} />
          {signOutLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type NavItemProps = {
  href: string;
  active: boolean;
  children: ReactNode;
};

function NavItem({ href, active, children }: NavItemProps): ReactNode {
  return (
    <li className="relative">
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'text-navy-deep hover:bg-fog/40 inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
          active && 'text-navy-deep',
        )}
      >
        {children}
      </Link>
      <ActiveBar visible={active} />
    </li>
  );
}

function ActiveBar({ visible }: { visible: boolean }): ReactNode {
  return (
    <span
      aria-hidden={true}
      className={cn(
        'bg-rouge pointer-events-none absolute inset-x-3 -bottom-2 h-0.5 rounded-full transition-opacity',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    />
  );
}

type HoverDropdownProps = {
  id: string;
  label: string;
  ariaLabel: string;
  active: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
  panel: ReactNode;
};

function HoverDropdown({
  id,
  label,
  ariaLabel,
  active,
  open,
  onOpen,
  onClose,
  onToggle,
  panel,
}: HoverDropdownProps): ReactNode {
  const handleBlur = (e: ReactFocusEvent<HTMLLIElement>): void => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      onClose();
    }
  };

  return (
    <li
      className="relative"
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      onFocus={onOpen}
      onBlur={handleBlur}
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
          aria-hidden={true}
          className={cn(
            'h-3.5 w-3.5 transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>
      <ActiveBar visible={active} />
      {panel}
    </li>
  );
}

type DropdownPanelProps = {
  id: string;
  open: boolean;
  entries: ReadonlyArray<NavMenuEntry>;
  getName: (entry: NavMenuEntry) => string;
  getDesc: (entry: NavMenuEntry) => string;
  mapleLabel?: string;
  comingSoonLabel?: string;
  onNavigate: () => void;
};

/** « Bientôt »: the tool's page is a placeholder for now. */
function ComingSoonTag({ label }: { label: string }): ReactNode {
  return (
    <span className="rounded-full border border-fog bg-ice-blue px-1.5 py-0.5 font-label font-bold uppercase tracking-wider text-navy-deep">
      {label}
    </span>
  );
}

function DropdownPanel({
  id,
  open,
  entries,
  getName,
  getDesc,
  mapleLabel,
  comingSoonLabel,
  onNavigate,
}: DropdownPanelProps): ReactNode {
  return (
    <div
      id={id}
      aria-hidden={!open}
      className={cn(
        'absolute left-0 top-full z-50 mt-1 w-128 origin-left rounded-xl border border-fog bg-surface p-2 shadow-lg transition duration-200 ease-out',
        'grid gap-1 md:grid-cols-2',
        open
          ? 'pointer-events-auto opacity-100 blur-0 translate-x-0'
          : 'pointer-events-none opacity-0 blur-sm -translate-x-4',
      )}
    >
      {entries.map((entry: NavMenuEntry): ReactNode => {
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
              <Icon aria-hidden={true} className="h-4 w-4" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-navy-deep flex items-center gap-1.5 text-sm font-medium">
                {getName(entry)}
                {entry.maple && mapleLabel ? (
                  <MapleLeafIcon
                    aria-label={mapleLabel}
                    className="text-rouge h-3.5 w-3.5"
                  />
                ) : null}
                {entry.comingSoon && comingSoonLabel ? (
                  <ComingSoonTag label={comingSoonLabel} />
                ) : null}
              </span>
              <span className="text-navy-deep/60 text-xs">{getDesc(entry)}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

type MobileSectionProps = {
  label: string;
  href: string;
  onNavigate: () => void;
};

function MobileSection({
  label,
  href,
  onNavigate,
}: MobileSectionProps): ReactNode {
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

type MobileGroupProps = {
  label: string;
  entries: ReadonlyArray<NavMenuEntry>;
  getName: (entry: NavMenuEntry) => string;
  comingSoonLabel?: string;
  onNavigate: () => void;
};

function MobileGroup({
  label,
  entries,
  getName,
  comingSoonLabel,
  onNavigate,
}: MobileGroupProps): ReactNode {
  return (
    <details className="border-b border-fog/70">
      <summary className="text-navy-deep cursor-pointer px-4 py-3 text-sm font-semibold">
        {label}
      </summary>
      <ul className="bg-fog/20 pb-2">
        {entries.map(
          (entry: NavMenuEntry): ReactNode => (
            <li key={entry.href}>
              <Link
                href={entry.href}
                onClick={onNavigate}
                className="text-navy-deep flex items-center gap-2 px-6 py-2 text-sm"
              >
                {getName(entry)}
                {entry.comingSoon && comingSoonLabel ? (
                  <ComingSoonTag label={comingSoonLabel} />
                ) : null}
              </Link>
            </li>
          ),
        )}
      </ul>
    </details>
  );
}
