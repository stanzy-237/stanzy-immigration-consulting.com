import { beforeEach, describe, expect, it, vi } from 'vitest';

const jobs = vi.hoisted(() => ({ runDailyJobs: vi.fn() }));
vi.mock('@/features/notifications/server/daily-jobs', () => jobs);
vi.mock('@/server/db/client', () => ({ prisma: {} }));
vi.mock('@/server/email/app-mailer', () => ({ appMailer: {} }));

const call = (authorization?: string) =>
  new Request('https://stanzy.test/api/cron/daily', {
    method: 'POST',
    headers: authorization ? { authorization } : {},
  });

/** Seam: POST /api/cron/daily as the scheduled workflow calls it; the jobs themselves are stubbed. */
describe('POST /api/cron/daily', () => {
  beforeEach(() => {
    vi.resetModules();
    jobs.runDailyJobs.mockReset().mockResolvedValue({ dueSoon: 1, overdue: 0, signups: 2, deleted: 0 });
  });

  it('runs the jobs for the workflow holding CRON_SECRET', async () => {
    vi.stubEnv('CRON_SECRET', 's'.repeat(40));
    const { POST } = await import('@/features/notifications/server/daily-route');
    const response = await POST(call(`Bearer ${'s'.repeat(40)}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ dueSoon: 1, overdue: 0, signups: 2, deleted: 0 });
  });

  it('refuses anyone else, and runs nothing without a secret configured', async () => {
    vi.stubEnv('CRON_SECRET', 's'.repeat(40));
    let { POST } = await import('@/features/notifications/server/daily-route');
    expect((await POST(call('Bearer wrong'))).status).toBe(401);
    expect((await POST(call())).status).toBe(401);

    vi.resetModules();
    vi.stubEnv('CRON_SECRET', '');
    ({ POST } = await import('@/features/notifications/server/daily-route'));
    expect((await POST(call(`Bearer ${'s'.repeat(40)}`))).status).toBe(503);
    expect(jobs.runDailyJobs).not.toHaveBeenCalled();
  });
});
