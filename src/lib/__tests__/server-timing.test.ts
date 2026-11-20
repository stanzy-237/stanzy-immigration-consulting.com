import { describe, expect, it } from 'vitest';

import { serverTiming } from '@/lib/server-timing';

describe('serverTiming (#165)', () => {
  it('records each step’s duration, even a failed one, as a Server-Timing header', async () => {
    const timing = serverTiming();
    expect(await timing.time('session', async () => 'acc_1')).toBe('acc_1');
    await expect(timing.time('r2', async () => Promise.reject(new Error('down')))).rejects.toThrow('down');
    expect(timing.header()).toMatch(/^session;dur=\d+\.\d, r2;dur=\d+\.\d$/);
  });
});
