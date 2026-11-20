import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Seam: Rollbar's server SDK, recording what it is asked to send (#160). */
const sdk = vi.hoisted(() => ({ config: null as unknown, error: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('rollbar', () => ({
  default: class {
    constructor(config: unknown) {
      sdk.config = config;
    }
    error(...args: unknown[]) {
      sdk.error(...args);
      (args.at(-1) as () => void)();
    }
  },
}));
vi.mock('@/lib/env', () => ({ env: { ROLLBAR_STANZY_IMMIGRATION_CONSULTING_CO_SERVER_TOKEN_1795122183: 'server-token' } }));

beforeEach(() => vi.clearAllMocks());

describe('reporting a server error (#160)', () => {
  it('sends the error with its route and the Account’s id and role, and no headers or cookies', async () => {
    const { reportServerError } = await import('@/features/reports/server/rollbar');
    const error = new Error('Prisma timed out');
    await reportServerError(error, { route: 'trpc/invoices.create', method: 'POST', person: { id: 'acc_1', role: 'MEMBER' } });

    expect(sdk.config).toMatchObject({ accessToken: 'server-token', enabled: true, captureUncaught: false, captureEmail: false });
    const [sent, request, custom] = sdk.error.mock.calls[0]!;
    expect(sent).toBe(error);
    expect(request).toEqual({ headers: {}, method: 'POST', url: 'trpc/invoices.create', rollbar_person: { id: 'acc_1', role: 'MEMBER' } });
    expect(custom).toEqual({ route: 'trpc/invoices.create' });
  });

  it('turns anything thrown into an Error, and never fails the request itself', async () => {
    const { reportServerError } = await import('@/features/reports/server/rollbar');
    await reportServerError('boom', { route: '/fr', person: null });
    expect(sdk.error.mock.calls[0]![0]).toEqual(new Error('boom'));
    expect(sdk.error.mock.calls[0]![1]).toMatchObject({ rollbar_person: { id: null } });

    sdk.error.mockImplementationOnce(() => {
      throw new Error('Rollbar unreachable');
    });
    await expect(reportServerError(new Error('x'), { route: '/fr', person: null })).resolves.toBeUndefined();
  });
});
