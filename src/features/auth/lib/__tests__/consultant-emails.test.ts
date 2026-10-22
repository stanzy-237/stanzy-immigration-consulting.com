import { describe, expect, it } from 'vitest';

import { parseConsultantEmails } from '@/features/auth/lib/consultant-emails';

describe('parseConsultantEmails', () => {
  it('reads a comma-separated list, trimmed and lower-cased', () => {
    expect(parseConsultantEmails(' Stanzy@Example.com, ops@example.com ,')).toEqual({
      emails: ['stanzy@example.com', 'ops@example.com'],
      invalid: [],
    });
  });

  it.each([undefined, '', ' , '])('is empty for %j (no consultant configured)', (raw) => {
    expect(parseConsultantEmails(raw)).toEqual({ emails: [], invalid: [] });
  });

  it('reports entries that are not email addresses', () => {
    expect(parseConsultantEmails('stanzy@example.com, stanzy, @example.com')).toEqual({
      emails: ['stanzy@example.com'],
      invalid: ['stanzy', '@example.com'],
    });
  });
});
