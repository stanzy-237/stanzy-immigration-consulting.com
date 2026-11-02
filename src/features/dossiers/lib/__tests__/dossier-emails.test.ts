import { describe, expect, it } from 'vitest';

import { dossierEmail } from '@/features/dossiers/lib/dossier-emails';

const base = { to: 'aminata@example.com', name: 'Aminata', url: 'https://stanzy.test/fr/mon-espace' } as const;

describe('the Client’s Dossier emails', () => {
  it('names the service and the new stage, in the Account’s language', () => {
    const fr = dossierEmail({ ...base, locale: 'fr', service: 'EDE', change: { kind: 'stageChanged', stage: 'envoi' } });
    expect(fr.subject).toBe('Votre dossier Évaluation des diplômes (EDE) a changé d’étape');
    expect(fr.text).toContain('« Envoi à l’organisme »');
    expect(fr.text).toContain(base.url);

    const en = dossierEmail({ ...base, locale: 'en', service: 'EDE', change: { kind: 'stageChanged', stage: 'envoi' } });
    expect(en.text).toContain('“Sending to the body”');
  });

  it('gives the reason when the Dossier is closed, escaped in the HTML', () => {
    const email = dossierEmail({ ...base, locale: 'fr', service: 'VERIFICATION', change: { kind: 'closed', reason: 'Refus <IRCC>' } });
    expect(email.text).toContain('Motif : Refus <IRCC>');
    expect(email.html).toContain('Refus &lt;IRCC&gt;');
  });
});
