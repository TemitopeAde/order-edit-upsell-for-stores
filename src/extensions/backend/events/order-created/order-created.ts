import { orders } from '@wix/ecom';
import { logger } from '../../../../backend/logger';
import { sessionManager } from '../../../../backend/sessions/sessionManager';
import { emailTransmissionService } from '../../../../backend/email/emailTransmissionService';
import { WixDataRepository } from '../../../../backend/db/wixDataRepository';

export default orders.onOrderCreated(async (event) => {
  logger.info('eCommerce onOrderCreated event received by Order Editor', {
    id: (event as any).id,
    entityId: (event as any).entityId,
  });

  try {
    const rawOrder =
      (event as any).createdEvent?.entity ||
      (event as any).entity ||
      (event as any).data?.order ||
      (event as any).order;

    if (!rawOrder) {
      logger.warn('Order created event missing order entity structure', { event });
      return;
    }

    const orderId = rawOrder.id || (event as any).entityId;
    if (!orderId) {
      logger.warn('Order created event missing orderId');
      return;
    }

    const orderNumber = rawOrder.number ? `#${rawOrder.number}` : `#${orderId.replace(/[^0-9]/g, '').slice(-4) || '1001'}`;
    const customerEmail = rawOrder.buyerInfo?.email;
    const customerName = [
      rawOrder.billingInfo?.contactDetails?.firstName,
      rawOrder.billingInfo?.contactDetails?.lastName,
    ]
      .filter(Boolean)
      .join(' ') || undefined;

    const siteId = (event as any).metadata?.instanceId || 'default-site';
    const repo = new WixDataRepository(siteId);
    const settings = await repo.getSettings();

    // Check if store owner has enabled post-purchase editing and automatic emails
    if (!settings.enabled) {
      logger.info('Order editor is disabled in settings; skipping order edit email notification', { orderId });
      return;
    }

    if (!settings.sendCustomerEmailOnOrder) {
      logger.info('Customer email notifications are disabled in settings; skipping', { orderId });
      return;
    }

    if (!customerEmail) {
      logger.info('No customer email on order; skipping email transmission', { orderId });
      return;
    }

    // Initialize the post-purchase order editing session
    const sessionResult = await sessionManager.getOrCreateSession({
      siteId,
      orderId,
    });

    if (!sessionResult.eligible || !sessionResult.session) {
      logger.info('Order is not eligible for post-purchase modification; email not transmitted', {
        orderId,
        reason: sessionResult.reason,
      });
      return;
    }

    const session = sessionResult.session;

    // Send email transmission via Wix Email Transmissions SDK
    const transmissionResult = await emailTransmissionService.sendOrderEditNotification({
      siteId,
      orderId,
      orderNumber: session.orderNumber || orderNumber,
      customerEmail,
      customerName,
      editingDeadline: session.editingDeadline,
      editingWindowMinutes: settings.editingWindowMinutes,
      items: session.originalLineItemsSnapshot,
      currency: session.currency,
      total: session.originalOrderTotal,
      sessionId: session._id,
    });

    logger.info('Order edit notification transmission finished', {
      orderId,
      orderNumber,
      transmissionId: transmissionResult.transmissionId,
      simulated: transmissionResult.simulated,
    });
  } catch (error: any) {
    logger.error('Error handling order created event for order edit email notification', error);
  }
});
