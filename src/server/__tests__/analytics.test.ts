import { beforeEach, describe, expect, it, vi } from 'vitest';

const vercel = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@vercel/analytics/server', () => vercel);
vi.mock('next/server', () => ({ after: (fn: () => unknown) => fn() }));

import { trackLater } from '@/server/analytics';

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('server analytics', () => {
  it('sends after the response, with the request’s headers, on Vercel', () => {
    vi.stubEnv('VERCEL', '1');
    const headers = new Headers({ 'user-agent': 'test' });
    trackLater(headers, 'invoice.paid', { service: 'ACCOMPAGNEMENT', extra: undefined });
    expect(vercel.track).toHaveBeenCalledWith('invoice.paid', { service: 'ACCOMPAGNEMENT' }, { headers });
  });

  it('sends nothing elsewhere (development, tests)', () => {
    vi.stubEnv('VERCEL', '');
    trackLater(new Headers(), 'invoice.paid');
    expect(vercel.track).not.toHaveBeenCalled();
  });
});
