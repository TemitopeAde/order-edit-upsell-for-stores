import type { APIRoute } from 'astro';
import { WixDataRepository } from '../../../../backend/db/wixDataRepository';
import { sessionManager } from '../../../../backend/sessions/sessionManager';
import { catalogService } from '../../../../backend/catalog/catalogService';
import { draftOrderService } from '../../../../backend/draft-orders/draftOrderService';
import { type OrderLineItem } from '../../../../types/schemas';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { siteId = 'default-site', sessionId, items } = body;

    if (!sessionId || !Array.isArray(items)) {
      return new Response(JSON.stringify({ error: 'sessionId and items array are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const repo = new WixDataRepository(siteId);
    const session = await repo.getSession(sessionId);

    if (!session) {
      return new Response(JSON.stringify({ error: 'Editing session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Server-side deadline check
    if (sessionManager.isSessionExpired(session)) {
      session.status = 'EXPIRED';
      await repo.saveSession(session);
      return new Response(JSON.stringify({ error: 'Order editing window has expired' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const settings = await repo.getSettings();

    // Map and validate added items
    const newAddedLineItems: OrderLineItem[] = [];
    let currentAddedValue = 0;

    for (const item of items) {
      const validation = await catalogService.validateProductAddition(
        settings,
        item.productId,
        item.quantity || 1,
        newAddedLineItems.length,
        currentAddedValue
      );

      if (!validation.valid || !validation.product) {
        return new Response(JSON.stringify({ error: validation.reason || 'Product addition failed validation' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const prod = validation.product;
      const quantity = Math.max(1, item.quantity || 1);
      const unitPrice = item.variantPrice || prod.price;

      newAddedLineItems.push({
        id: `added-${prod.id}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        name: prod.name,
        quantity,
        price: unitPrice,
        currency: prod.currency,
        productId: prod.id,
        variantId: item.variantId,
        options: item.options,
        image: prod.mainMedia,
        isOriginal: false,
      });

      currentAddedValue += unitPrice * quantity;
    }

    // Create draft if not created yet
    let draftOrderId = session.draftOrderId;
    if (!draftOrderId) {
      draftOrderId = await draftOrderService.createDraft(session.orderId, siteId);
      session.draftOrderId = draftOrderId;
    }

    // Calculate draft authoritatively
    const calc = await draftOrderService.addLineItemsAndCalculate(
      draftOrderId,
      session.originalLineItemsSnapshot,
      newAddedLineItems
    );

    session.addedLineItems = newAddedLineItems;
    session.calculatedDraftSnapshot = calc.calculatedSnapshot;
    session.updatedOrderTotal = calc.calculatedSnapshot.total;
    session.additionalAmountDue = calc.calculatedSnapshot.additionalAmountDue;
    session.status = newAddedLineItems.length > 0 ? 'ITEMS_ADDED' : 'ACTIVE';

    await repo.saveSession(session);
    await repo.recordAudit({
      orderId: session.orderId,
      orderNumber: session.orderNumber,
      editSessionId: session._id,
      actorType: 'CUSTOMER',
      action: 'ITEMS_UPDATED',
      status: 'SUCCESS',
      metadata: {
        addedCount: newAddedLineItems.length,
        additionalAmountDue: session.additionalAmountDue,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      session,
      calculated: calc.calculatedSnapshot,
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
