// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withIntl } from '@/features/auth/views/__tests__/test-utils';
import { PartnerSettings } from '@/features/document-services/components/partner-settings';
import { createTestTRPC } from '@/trpc/__tests__/test-utils';

/** Seam: a service's partner and note template, as the consultant sets them (#148). The editor is only read. */
function settings(save = vi.fn(), template: unknown = null) {
  const partner = { partnerName: 'Banque Atlantique', partnerPhone: null, partnerEmail: null, partnerPrice: null, handoffTemplate: template };
  const { trpc, queryClient, wrap } = createTestTRPC({
    'documentServices.handoff.partner': () => partner,
    'documentServices.handoff.savePartner': (input) => save(input),
  });
  queryClient.setQueryData(trpc.documentServices.handoff.partner.queryKey({ serviceId: 'svc_pof' }), partner as never);
  return render(withIntl(wrap(<PartnerSettings serviceId="svc_pof" />)));
}

describe('a service’s partner (#148)', () => {
  it('saves the partner’s WhatsApp and email, an empty template as none', async () => {
    const save = vi.fn();
    const { container } = settings(save);
    expect(screen.getByLabelText('Nom du partenaire')).toHaveValue('Banque Atlantique');
    expect(screen.getByRole('combobox', { name: 'Insérer un champ' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.change(screen.getByLabelText('WhatsApp du partenaire'), { target: { value: '+237 690 00 00 00' } });
    fireEvent.change(screen.getByLabelText('E-mail du partenaire'), { target: { value: 'dossiers@banque.cm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le partenaire' }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        serviceId: 'svc_pof',
        partnerName: 'Banque Atlantique',
        partnerPhone: '+237 690 00 00 00',
        partnerEmail: 'dossiers@banque.cm',
        partnerPrice: null,
        template: null,
      }),
    );
  }, 30_000);

  it('points out a field it doesn’t know in the template', async () => {
    settings(vi.fn(), {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bonjour {cleint}' }] }],
    });
    expect(await screen.findByText('Champs inconnus : {cleint}. Ils resteront tels quels.')).toBeInTheDocument();
  });
});
