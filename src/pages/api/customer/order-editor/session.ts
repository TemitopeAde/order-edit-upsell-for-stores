import type { APIRoute } from 'astro';
import { sessionManager } from '../../../../backend/sessions/sessionManager';
import { catalogService } from '../../../../backend/catalog/catalogService';
import { WixDataRepository } from '../../../../backend/db/wixDataRepository';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const orderId = url.searchParams.get('orderId') || 'wix-order-1001';
  const siteId = url.searchParams.get('siteId') || 'default-site';

  try {
    const result = await sessionManager.getOrCreateSession({ siteId, orderId });

    if (!result.eligible || !result.session) {
      return new Response(JSON.stringify({
        eligible: false,
        reason: result.reason || 'Order is not eligible for editing',
        settings: result.settings,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const repo = new WixDataRepository(siteId);
    let paymentAdjustment = null;
    if (result.session.paymentAdjustmentId) {
      paymentAdjustment = await repo.getPaymentAdjustment(result.session.paymentAdjustmentId);
    }

    const deadlineTimestamp = new Date(result.session.editingDeadline).getTime();
    const remainingSeconds = Math.max(0, Math.floor((deadlineTimestamp - Date.now()) / 1000));

    const eligibleProducts = await catalogService.getEligibleProducts(result.settings!);

    return new Response(JSON.stringify({
      eligible: true,
      session: result.session,
      settings: result.settings,
      paymentAdjustment,
      remainingSeconds,
      eligibleProducts,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      eligible: false,
      reason: error.message || 'Failed to retrieve order session',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const orderId = body.orderId || 'wix-order-1001';
    const siteId = body.siteId || 'default-site';

    const result = await sessionManager.getOrCreateSession({ siteId, orderId });
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
