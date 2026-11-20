// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { forgetRollbarItems, rememberRollbarItem } from '@/features/reports/lib/recent-errors';
import { ReportProblemButton } from '@/features/shared/components/report-problem';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: « Signaler un problème » (#160), `reports.create` answered by the test. */
const api = vi.hoisted(() => ({ create: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  api.create.mockReturnValue({ id: 'rep_1' });
  window.history.pushState({}, '', '/fr/mon-espace/dossiers/d_1?onglet=factures');
});
afterEach(() => forgetRollbarItems());

function view() {
  const { wrap } = createTestTRPC({ 'reports.create': (input) => api.create(input) });
  return render(withIntl(wrap(<ReportProblemButton />)));
}

const UUID = '3f1c2a9e-7b4d-4e2a-9c1f-0a6b5d8e7f21';

describe('Signaler un problème (#160)', () => {
  it('sends what happened with the page (no query string) and the tab’s Rollbar errors', async () => {
    rememberRollbarItem(UUID);
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Signaler un problème' }));
    const form = await screen.findByRole('form', { name: 'Signaler un problème' });
    expect(await axe(document.body)).toHaveNoViolations();

    fireEvent.change(screen.getByLabelText('Que s’est-il passé ?'), { target: { value: 'Le bouton Signer ne répond pas.' } });
    fireEvent.submit(form);

    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith({ message: 'Le bouton Signer ne répond pas.', path: '/fr/mon-espace/dossiers/d_1', rollbarIds: [UUID] }),
    );
    expect(await screen.findByText('Merci, votre signalement est envoyé.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Signaler un problème' })).not.toBeInTheDocument());
  }, 30_000);

  it('asks for a real description before sending anything', async () => {
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Signaler un problème' }));
    const form = await screen.findByRole('form', { name: 'Signaler un problème' });
    fireEvent.change(screen.getByLabelText('Que s’est-il passé ?'), { target: { value: 'Bug' } });
    fireEvent.submit(form);
    expect(await screen.findByText('Décrivez le problème en au moins 10 caractères.')).toBeInTheDocument();
    expect(screen.getByLabelText('Que s’est-il passé ?')).toHaveAttribute('aria-invalid', 'true');
    expect(api.create).not.toHaveBeenCalled();
  });

  it('says to wait an hour after too many reports', async () => {
    api.create.mockImplementation(() => {
      throw new Error('REPORT_LIMIT');
    });
    view();
    fireEvent.click(screen.getByRole('button', { name: 'Signaler un problème' }));
    const form = await screen.findByRole('form', { name: 'Signaler un problème' });
    fireEvent.change(screen.getByLabelText('Que s’est-il passé ?'), { target: { value: 'Encore un problème ici.' } });
    fireEvent.submit(form);
    expect(await screen.findByText('Trop de signalements en peu de temps. Réessayez dans une heure.')).toBeInTheDocument();
  });
});
