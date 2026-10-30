import type { APIRoute } from 'astro';
import { logger } from '../../../../backend/logger';
import { WixDataRepository } from '../../../../backend/db/wixDataRepository';

export const POST: APIRoute = async ({ params, request }) => {
  const event = params.event;
  logger.info(`Received Wix Webhook: ${event}`);

  try {
    let payload: any = {};
    const text = await request.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }
    }

    const siteId = payload.siteId || 'default-site';
    const repo = new WixDataRepository(siteId);

    switch (event) {
      case 'order-payment-request-paid': {
        const paymentRequestId = payload.paymentRequestId || payload.entityId;
        if (paymentRequestId) {
          const adj = await repo.getAdjustmentByPaymentRequestId(paymentRequestId);
          if (adj) {
            adj.status = 'PAID';
            adj.paidAt = new Date().toISOString();
            adj.lastVerifiedAt = new Date().toISOString();
            adj.notes = 'Payment confirmed via Wix Order Payment Request webhook';
            await repo.savePaymentAdjustment(adj);

            const session = await repo.getSession(adj.editSessionId);
            if (session) {
              session.status = 'COMPLETED';
              await repo.saveSession(session);
            }

            await repo.recordAudit({
              orderId: adj.orderId,
              orderNumber: adj.orderNumber,
              editSessionId: adj.editSessionId,
              actorType: 'SYSTEM',
              action: 'WEBHOOK_PAYMENT_PAID',
              status: 'SUCCESS',
              metadata: { paymentRequestId, amount: adj.amount },
            });
          }
        }
        break;
      }

      case 'order-payment-request-expired': {
        const paymentRequestId = payload.paymentRequestId || payload.entityId;
        if (paymentRequestId) {
          const adj = await repo.getAdjustmentByPaymentRequestId(paymentRequestId);
          if (adj && adj.status !== 'PAID') {
            adj.status = 'EXPIRED';
            await repo.savePaymentAdjustment(adj);

            const session = await repo.getSession(adj.editSessionId);
            if (session && session.status !== 'COMPLETED') {
              session.status = 'EXPIRED';
              await repo.saveSession(session);
            }
          }
        }
        break;
      }

      case 'order-payment-request-voided': {
        const paymentRequestId = payload.paymentRequestId || payload.entityId;
        if (paymentRequestId) {
          const adj = await repo.getAdjustmentByPaymentRequestId(paymentRequestId);
          if (adj) {
            adj.status = 'VOIDED';
            await repo.savePaymentAdjustment(adj);
          }
        }
        break;
      }

      default:
        logger.info(`Unhandled webhook event: ${event}`);
    }

    return new Response(JSON.stringify({ received: true, event }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    logger.error('Webhook error', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
