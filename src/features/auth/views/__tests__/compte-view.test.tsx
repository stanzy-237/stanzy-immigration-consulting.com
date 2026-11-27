// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { CompteView, deviceName } from '@/features/auth/views/compte-view';
import { createTestTRPC, type Handlers } from '@/trpc/__tests__/test-utils';
import type { RouterOutputs } from '@/trpc/types';

import { withIntl } from './test-utils';

vi.mock('@/i18n/navigation', async () => (await import('./test-utils')).navigationMock);
vi.mock('@/features/landing/components/site-nav', () => ({ SiteNav: () => null }));
vi.mock('@/features/landing/components/site-footer', () => ({ SiteFooter: () => null }));
vi.mock('@/features/notifications/hooks/use-notification-push', () => ({
  useNotificationPush: () => ({ status: 'off', busy: false, enable: vi.fn(), disable: vi.fn() }),
}));
vi.mock('@/features/auth/lib/auth-client', () => ({
  authClient: {
    useSession: vi.fn(() => ({ data: { session: { id: 'ses_1' }, user: { id: 'acc_1', name: 'Aminata Diallo', email: 'aminata@example.com' } } })),
    signOut: vi.fn(),
    changePassword: vi.fn(),
    listSessions: vi.fn(),
    revokeOtherSessions: vi.fn(),
    linkSocial: vi.fn(),
    $store: { notify: vi.fn() },
  },
}));

type Settings = RouterOutputs['account']['settings'];

/** Booked without an Account: no password yet. */
const GUEST: Settings = {
  name: 'Aminata Diallo',
  email: 'aminata@example.com',
  emailVerified: true,
  locale: 'fr',
  password: false,
  google: false,
  devices: 2,
  whatsapp: { phone: '+237677123450', reminders: true },
};

function renderAccount(settings: Settings, handlers: Handlers = {}) {
  const { trpc, queryClient, wrap } = createTestTRPC({ 'account.settings': () => settings, ...handlers });
  queryClient.setQueryData(trpc.account.settings.queryKey(), settings);
  return render(withIntl(wrap(<CompteView />)));
}

beforeEach(() => vi.clearAllMocks());

describe('Mon compte', () => {
  it('asks a Client who booked without an Account to create a password, and shows who they are', async () => {
    const { container } = renderAccount(GUEST);
    expect(screen.getByRole('heading', { level: 1, name: 'Mon compte' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Créez votre mot de passe/ })).toBeInTheDocument();
    expect(screen.getByText('Pas encore créé')).toBeInTheDocument();
    expect(screen.getByText('+237677123450')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Rappels sur WhatsApp' })).toBeChecked();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('creates the password from the banner', async () => {
    const createPassword = vi.fn(() => ({ sent: false }));
    renderAccount(GUEST, { 'account.createPassword': createPassword });
    fireEvent.click(screen.getByRole('button', { name: /Créez votre mot de passe/ }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Nouveau mot de passe'), { target: { value: 'Douala2026!' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Créer mon mot de passe' }));
    await waitFor(() => expect(createPassword).toHaveBeenCalledWith({ password: 'Douala2026!' }));
  });

  it('changes an existing password with the current one, signing out the other devices', async () => {
    vi.mocked(authClient.changePassword).mockResolvedValue({ data: {}, error: null } as never);
    renderAccount({ ...GUEST, password: true });
    expect(screen.queryByRole('button', { name: /Créez votre mot de passe/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Modifier · Mot de passe' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Mot de passe actuel'), { target: { value: 'old-password' } });
    fireEvent.change(dialog.getByLabelText('Nouveau mot de passe'), { target: { value: 'new-password' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Changer' }));
    await waitFor(() => expect(authClient.changePassword).toHaveBeenCalledWith({ currentPassword: 'old-password', newPassword: 'new-password', revokeOtherSessions: true }));
  });

  it('switches the e-mail language and the WhatsApp reminders', async () => {
    const setLocale = vi.fn(() => ({ locale: 'en' }));
    const setWhatsapp = vi.fn(() => ({}));
    renderAccount(GUEST, { 'account.setLocale': setLocale, 'account.setWhatsapp': setWhatsapp });
    fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Rappels sur WhatsApp' }));
    await waitFor(() => expect(setLocale).toHaveBeenCalledWith({ locale: 'en' }));
    await waitFor(() => expect(setWhatsapp).toHaveBeenCalledWith({ reminders: false }));
  });

  it('names a device from its browser', () => {
    expect(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')).toBe('iPhone · Safari');
    expect(deviceName('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36')).toBe('Windows · Chrome');
    expect(deviceName(null)).toBeNull();
  });
});
