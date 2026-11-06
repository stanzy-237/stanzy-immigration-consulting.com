import { beforeEach, describe, expect, it, vi } from 'vitest';

const vercel = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@vercel/analytics', () => vercel);

import { cleanProps, crsRange, track } from '@/lib/analytics';

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('analytics', () => {
  it('sends custom events to Vercel in production, without the props left undefined', () => {
    vi.stubEnv('NODE_ENV', 'production');
    track('interest.started', { level: 'B', note: undefined });
    expect(vercel.track).toHaveBeenCalledWith('interest.started', { level: 'B' });
  });

  it('only logs them in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    track('crs.saved', { total: 480 });
    expect(vercel.track).not.toHaveBeenCalled();
    expect(debug).toHaveBeenCalledWith('[analytics]', 'crs.saved', { total: 480 });
  });

  it('gives a CRS score as a range, never the score itself', () => {
    expect(crsRange(478)).toBe('450-499');
    expect(crsRange(500)).toBe('500-549');
    expect(crsRange(null)).toBeUndefined();
    expect(cleanProps({ a: undefined })).toBeUndefined();
  });
});
