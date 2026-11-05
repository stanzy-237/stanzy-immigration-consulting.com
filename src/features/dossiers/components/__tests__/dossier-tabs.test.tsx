// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { DossierTabs, tabFrom } from '@/features/dossiers/components/dossier-tabs';

/** Seam: the Dossier's tabs, with the address as the browser has it. */
const search = vi.hoisted(() => ({ value: new URLSearchParams() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => search.value }));

afterEach(() => {
  search.value = new URLSearchParams();
  window.history.replaceState(null, '', '/');
});

const panels = {
  apercu: <p>Les étapes</p>,
  documents: <p id="documents">Les documents</p>,
  messages: <p id="messages">Les messages</p>,
  reunions: <p>Les réunions</p>,
  facturation: <p id="contrats">Le contrat</p>,
};

describe('the tab a Dossier opens on', () => {
  it('follows ?onglet=, then a Document link, then the anchor, else « Aperçu »', () => {
    expect(tabFrom(new URLSearchParams('onglet=messages'), '#contrats')).toBe('messages');
    expect(tabFrom(new URLSearchParams('document=doc_1&message=m_1'), '')).toBe('documents');
    expect(tabFrom(new URLSearchParams(), '#contrats')).toBe('facturation');
    expect(tabFrom(new URLSearchParams(), '#stanzy')).toBe('documents');
    expect(tabFrom(new URLSearchParams('onglet=nope'), '#nope')).toBe('apercu');
  });
});

describe('DossierTabs', () => {
  it('shows one subject at a time, with what waits next to a tab', async () => {
    const { container } = render(
      withIntl(
        <DossierTabs panels={panels} counts={{ documents: { value: 3, label: 'documents manquants' } }} />,
      ),
    );
    expect(screen.getByText('Les étapes')).toBeInTheDocument();
    expect(screen.queryByText('Les messages')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Documents\s*3\s*documents manquants$/ })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('tab', { name: 'Messages' }));
    expect(screen.getByText('Les messages')).toBeInTheDocument();
    expect(window.location.search).toBe('?onglet=messages');
  });

  it('opens the tab an older link’s anchor points to', () => {
    window.history.replaceState(null, '', '/dossiers/dos_1#contrats');
    render(withIntl(<DossierTabs panels={panels} />));
    expect(screen.getByText('Le contrat')).toBeInTheDocument();

    act(() => {
      window.location.hash = '#messages';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByText('Les messages')).toBeInTheDocument();
  });
});
