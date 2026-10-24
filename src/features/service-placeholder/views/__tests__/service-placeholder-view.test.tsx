// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { Video } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { authClient } from '@/features/auth/lib/auth-client';
import { navigationMock, withIntl } from '@/features/auth/views/__tests__/test-utils';
import { ServicePlaceholderView } from '@/features/service-placeholder/views/service-placeholder-view';

/** Seam: a /services/* placeholder page as a visitor reads it. */
vi.mock('@/i18n/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/navigation')>()),
  ...navigationMock,
}));
vi.mock('@/features/auth/lib/auth-client', () => ({ authClient: { useSession: vi.fn(), signOut: vi.fn() } }));

beforeEach(() => {
  vi.mocked(authClient.useSession).mockReturnValue({ data: null, isPending: false } as never);
});

describe('ServicePlaceholderView', () => {
  it.each([
    ['fr', 'En développement', /Ce service est en train d'être finalisé/, "Retour à l'accueil"],
    ['en', 'In development', /This service is being finalised/, 'Back to home'],
  ] as const)('shows the service name and its copy in %s', (locale, status, description, back) => {
    render(withIntl(<ServicePlaceholderView nameKey="consultationName" icon={Video} />, locale));

    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent(/\./);
    expect(screen.getByText(status)).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: back })).toHaveAttribute('href', '/');
  });

  it('has no axe violations in the page content', async () => {
    render(withIntl(<ServicePlaceholderView nameKey="consultationName" icon={Video} />));
    expect(await axe(screen.getByRole('main'))).toHaveNoViolations();
  });
});
