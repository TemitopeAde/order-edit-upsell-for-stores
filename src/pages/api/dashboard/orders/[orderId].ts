import type { APIRoute } from 'astro';
import { WixDataRepository } from '../../../../backend/db/wixDataRepository';

export const GET: APIRoute = async ({ params, request }) => {
  const orderId = params.orderId;
  const url = new URL(request.url);
  const siteId = url.searchParams.get('siteId') || 'default-site';

  if (!orderId) {
    return new Response(JSON.stringify({ error: 'orderId parameter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const repo = new WixDataRepository(siteId);
    const session = await repo.getActiveSessionForOrder(orderId);
    const auditLogs = await repo.listAuditLogs({ orderId });

    let paymentAdjustment = null;
    if (session?.paymentAdjustmentId) {
      paymentAdjustment = await repo.getPaymentAdjustment(session.paymentAdjustmentId);
    }

    return new Response(JSON.stringify({
      order: session,
      paymentAdjustment,
      auditLogs,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
