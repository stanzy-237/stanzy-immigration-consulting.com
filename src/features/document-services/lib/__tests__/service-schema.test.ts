import { describe, expect, it } from 'vitest';

import { STARTER_SERVICES } from '@/features/document-services/data/starter-services';
import { amountFor, serviceInput, textIn } from '@/features/document-services/lib/service-schema';

describe('a Service documentaire', () => {
  it('costs its price, or its share of the funds to justify', () => {
    expect(amountFor({ priceKind: 'FIXED', price: 25_000 })).toBe(25_000);
    expect(amountFor({ priceKind: 'PERCENT', price: 250 }, 10_000_000)).toBe(250_000);
    expect(amountFor({ priceKind: 'PERCENT', price: 250 })).toBeNull();
  });

  it('refuses a share over 100 %', () => {
    const service = { ...STARTER_SERVICES[0]!, active: false, price: 10_001 };
    expect(serviceInput.safeParse(service).success).toBe(false);
  });

  it('reads in the viewer’s language, else in the other', () => {
    expect(textIn({ fr: 'Certificat de police', en: 'Police certificate' }, 'en')).toBe('Police certificate');
    expect(textIn({ fr: 'Certificat de police', en: '' }, 'en')).toBe('Certificat de police');
  });

  it('starts from services that pass the form, without prices', () => {
    for (const service of STARTER_SERVICES) {
      expect(serviceInput.safeParse({ ...service, active: false, price: 0 }).success).toBe(true);
    }
  });
});
