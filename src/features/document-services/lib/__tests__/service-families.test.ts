import { describe, expect, it } from 'vitest';

import { serviceFamily, shortName } from '@/features/document-services/lib/service-families';

describe('serviceFamily', () => {
  it('puts both proof of funds services under one tab', () => {
    expect(serviceFamily('preuve-de-fonds')).toBe('preuve-de-fonds');
    expect(serviceFamily('preuve-de-fonds-sans-fonds')).toBe('preuve-de-fonds');
  });

  it('gives every other service its own', () => {
    expect(serviceFamily('attestation-cnps')).toBe('attestation-cnps');
    expect(serviceFamily('pack-experience-pro')).toBe('pack-experience-pro');
    // Only the two proof of funds services, not any slug that starts the same way.
    expect(serviceFamily('preuve-de-fonds-entreprise')).toBe('preuve-de-fonds-entreprise');
  });
});

describe('shortName', () => {
  it('drops what the brackets explain', () => {
    expect(shortName('ACF (Attestation de conformité fiscale)')).toBe('ACF');
    expect(shortName('Pack expérience pro (CNPS + compte salaire)')).toBe('Pack expérience pro');
    expect(shortName('Attestation CNPS')).toBe('Attestation CNPS');
  });
});
