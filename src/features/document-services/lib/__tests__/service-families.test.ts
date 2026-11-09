import { describe, expect, it } from 'vitest';

import { serviceFamily } from '@/features/document-services/lib/service-families';

describe('serviceFamily', () => {
  it('puts both proof of funds services under one tab', () => {
    expect(serviceFamily('preuve-de-fonds')).toBe('preuve-de-fonds');
    expect(serviceFamily('preuve-de-fonds-sans-fonds')).toBe('preuve-de-fonds');
  });

  it('gives every other service its own', () => {
    expect(serviceFamily('attestation-cnps')).toBe('attestation-cnps');
    expect(serviceFamily('pack-experience-pro')).toBe('pack-experience-pro');
  });
});
