// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { PushSwitch } from '@/features/notifications/components/push-switch';
import { PushBanner } from '@/features/shared/components/push-banner';

/** Seam: the phone switch and the « Mon espace » banner, over a stubbed device state. */
const push = vi.hoisted(() => ({ status: 'off', busy: false, enable: vi.fn(), disable: vi.fn() }));
vi.mock('@/features/notifications/hooks/use-notification-push', () => ({ useNotificationPush: () => push }));

beforeEach(() => {
  push.status = 'off';
  push.enable.mockReset();
  push.disable.mockReset();
  window.localStorage.clear();
});

describe('PushSwitch', () => {
  it('turns phone notifications on and off', async () => {
    const { container, rerender } = render(withIntl(<PushSwitch />));
    fireEvent.click(screen.getByRole('switch', { name: 'Recevoir sur ce téléphone' }));
    expect(push.enable).toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();

    push.status = 'on';
    rerender(withIntl(<PushSwitch />));
    fireEvent.click(screen.getByRole('switch', { name: 'Recevoir sur ce téléphone' }));
    expect(push.disable).toHaveBeenCalled();
  }, 30_000);

  it('says what to do on an iPhone outside the home screen, with no switch', () => {
    push.status = 'needs-install';
    render(withIntl(<PushSwitch />));
    expect(screen.getByText(/ajoutez d’abord le site à l’écran d’accueil/)).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('shows nothing when the site has no push keys', () => {
    push.status = 'hidden';
    const { container } = render(withIntl(<PushSwitch />));
    expect(container).toBeEmptyDOMElement();
  });
});

describe('PushBanner', () => {
  it('invites once; « Plus tard » hides it for good on this device', () => {
    const { unmount } = render(withIntl(<PushBanner />));
    fireEvent.click(screen.getByRole('button', { name: 'Activer' }));
    expect(push.enable).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    unmount();

    render(withIntl(<PushBanner />));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('stays away once notifications are on', () => {
    push.status = 'on';
    render(withIntl(<PushBanner />));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
});
