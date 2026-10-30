import type { APIRoute } from 'astro';
import { WixDataRepository } from '../../../../backend/db/wixDataRepository';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const siteId = url.searchParams.get('siteId') || 'default-site';
  const sessionId = url.searchParams.get('sessionId');
  const paymentRequestId = url.searchParams.get('paymentRequestId');

  try {
    const repo = new WixDataRepository(siteId);

    if (paymentRequestId) {
      const adj = await repo.getAdjustmentByPaymentRequestId(paymentRequestId);
      if (adj) {
        return new Response(JSON.stringify({ status: adj.status, adjustment: adj }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (sessionId) {
      const session = await repo.getSession(sessionId);
      if (session && session.paymentAdjustmentId) {
        const adj = await repo.getPaymentAdjustment(session.paymentAdjustmentId);
        return new Response(JSON.stringify({
          status: adj?.status || session.status,
          adjustment: adj,
          session,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Payment request not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
