import { describe, expect, it } from 'vitest';

import { brandEmail, slotParts, teamEmail } from '@/server/email/brand-email';

describe('brandEmail (boards 3.1–3.7)', () => {
  const mail = brandEmail({
    to: 'aminata@example.com',
    subject: 'C’est réservé',
    eyebrow: 'Consultation confirmée',
    art: 'booked',
    title: 'C’est réservé, Aminata.',
    lines: ['Votre paiement est reçu <vraiment>.'],
    card: { kind: 'slot', month: 'NOV.', day: '25', title: 'Mercredi 25 novembre · 09:00 – 09:45', sub: 'Heure de Douala', rows: [{ label: 'Payé · MTN', value: '4 714 FCFA' }] },
    cta: { label: 'Préparer la Réunion', url: 'https://example.com/r?a=1&b=2' },
    links: [{ label: 'Écrire à Stanzy', url: 'https://wa.me/x' }],
    help: 'Une question ? Répondez sur WhatsApp à Stanzy.',
    footer: 'Stanzy Immigration Consulting · e-mail envoyé car vous avez réservé une consultation.',
  });

  it('lays out the board: logo and label, illustration from the public site, title, card, button, footer', () => {
    expect(mail.html).toContain('https://www.stanzy-immigration-consulting.com/email/logo.png');
    expect(mail.html).toContain('https://www.stanzy-immigration-consulting.com/email/booked.png');
    expect(mail.html).toContain('Consultation confirmée');
    expect(mail.html).toContain('C’est réservé, Aminata.');
    expect(mail.html).toContain('href="https://example.com/r?a=1&amp;b=2"');
    expect(mail.html).toContain('#CC1627');
    expect(mail.html).toContain('Une question ? Répondez sur WhatsApp à Stanzy.');
  });

  it('escapes what it is given', () => {
    expect(mail.html).toContain('reçu &lt;vraiment&gt;.');
    expect(mail.html).not.toContain('<vraiment>');
  });

  it('reads in plain text: title, text, card, the button’s link', () => {
    expect(mail.text).toContain('C’est réservé, Aminata.');
    expect(mail.text).toContain('Payé · MTN · 4 714 FCFA');
    expect(mail.text).toContain('Préparer la Réunion\nhttps://example.com/r?a=1&b=2');
  });
});

describe('teamEmail (board 3.8)', () => {
  it('is compact: the Client’s initials, a tag, the note quoted, a navy button, no illustration', () => {
    const mail = teamEmail({
      to: 'stanzy@example.com',
      subject: 'Aminata Diallo vous a écrit',
      person: { name: 'Aminata Diallo', context: 'Accompagnement Entrée Express' },
      tag: 'Message',
      lines: ['Aminata Diallo vous a écrit dans son dossier.'],
      note: { text: 'J’ai reçu mon résultat TCF', quote: true },
      cta: { label: 'Ouvrir le dossier', url: 'https://admin.example.com/dossiers/1' },
    });
    expect(mail.html).toContain('>AD<');
    expect(mail.html).toContain('« J’ai reçu mon résultat TCF »');
    expect(mail.html).toContain('#0D1F4E');
    expect(mail.html).not.toContain('/email/booked.png');
  });
});

describe('slotParts', () => {
  it('gives the tile and the line in Douala time', () => {
    expect(slotParts(new Date('2026-11-25T08:00:00Z'), 45, 'fr')).toEqual({ month: 'NOV.', day: '25', title: 'Mercredi 25 novembre · 09:00 – 09:45' });
  });
});

describe('withGreeting', () => {
  it('reads « Bonjour Aminata, » and the next paragraph as one sentence, names keeping their capital', async () => {
    const { withGreeting } = await import('@/features/dossiers/lib/dossier-emails');
    expect(withGreeting(['Bonjour Aminata,', 'Votre dossier est ouvert.', 'Suite.'])).toEqual(['Bonjour Aminata, votre dossier est ouvert.', 'Suite.']);
    expect(withGreeting(['Bonjour Aminata,', 'Stanzy a commenté.'])).toEqual(['Bonjour Aminata, Stanzy a commenté.']);
    expect(withGreeting(['Une seule ligne.'])).toEqual(['Une seule ligne.']);
  });
});
