import type { APIRoute } from 'astro';
import { WixDataRepository } from '../../../../backend/db/wixDataRepository';
import { emailTransmissionService } from '../../../../backend/email/emailTransmissionService';
import { sessionManager } from '../../../../backend/sessions/sessionManager';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { orderId, siteId = 'default-site', customerEmail } = body;

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'orderId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const repo = new WixDataRepository(siteId);
    let session = await repo.getActiveSessionForOrder(orderId);

    if (!session) {
      const sessionResult = await sessionManager.getOrCreateSession({ siteId, orderId });
      if (!sessionResult.eligible || !sessionResult.session) {
        return new Response(JSON.stringify({ error: sessionResult.reason || 'Order not eligible' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      session = sessionResult.session;
    }

    const targetEmail = customerEmail || session.customerEmail;
    if (!targetEmail) {
      return new Response(JSON.stringify({ error: 'No email address provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await emailTransmissionService.sendOrderEditNotification({
      siteId,
      orderId: session.orderId,
      orderNumber: session.orderNumber,
      customerEmail: targetEmail,
      editingDeadline: session.editingDeadline,
      items: session.originalLineItemsSnapshot,
      currency: session.currency,
      total: session.originalOrderTotal,
      sessionId: session._id,
    });

    return new Response(JSON.stringify({
      success: result.success,
      transmissionId: result.transmissionId,
      email: targetEmail,
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
