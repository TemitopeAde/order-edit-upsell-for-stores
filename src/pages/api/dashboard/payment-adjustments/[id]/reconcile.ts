import type { APIRoute } from 'astro';
import { WixDataRepository } from '@/backend/db/wixDataRepository';
import { paymentService } from '@/backend/payments/paymentService';

export const POST: APIRoute = async ({ params, request }) => {
  const adjustmentId = params.id;
  const url = new URL(request.url);
  const siteId = url.searchParams.get('siteId') || 'default-site';

  if (!adjustmentId) {
    return new Response(JSON.stringify({ error: 'Adjustment ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const repo = new WixDataRepository(siteId);
    const adj = await repo.getPaymentAdjustment(adjustmentId);

    if (!adj) {
      return new Response(JSON.stringify({ error: 'Payment adjustment not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const reconciliation = await paymentService.reconcilePaymentStatus(adj);
    adj.status = reconciliation.status;
    adj.paidAt = reconciliation.paidAt;
    adj.lastVerifiedAt = new Date().toISOString();
    adj.notes = reconciliation.notes;

    await repo.savePaymentAdjustment(adj);

    // Update corresponding session if status became PAID
    if (adj.status === 'PAID') {
      const session = await repo.getSession(adj.editSessionId);
      if (session) {
        session.status = 'COMPLETED';
        await repo.saveSession(session);
      }
    }

    await repo.recordAudit({
      orderId: adj.orderId,
      orderNumber: adj.orderNumber,
      editSessionId: adj.editSessionId,
      actorType: 'MERCHANT',
      action: 'PAYMENT_RECONCILED',
      status: 'SUCCESS',
      metadata: {
        adjustmentId,
        paymentRequestId: adj.paymentRequestId,
        reconciledStatus: adj.status,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      adjustment: adj,
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
