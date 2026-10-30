import type { APIRoute } from 'astro';
import { WixDataRepository } from '../../../../backend/db/wixDataRepository';
import { sessionManager } from '../../../../backend/sessions/sessionManager';
import { draftOrderService } from '../../../../backend/draft-orders/draftOrderService';
import { paymentService } from '../../../../backend/payments/paymentService';
import { logger } from '../../../../backend/logger';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { siteId = 'default-site', sessionId } = body;

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const repo = new WixDataRepository(siteId);
    const session = await repo.getSession(sessionId);

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Server-side deadline check
    if (sessionManager.isSessionExpired(session)) {
      session.status = 'EXPIRED';
      await repo.saveSession(session);
      return new Response(JSON.stringify({ error: 'Order editing window has closed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (session.addedLineItems.length === 0) {
      return new Response(JSON.stringify({ error: 'No items have been added to this order' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Invariant validation: ensure original items were NOT mutated
    const allLines = [...session.originalLineItemsSnapshot, ...session.addedLineItems];
    const invariantCheck = draftOrderService.validateOriginalInvariants(
      session.originalLineItemsSnapshot,
      allLines
    );

    if (!invariantCheck.valid) {
      logger.error('CRITICAL: Draft order invariant check failed', { violation: invariantCheck.violation });
      return new Response(JSON.stringify({
        error: 'Order invariant violation: original order items cannot be removed or reduced.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Commit draft order to original order in Wix
    const commitResult = await draftOrderService.commitDraft(session.draftOrderId || 'draft-default', siteId);
    session.committedAt = commitResult.committedAt;

    const additionalAmount = session.additionalAmountDue;

    if (additionalAmount > 0) {
      // Create Wix Order Payment Request
      const adjustment = await paymentService.createPaymentRequest({
        siteId,
        orderId: session.orderId,
        orderNumber: session.orderNumber,
        editSessionId: session._id,
        amount: additionalAmount,
        currency: session.currency,
      });

      await repo.savePaymentAdjustment(adjustment);

      session.status = 'PAYMENT_PENDING';
      session.paymentAdjustmentId = adjustment._id;
      await repo.saveSession(session);

      await repo.recordAudit({
        orderId: session.orderId,
        orderNumber: session.orderNumber,
        editSessionId: session._id,
        actorType: 'CUSTOMER',
        action: 'DRAFT_COMMITTED_PAYMENT_REQUESTED',
        status: 'SUCCESS',
        metadata: {
          additionalAmount,
          paymentRequestId: adjustment.paymentRequestId,
          paymentPageUrl: adjustment.paymentPageUrl,
        },
      });

      return new Response(JSON.stringify({
        success: true,
        orderUpdated: true,
        paymentRequired: true,
        status: 'PAYMENT_PENDING',
        paymentPageUrl: adjustment.paymentPageUrl,
        amount: additionalAmount,
        currency: session.currency,
        session,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      session.status = 'COMPLETED';
      await repo.saveSession(session);

      await repo.recordAudit({
        orderId: session.orderId,
        orderNumber: session.orderNumber,
        editSessionId: session._id,
        actorType: 'CUSTOMER',
        action: 'DRAFT_COMMITTED_NO_PAYMENT',
        status: 'SUCCESS',
        metadata: { additionalAmount: 0 },
      });

      return new Response(JSON.stringify({
        success: true,
        orderUpdated: true,
        paymentRequired: false,
        status: 'COMPLETED',
        session,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
