import { describe, expect, it } from 'vitest';

import { accountReadyEmail } from '@/features/auth/lib/emails';

describe('« Votre compte est prêt »', () => {
  it('shows the address they sign in with and the link to choose a password, never a password', () => {
    const url = 'https://stanzy.test/api/auth/reset-password/tok?callbackURL=%2Ffr%2Freinitialiser-mot-de-passe%3Fnouveau%3D1';
    const mail = accountReadyEmail({ to: 'aminata@example.com', name: 'Aminata Diallo', locale: 'fr', url, days: 7 });
    expect(mail.subject).toBe('Votre compte Stanzy est prêt');
    expect(mail.html).toContain('Votre compte est prêt, Aminata.');
    expect(mail.html).toContain('aminata@example.com');
    expect(mail.html).toContain('À choisir vous-même');
    expect(mail.html).toContain('Créer mon mot de passe');
    expect(mail.html).toContain(url.replaceAll('&', '&amp;'));
    expect(mail.text).toContain('7 jours');
  });

  it('speaks English to an English Account', () => {
    expect(accountReadyEmail({ to: 'a@b.c', name: 'Sam', locale: 'en', url: 'https://x', days: 7 }).subject).toBe('Your Stanzy account is ready');
  });
});
