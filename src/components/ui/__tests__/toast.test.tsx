// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { toast, Toaster } from '@/components/ui/toast';

/** Seam: a toast as the visitor sees it, coloured by what happened. */
describe('Toaster', () => {
  it.each([
    ['success', 'Étape ajoutée'],
    ['deleted', 'Étape supprimée'],
    ['error', 'L’étape n’a pas pu être enregistrée.'],
    ['warning', 'Vous êtes hors ligne.'],
    ['info', 'Alertes tirages désactivées'],
  ])('shows a %s toast with its own colour and icon', async (type, title) => {
    render(<Toaster />);
    act(() => {
      toast.add({ title, type });
    });

    const card = (await screen.findByText(title)).closest('[data-kind]');
    expect(card).toHaveAttribute('data-kind', type);
    expect(card?.querySelector('[data-slot="toast-icon"] svg')).not.toBeNull();
  });

  it('shows a toast of no known kind plainly, without an icon', async () => {
    render(<Toaster />);
    act(() => {
      toast.add({ title: 'Bonjour' });
    });

    const title = await screen.findByText('Bonjour');
    expect(title.closest('[data-kind]')).toBeNull();
  });
});
