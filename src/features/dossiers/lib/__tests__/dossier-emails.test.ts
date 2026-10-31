import { describe, expect, it } from 'vitest';

import { consultantEmail, dossierEmail, excerptOf } from '@/features/dossiers/lib/dossier-emails';

const base = { to: 'aminata@example.com', name: 'Aminata', url: 'https://stanzy.test/fr/mon-espace' } as const;

describe('the Client’s Dossier emails', () => {
  it('names the service and the new stage, in the Account’s language', () => {
    const fr = dossierEmail({
      ...base,
      locale: 'fr',
      service: 'EDE',
      change: { kind: 'stageChanged', stage: 'envoi' },
    });
    expect(fr.subject).toBe('Votre dossier Évaluation des diplômes (EDE) a changé d’étape');
    expect(fr.text).toContain('« Envoi à l’organisme »');
    expect(fr.text).toContain(base.url);

    const en = dossierEmail({
      ...base,
      locale: 'en',
      service: 'EDE',
      change: { kind: 'stageChanged', stage: 'envoi' },
    });
    expect(en.text).toContain('“Sending to the body”');
  });

  it('gives the reason when the Dossier is closed, escaped in the HTML', () => {
    const email = dossierEmail({
      ...base,
      locale: 'fr',
      service: 'VERIFICATION',
      change: { kind: 'closed', reason: 'Refus <IRCC>' },
    });
    expect(email.text).toContain('Motif : Refus <IRCC>');
    expect(email.html).toContain('Refus &lt;IRCC&gt;');
  });
});

describe('emails about documents', () => {
  it('tells the Client which Document the consultant commented, quoting it', () => {
    const email = dossierEmail({
      ...base,
      locale: 'fr',
      service: 'ACCOMPAGNEMENT',
      change: { kind: 'comment', document: 'Relevé N2', excerpt: 'Le scan est flou.' },
    });
    expect(email.subject).toBe('Nouveau commentaire dans votre dossier Accompagnement Entrée Express');
    expect(email.text).toContain('« Relevé N2 »');
    expect(email.text).toContain('Le scan est flou.');
  });

  it('tells the consultant who uploaded what, with a button to the Dossier', () => {
    const email = consultantEmail({
      to: 'stanzy@example.com',
      locale: 'fr',
      client: 'Aminata Diallo',
      service: 'EDE',
      activity: { kind: 'clientUpload', document: 'Diplôme <Licence>' },
      url: 'https://admin.stanzy.test/dossiers/dos_1',
    });
    expect(email.subject).toBe('Aminata Diallo a ajouté « Diplôme <Licence> »');
    expect(email.html).toContain('Diplôme &lt;Licence&gt;');
    expect(email.html).toContain('Ouvrir le dossier');
  });

  it('cuts a long comment to 200 characters', () => {
    expect(excerptOf('a'.repeat(300))).toHaveLength(200);
    expect(excerptOf('court')).toBe('court');
  });
});
