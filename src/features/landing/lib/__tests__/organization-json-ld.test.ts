import { describe, expect, it } from 'vitest';

import { organizationJsonLd } from '@/features/landing/lib/organization-json-ld';

/** Seam: Stanzy as an entity for search and AI engines, from the footer's contact data. */
describe('organizationJsonLd', () => {
  it('describes the business, how to reach it and its profiles, without the WhatsApp chat link', () => {
    const data = organizationJsonLd('https://www.stanzy-immigration-consulting.com', 'Conseil en immigration canadienne.');

    expect(data).toMatchObject({
      '@type': 'ProfessionalService',
      '@id': 'https://www.stanzy-immigration-consulting.com/#organization',
      name: 'Stanzy Immigration Consulting',
      email: 'contact@stanzy-immigration-consulting.com',
      telephone: '+237679306015',
      address: { addressLocality: 'Douala', addressCountry: 'CM' },
    });
    expect(data.sameAs).toEqual(['https://facebook.com/stanzycanada', 'https://www.tiktok.com/@stanzycanada', 'https://instagram.com/stanzycanada']);
  });
});
