import { orders } from '@wix/ecom';
import { appInstances } from '@wix/app-management';
import { auth } from '@wix/essentials';
import { logger } from '../../../../backend/logger';
import { sessionManager } from '../../../../backend/sessions/sessionManager';
import { emailTransmissionService } from '../../../../backend/email/emailTransmissionService';
import { WixDataRepository } from '../../../../backend/db/wixDataRepository';

const getAppInstance = auth.elevate(appInstances.getAppInstance);

export default orders.onOrderCreated(async (event) => {
  logger.info('eCommerce onOrderCreated event received by Order Editor', {
    id: event.metadata._id,
    entityId: event.metadata.entityId,
    siteId: event.metadata.accountInfo?.siteId,
  });

  try {
    const order = event.entity;

    if (!order) {
      logger.warn('Order created event missing order entity structure', { event });
      return;
    }

    const orderId = order._id || event.metadata.entityId;
    if (!orderId) {
      logger.warn('Order created event missing orderId', {
        eventId: event.metadata._id,
        entityId: event.metadata.entityId,
      });
      return;
    }

    const orderNumber = order.number ? `#${order.number}` : `#${orderId.replace(/[^0-9]/g, '').slice(-4) || '1001'}`;
    const customerEmail = order.buyerInfo?.email;
    const customerName = [
      order.billingInfo?.contactDetails?.firstName,
      order.billingInfo?.contactDetails?.lastName,
    ]
      .filter(Boolean)
      .join(' ') || undefined;

    let siteId = event.metadata.accountInfo?.siteId;
    if (!siteId) {
      try {
        // Some order events omit accountInfo.siteId. Resolve the site from the
        // app instance context instead of dropping the event.
        const appInstance = await getAppInstance();
        siteId = appInstance.site?.siteId;
      } catch (error: any) {
        logger.warn('Could not resolve siteId from the app instance for order event', {
          eventId: event.metadata._id,
          orderId,
          instanceId: event.metadata.instanceId,
          error: error?.message,
        });
      }
    }

    if (!siteId) {
      logger.warn('Order created event has no resolvable siteId', {
        eventId: event.metadata._id,
        orderId,
        instanceId: event.metadata.instanceId,
      });
      return;
    }

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

    if (session.emailNotificationSentAt) {
      logger.info('Order edit notification already sent; skipping duplicate event', { orderId });
      return;
    }

    // Send email transmission via Wix Email Transmissions SDK
    const transmissionResult = await emailTransmissionService.sendOrderEditNotification({
      siteId,
      orderId,
      orderNumber: session.orderNumber || orderNumber,
      customerEmail: session.customerEmail || customerEmail,
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
      orderNumber: session.orderNumber || orderNumber,
      transmissionId: transmissionResult.transmissionId,
      simulated: transmissionResult.simulated,
    });
  } catch (error: any) {
    logger.error('Error handling order created event for order edit email notification', error);
  }
});
