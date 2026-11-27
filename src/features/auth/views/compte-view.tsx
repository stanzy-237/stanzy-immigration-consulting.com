'use client';

import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ChevronRight, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState, type FormEvent, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { useCurrentAccount } from '@/features/auth/hooks/use-current-account';
import { authClient } from '@/features/auth/lib/auth-client';
import { MIN_PASSWORD_LENGTH } from '@/features/auth/lib/password';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { useNotificationPush } from '@/features/notifications/hooks/use-notification-push';
import { TAB_BAR_ROOM } from '@/features/shared/components/space-tab-bar';
import { Link, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useTRPC } from '@/trpc/client';

type Editing = null | 'name' | 'phone' | 'password' | 'devices';

const PRESS = 'transition-transform duration-150 ease-standard active:scale-97 motion-reduce:active:scale-100';
const WHATSAPP_URL = 'https://wa.me/237679306015';

/**
 * « Mon compte » (`Mon compte · 1 Réglages`, Desktop and Mobile): who they
 * are, how they sign in, what reaches them. An Account made at a booking has
 * no password yet: the navy banner asks for one first.
 */
export function CompteView(): ReactNode {
  return (
    <>
      <SiteNav />
      <main className={cn('min-h-screen bg-off-white px-4 py-8 md:py-14', TAB_BAR_ROOM)}>
        <div className="mx-auto flex max-w-3xl flex-col gap-8 md:gap-10">
          <QueryBoundary fallback={<Skeleton className="h-96 rounded-3xl" />}>
            <Account />
          </QueryBoundary>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Account(): ReactNode {
  const t = useTranslations('Auth.Compte');
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.account.settings.queryOptions());
  const [editing, setEditing] = useState<Editing>(null);
  const close = (open: boolean) => !open && setEditing(null);

  return (
    <>
      <header className="flex flex-col gap-2">
        <p className="hidden font-label text-caption font-bold tracking-wide text-slate uppercase sm:block">{t('eyebrow')}</p>
        <h1 className="hidden font-heading text-h2 leading-13 font-extrabold tracking-tight text-navy-deep sm:block">{t('title')}</h1>
        {/* Phone (`Mon compte · Mobile`): who is signed in, at the top. */}
        <div className="flex items-center gap-3.5 sm:hidden">
          <span aria-hidden={true} className="flex size-13 shrink-0 items-center justify-center rounded-full bg-navy-deep font-heading text-h4 font-extrabold text-white">
            {data.name.trim().charAt(0).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-heading text-h4 font-extrabold tracking-tight text-navy-deep">{data.name}</span>
            <span className="truncate text-body-sm text-slate">{data.email}</span>
          </span>
        </div>
      </header>

      {data.password ? null : (
        <button
          type="button"
          onClick={() => setEditing('password')}
          className="flex items-center gap-4 rounded-2xl bg-navy-deep p-4 text-left text-white sm:gap-5 sm:rounded-3xl sm:px-6 sm:py-5"
        >
          <span aria-hidden={true} className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 max-sm:size-auto max-sm:bg-transparent">
            <Lock className="size-5.5 text-rose" strokeWidth={2.2} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-heading text-body font-bold sm:text-body-lg">{t('banner.title')}</span>
            <span className="text-body-sm text-white/80">
              <span className="sm:hidden">{t('banner.short')}</span>
              <span className="max-sm:hidden">{t('banner.lead')}</span>
            </span>
          </span>
          <span className="flex h-11 shrink-0 items-center rounded-full bg-rouge px-5 font-heading text-body-sm font-bold max-sm:hidden">{t('banner.cta')}</span>
          <ChevronRight aria-hidden={true} className="size-4.5 shrink-0 sm:hidden" strokeWidth={2.4} />
        </button>
      )}

      <Section title={t('profile.title')}>
        <Row label={t('profile.name')} hint={t('profile.nameHint')} value={data.name} action={t('edit')} onAction={() => setEditing('name')} />
        <Row
          label={t('profile.email')}
          hint={t('profile.emailHint')}
          value={
            <span className="flex min-w-0 items-center justify-end gap-2">
              <span className="truncate">{data.email}</span>
              {data.emailVerified ? <Pill tone="leaf">{t('profile.verified')}</Pill> : null}
            </span>
          }
        />
        {data.whatsapp ? (
          <Row label={t('profile.whatsapp')} hint={t('profile.whatsappHint')} value={data.whatsapp.phone} action={t('edit')} onAction={() => setEditing('phone')} />
        ) : null}
        <Row label={t('profile.locale')} hint={t('profile.localeHint')} value={<LocaleSwitch locale={data.locale} />} />
      </Section>

      <Section title={t('signIn.title')}>
        <Row
          label={t('signIn.password')}
          hint={t('signIn.passwordHint', { min: MIN_PASSWORD_LENGTH })}
          value={data.password ? '••••••••' : <Pill tone="honey">{t('signIn.noPassword')}</Pill>}
          action={data.password ? t('edit') : t('create')}
          onAction={() => setEditing('password')}
        />
        <GoogleRow linked={data.google} />
        <Row label={t('signIn.devices')} hint={t('signIn.devicesHint')} value={t('signIn.deviceCount', { count: data.devices })} action={t('manage')} onAction={() => setEditing('devices')} />
      </Section>

      <Section title={t('notifications.title')} footnote={t('notifications.always')}>
        {data.whatsapp ? <RemindersRow on={data.whatsapp.reminders} /> : null}
        <PushRow />
      </Section>

      {/* Phones: the site's header is gone, so the way out of Mon espace is here (`PWA · Navigation mobile · Règles`). */}
      <div className="sm:hidden">
        <Section title={t('site.title')}>
          {SITE_LINKS.map((link) => (
            <Link key={link.key} href={link.href} className="flex min-h-12.5 items-center gap-3 py-2 text-body text-ink">
              <span className="flex-1">{t(`site.${link.key}`)}</span>
              <ChevronRight aria-hidden={true} className="size-4 text-slate-mute" strokeWidth={2.4} />
            </Link>
          ))}
        </Section>
      </div>

      <SignOut />

      <NameDialog open={editing === 'name'} onOpenChange={close} name={data.name} />
      {data.whatsapp ? <PhoneDialog open={editing === 'phone'} onOpenChange={close} phone={data.whatsapp.phone} /> : null}
      <PasswordDialog open={editing === 'password'} onOpenChange={close} hasPassword={data.password} />
      <DevicesDialog open={editing === 'devices'} onOpenChange={close} />
    </>
  );
}

const SITE_LINKS = [
  { key: 'home', href: '/' },
  { key: 'services', href: '/services' },
  { key: 'blog', href: '/blog' },
  { key: 'contact', href: '/contact' },
] as const;

function Section({ title, footnote, children }: { title: string; footnote?: string; children: ReactNode }): ReactNode {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2 sm:gap-3">
      <h2 id={id} className="pl-1 font-label text-label font-bold tracking-wide text-slate uppercase sm:pl-0 sm:font-heading sm:text-h4 sm:tracking-normal sm:text-navy-deep sm:normal-case">
        {title}
      </h2>
      <div className="flex flex-col divide-y divide-fog-light rounded-2xl bg-white px-4 sm:rounded-3xl sm:border sm:border-fog-light sm:px-6">{children}</div>
      {footnote ? <p className="pl-1 text-caption text-slate sm:pl-0">{footnote}</p> : null}
    </section>
  );
}

/** A setting: what it is (and why, on wider screens), its value, and what to do. */
function Row({ label, hint, value, action, onAction, control }: { label: string; hint?: string; value?: ReactNode; action?: string; onAction?: () => void; control?: ReactNode }): ReactNode {
  return (
    <div className="flex min-h-12.5 items-center gap-3 py-2 sm:gap-6 sm:py-4.5">
      <div className="flex shrink-0 flex-col gap-0.5 sm:min-w-0 sm:flex-1 sm:shrink">
        <span className="text-body whitespace-nowrap text-ink sm:font-semibold">{label}</span>
        {hint ? <span className="text-caption text-slate max-sm:hidden">{hint}</span> : null}
      </div>
      {value !== undefined ? <div className="min-w-0 flex-1 truncate text-right text-body-sm text-slate sm:flex-none sm:text-body sm:text-ink">{value}</div> : null}
      {control ?? (
        <div className="flex shrink-0 justify-end sm:w-18">
          {onAction && action ? (
            <button type="button" onClick={onAction} aria-label={`${action} · ${label}`} className="flex items-center text-body-sm font-semibold text-rouge">
              <span className="max-sm:hidden">{action}</span>
              <ChevronRight aria-hidden={true} className="size-4 text-slate-mute sm:hidden" strokeWidth={2.4} />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Pill({ tone, children }: { tone: 'leaf' | 'honey'; children: ReactNode }): ReactNode {
  return (
    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold whitespace-nowrap', tone === 'leaf' ? 'bg-leaf-tint text-leaf' : 'bg-honey-tint text-honey')}>{children}</span>
  );
}

function useSettingsMutation() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const t = useTranslations('Auth.Compte');
  return {
    trpc,
    refresh: () => queryClient.invalidateQueries({ queryKey: trpc.account.settings.queryKey() }),
    failed: () => toast.add({ title: t('error'), type: 'error' }),
  };
}

function LocaleSwitch({ locale }: { locale: 'fr' | 'en' }): ReactNode {
  const t = useTranslations('Auth.Compte');
  const { trpc, refresh, failed } = useSettingsMutation();
  const save = useMutation(
    trpc.account.setLocale.mutationOptions({
      onSuccess: async () => {
        await refresh();
        toast.add({ title: t('saved'), type: 'success' });
      },
      onError: failed,
    }),
  );
  return (
    <span role="radiogroup" aria-label={t('profile.locale')} className="inline-flex rounded-full bg-ice-blue p-0.5">
      {(['fr', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={locale === l}
          disabled={save.isPending}
          onClick={() => locale !== l && save.mutate({ locale: l })}
          className={cn('rounded-full px-3.5 py-1 font-label text-caption font-bold normal-case tracking-normal', locale === l ? 'bg-navy-deep text-white' : 'text-slate')}
        >
          {l === 'fr' ? 'Français' : 'English'}
        </button>
      ))}
    </span>
  );
}

function GoogleRow({ linked }: { linked: boolean }): ReactNode {
  const t = useTranslations('Auth.Compte');
  const link = () =>
    void authClient.linkSocial({ provider: 'google', callbackURL: window.location.href }).then(({ error }) => {
      if (error) toast.add({ title: t('error'), type: 'error' });
    });
  return (
    <Row
      label="Google"
      hint={t('signIn.googleHint')}
      value={linked ? t('signIn.linked') : t('signIn.notLinked')}
      action={linked ? undefined : t('signIn.link')}
      onAction={linked ? undefined : link}
    />
  );
}

function RemindersRow({ on }: { on: boolean }): ReactNode {
  const t = useTranslations('Auth.Compte');
  const id = useId();
  const { trpc, refresh, failed } = useSettingsMutation();
  const save = useMutation(trpc.account.setWhatsapp.mutationOptions({ onSuccess: refresh, onError: failed }));
  return (
    <Row
      label={t('notifications.reminders')}
      hint={t('notifications.remindersHint')}
      control={
        <div className="flex shrink-0 justify-end sm:w-18">
          <Switch id={id} aria-label={t('notifications.reminders')} checked={on} disabled={save.isPending} onCheckedChange={(reminders) => save.mutate({ reminders })} />
        </div>
      }
    />
  );
}

/** « Notifications sur cet appareil »: Web Push, per device; where it can't, the reason in place of the switch. */
function PushRow(): ReactNode {
  const t = useTranslations('Auth.Compte');
  const tPush = useTranslations('Notifications.pushSwitch');
  const { status, busy, enable, disable } = useNotificationPush();
  if (status === 'hidden') return null;
  const blocked = status === 'unsupported' || status === 'needs-install' || status === 'denied';
  return (
    <Row
      label={t('notifications.device')}
      hint={blocked ? tPush(`why.${status}`) : t('notifications.deviceHint')}
      control={
        <div className="flex shrink-0 justify-end sm:w-18">
          {blocked ? null : (
            <Switch aria-label={t('notifications.device')} checked={status === 'on'} disabled={busy || status === 'checking'} onCheckedChange={(on) => void (on ? enable() : disable())} />
          )}
        </div>
      }
    />
  );
}

function SignOut(): ReactNode {
  const t = useTranslations('Auth.Compte');
  const { signOut } = useCurrentAccount();
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-3 border-fog-light sm:flex-row sm:justify-between sm:border-t sm:pt-6">
      <button
        type="button"
        onClick={() => void signOut().then(() => router.push('/'))}
        className={cn('font-heading text-body-sm font-bold text-rouge sm:flex sm:h-11 sm:items-center sm:rounded-full sm:border-2 sm:border-navy-deep sm:px-5 sm:text-navy-deep', PRESS)}
      >
        {t('signOut')}
      </button>
      <p className="text-center text-caption text-slate">
        {t.rich('delete', { link: (chunks) => <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="font-semibold text-ink underline underline-offset-2">{chunks}</a> })}
      </p>
    </div>
  );
}

const field = 'h-12 w-full rounded-xl border border-fog bg-white px-4 text-body text-ink outline-none focus:border-navy-deep';
const primary = cn('h-12 rounded-full bg-rouge px-6 font-heading text-body-sm font-bold text-white hover:bg-crimson disabled:opacity-50', PRESS);

function SettingDialog({ open, onOpenChange, title, lead, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; lead?: string; children: ReactNode }): ReactNode {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-md flex-col gap-4 rounded-3xl bg-white p-6">
        <DialogTitle className="font-heading text-h4 font-bold text-navy-deep">{title}</DialogTitle>
        {lead ? <DialogDescription className="text-body-sm text-slate">{lead}</DialogDescription> : null}
        {children}
      </DialogContent>
    </Dialog>
  );
}

function NameDialog({ open, onOpenChange, name }: { open: boolean; onOpenChange: (open: boolean) => void; name: string }): ReactNode {
  const t = useTranslations('Auth.Compte');
  const { trpc, refresh, failed } = useSettingsMutation();
  const [value, setValue] = useState(name);
  const save = useMutation(
    trpc.account.rename.mutationOptions({
      onSuccess: async () => {
        await refresh();
        authClient.$store.notify('$sessionSignal');
        toast.add({ title: t('saved'), type: 'success' });
        onOpenChange(false);
      },
      onError: failed,
    }),
  );
  return (
    <SettingDialog open={open} onOpenChange={onOpenChange} title={t('profile.name')} lead={t('profile.nameHint')}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate({ name: value });
        }}
      >
        <input aria-label={t('profile.name')} value={value} onChange={(e) => setValue(e.target.value)} minLength={2} maxLength={80} required={true} className={field} />
        <button type="submit" disabled={save.isPending || value.trim().length < 2} className={primary}>
          {t('save')}
        </button>
      </form>
    </SettingDialog>
  );
}

function PhoneDialog({ open, onOpenChange, phone }: { open: boolean; onOpenChange: (open: boolean) => void; phone: string }): ReactNode {
  const t = useTranslations('Auth.Compte');
  const { trpc, refresh, failed } = useSettingsMutation();
  const [value, setValue] = useState(phone);
  const clean = value.replace(/[\s.-]/g, '');
  const valid = /^\+\d{8,15}$/.test(clean);
  const save = useMutation(
    trpc.account.setWhatsapp.mutationOptions({
      onSuccess: async () => {
        await refresh();
        toast.add({ title: t('saved'), type: 'success' });
        onOpenChange(false);
      },
      onError: failed,
    }),
  );
  return (
    <SettingDialog open={open} onOpenChange={onOpenChange} title={t('profile.whatsapp')} lead={t('profile.whatsappLead')}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (valid) save.mutate({ phone: clean });
        }}
      >
        <input aria-label={t('profile.whatsapp')} type="tel" inputMode="tel" value={value} onChange={(e) => setValue(e.target.value)} placeholder="+237 6 77 12 34 50" className={field} />
        <button type="submit" disabled={save.isPending || !valid} className={primary}>
          {t('save')}
        </button>
      </form>
    </SettingDialog>
  );
}

/** « Créer » (no password yet) or « Modifier » (the current one, then the new; other devices are signed out). */
function PasswordDialog({ open, onOpenChange, hasPassword }: { open: boolean; onOpenChange: (open: boolean) => void; hasPassword: boolean }): ReactNode {
  const t = useTranslations('Auth.Compte.password');
  const { trpc, refresh } = useSettingsMutation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const create = useMutation(trpc.account.createPassword.mutationOptions());
  const done = async (title: string) => {
    await refresh();
    toast.add({ title, type: 'success' });
    setCurrent('');
    setNext('');
    onOpenChange(false);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < MIN_PASSWORD_LENGTH) return setError(t('tooShort', { min: MIN_PASSWORD_LENGTH }));
    setError(null);
    setPending(true);
    try {
      if (hasPassword) {
        const { error: changeError } = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: true });
        if (changeError) return setError(changeError.code === 'INVALID_PASSWORD' ? t('wrongCurrent') : t('error'));
        await done(t('changed'));
      } else {
        const { sent } = await create.mutateAsync({ password: next });
        await done(sent ? t('sent') : t('created'));
      }
    } catch {
      setError(t('error'));
    } finally {
      setPending(false);
    }
  };
  return (
    <SettingDialog open={open} onOpenChange={onOpenChange} title={hasPassword ? t('changeTitle') : t('createTitle')} lead={hasPassword ? t('changeLead') : t('createLead')}>
      <form className="flex flex-col gap-3" onSubmit={(e) => void submit(e)}>
        {hasPassword ? (
          <input aria-label={t('current')} placeholder={t('current')} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required={true} className={field} />
        ) : null}
        <input aria-label={t('new')} placeholder={t('new')} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required={true} className={field} />
        {error ? (
          <p role="alert" className="text-body-sm text-rouge">
            {error}
          </p>
        ) : (
          <p className="text-caption text-slate">{t('rule', { min: MIN_PASSWORD_LENGTH })}</p>
        )}
        <button type="submit" disabled={pending} className={cn(primary, 'mt-1')}>
          {hasPassword ? t('change') : t('create')}
        </button>
      </form>
    </SettingDialog>
  );
}

/** « Appareils connectés »: each signed-in device, and signing out all the others. */
function DevicesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }): ReactNode {
  const t = useTranslations('Auth.Compte.devices');
  const { refresh } = useSettingsMutation();
  const current = authClient.useSession().data?.session.id;
  const sessions = useQuery({
    queryKey: ['auth', 'sessions'],
    enabled: open,
    queryFn: async () => (await authClient.listSessions()).data ?? [],
  });
  const [pending, setPending] = useState(false);
  const others = (sessions.data ?? []).filter((s) => s.id !== current);
  const revoke = async () => {
    setPending(true);
    const { error } = await authClient.revokeOtherSessions();
    setPending(false);
    if (error) return toast.add({ title: t('error'), type: 'error' });
    await Promise.all([sessions.refetch(), refresh()]);
    toast.add({ title: t('done'), type: 'success' });
  };
  return (
    <SettingDialog open={open} onOpenChange={onOpenChange} title={t('title')} lead={t('lead')}>
      {sessions.isPending ? (
        <Skeleton className="h-24 rounded-2xl" />
      ) : (
        <ul className="flex flex-col divide-y divide-fog-light rounded-2xl border border-fog-light px-4">
          {(sessions.data ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-3">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-body-sm font-semibold text-ink">{deviceName(s.userAgent) ?? t('unknown')}</span>
                <span className="text-caption text-slate">{t('since', { date: new Date(s.createdAt) })}</span>
              </span>
              {s.id === current ? <span className="shrink-0 rounded-full bg-leaf-tint px-2 py-0.5 text-caption font-semibold text-leaf">{t('this')}</span> : null}
            </li>
          ))}
        </ul>
      )}
      <button type="button" disabled={pending || others.length === 0} onClick={() => void revoke()} className={primary}>
        {t('signOutOthers')}
      </button>
    </SettingDialog>
  );
}

/** « iPhone · Safari », « Windows · Chrome »: enough to recognise a device. */
export function deviceName(agent: string | null | undefined): string | null {
  if (!agent) return null;
  const os = /iPhone|iPad/.test(agent) ? (agent.includes('iPad') ? 'iPad' : 'iPhone') : /Android/.test(agent) ? 'Android' : /Mac OS X/.test(agent) ? 'Mac' : /Windows/.test(agent) ? 'Windows' : /Linux/.test(agent) ? 'Linux' : null;
  const browser = /Edg\//.test(agent) ? 'Edge' : /OPR\//.test(agent) ? 'Opera' : /Chrome\//.test(agent) ? 'Chrome' : /Firefox\//.test(agent) ? 'Firefox' : /Safari\//.test(agent) ? 'Safari' : null;
  return [os, browser].filter(Boolean).join(' · ') || null;
}
