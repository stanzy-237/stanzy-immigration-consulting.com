// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { ConnexionDialogView } from '@/features/auth/views/connexion-dialog-view';
import { ConnexionView } from '@/features/auth/views/connexion-view';
import { InscriptionDialogView } from '@/features/auth/views/inscription-dialog-view';
import { InscriptionView } from '@/features/auth/views/inscription-view';

import { withIntl } from './test-utils';

vi.mock('@/i18n/navigation', async () => (await import('./test-utils')).navigationMock);
vi.mock('@/features/auth/lib/auth-client', () => ({
  authClient: {
    signIn: { email: vi.fn(), social: vi.fn() },
    signUp: { email: vi.fn() },
    sendVerificationEmail: vi.fn(),
  },
}));

const social = vi.mocked(authClient.signIn.social);

const VIEWS: [string, (props: { next?: string }) => ReactNode][] = [
  ['Connexion page', (props) => <ConnexionView {...props} />],
  ['Connexion dialog', (props) => <ConnexionDialogView {...props} />],
  ['Inscription page', (props) => <InscriptionView {...props} />],
  ['Inscription dialog', (props) => <InscriptionDialogView {...props} />],
];

describe.each(VIEWS)('%s', (_name, View) => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GOOGLE_SIGN_IN_ENABLED', 'true');
    social.mockReturnValue(new Promise(() => {}) as never);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('offers Continuer avec Google, returning to the home page', async () => {
    render(withIntl(<View />));

    fireEvent.click(await screen.findByRole('button', { name: 'Continuer avec Google' }));

    expect(social).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google', callbackURL: '/fr' }),
    );
  });

  it('returns to a safe ?next= after Google', async () => {
    render(withIntl(<View next="/compte" />));

    fireEvent.click(await screen.findByRole('button', { name: 'Continuer avec Google' }));

    expect(social).toHaveBeenCalledWith(expect.objectContaining({ callbackURL: '/fr/compte' }));
  });

  it('ignores an off-site ?next= and returns home', async () => {
    render(withIntl(<View next="//evil.com" />));

    fireEvent.click(await screen.findByRole('button', { name: 'Continuer avec Google' }));

    expect(social).toHaveBeenCalledWith(expect.objectContaining({ callbackURL: '/fr' }));
  });

  it('has no axe violations with the Google button', async () => {
    const { baseElement } = render(withIntl(<View />));
    await screen.findByRole('button', { name: 'Continuer avec Google' });
    expect(await axe(baseElement)).toHaveNoViolations();
  });
});
