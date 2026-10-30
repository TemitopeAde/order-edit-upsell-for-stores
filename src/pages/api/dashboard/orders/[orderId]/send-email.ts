import type { APIRoute } from 'astro';
import { WixDataRepository } from '../../../../../backend/db/wixDataRepository';
import { emailTransmissionService } from '../../../../../backend/email/emailTransmissionService';
import { sessionManager } from '../../../../../backend/sessions/sessionManager';

export const POST: APIRoute = async ({ params, request }) => {
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
    let session = await repo.getActiveSessionForOrder(orderId);

    if (!session) {
      // Attempt to initialize session if not yet existing
      const sessionResult = await sessionManager.getOrCreateSession({
        siteId,
        orderId,
      });

      if (!sessionResult.eligible || !sessionResult.session) {
        return new Response(JSON.stringify({
          error: sessionResult.reason || 'Order is not eligible for editing',
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      session = sessionResult.session;
    }

    if (!session.customerEmail) {
      return new Response(JSON.stringify({
        error: 'No customer email address found on this order record',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await emailTransmissionService.sendOrderEditNotification({
      siteId,
      orderId: session.orderId,
      orderNumber: session.orderNumber,
      customerEmail: session.customerEmail,
      editingDeadline: session.editingDeadline,
      items: session.originalLineItemsSnapshot,
      currency: session.currency,
      total: session.originalOrderTotal,
      sessionId: session._id,
    });

    return new Response(JSON.stringify(result), {
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
