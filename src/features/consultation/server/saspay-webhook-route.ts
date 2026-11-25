import { after } from 'next/server';

import { refreshPayment } from '@/features/consultation/server/consultation-payments';
import { saspay, webhookIsValid } from '@/features/consultation/server/saspay';
import { env } from '@/lib/env';
import { prisma } from '@/server/db/client';

/**
 * POST /api/consultation/saspay: SasPay's webhook (#15), signed with the
 * secret shown when it was created. Only `transaction.success` and
 * `transaction.failed` matter. The event is never trusted as is: its
 * transaction is checked again with `verify` before anything is delivered,
 * and settling is idempotent, since an event can come more than once. Answers
 * at once; the work runs after the response.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = env.SASPAY_WEBHOOK_SECRET;
  const client = saspay();
  if (!secret || !client) return new Response(null, { status: 503 });

  const body = await request.text();
  if (!webhookIsValid(body, request.headers.get('x-webhook-signature'), request.headers.get('x-webhook-timestamp'), secret)) {
    console.warn('[saspay] webhook refused: bad signature or too old');
    return new Response(null, { status: 401 });
  }

  let event: { event?: string; data?: { id?: unknown } };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  const transactionId = typeof event.data?.id === 'string' ? event.data.id : null;
  console.info(`[saspay] webhook ${event.event ?? '—'} for ${transactionId ?? '—'}`);
  if (!transactionId || (event.event !== 'transaction.success' && event.event !== 'transaction.failed')) {
    return new Response(null, { status: 204 });
  }

  after(async () => {
    try {
      const payment = await prisma.consultationPayment.findUnique({ where: { transactionId } });
      if (payment) await refreshPayment(prisma, client, payment, true);
    } catch (error) {
      console.error('[saspay] webhook could not be handled', transactionId, error);
    }
  });
  return new Response(null, { status: 204 });
}
