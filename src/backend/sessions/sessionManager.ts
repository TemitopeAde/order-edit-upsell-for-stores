import { logger } from '../logger';
import { WixDataRepository } from '../db/wixDataRepository';
import { orderService } from '../orders/orderService';
import {
  type OrderEditSession,
  type OrderEditorSettings,
} from '../../types/schemas';

export class SessionManager {
  /**
   * Initializes or gets the active editing session for an order
   */
  async getOrCreateSession(params: {
    siteId: string;
    orderId: string;
    token?: string;
  }): Promise<{
    session?: OrderEditSession;
    eligible: boolean;
    reason?: string;
    settings?: OrderEditorSettings;
  }> {
    const { siteId, orderId } = params;
    const repo = new WixDataRepository(siteId);
    const settings = await repo.getSettings();

    if (!settings.enabled) {
      return { eligible: false, reason: 'Order editing is currently disabled by store owner' };
    }

    // Check if there is an existing active session
    let existingSession = await repo.getActiveSessionForOrder(orderId);

    if (existingSession) {
      // Re-verify server deadline
      const deadlineTime = new Date(existingSession.editingDeadline).getTime();
      const now = Date.now();

      if (now > deadlineTime) {
        existingSession.status = 'EXPIRED';
        await repo.saveSession(existingSession);
        return {
          eligible: false,
          reason: 'Your order editing window has expired',
          session: existingSession,
          settings,
        };
      }

      // Check if previous payment is pending
      if (existingSession.status === 'PAYMENT_PENDING') {
        return {
          eligible: true,
          session: existingSession,
          settings,
        };
      }

      return { eligible: true, session: existingSession, settings };
    }

    // Check order draftability and eligibility
    const eligibility = await orderService.checkEligibility(orderId, settings);
    if (!eligibility.draftable) {
      return { eligible: false, reason: eligibility.reason || 'Order is not eligible for modification', settings };
    }

    const orderCreatedDate = eligibility.orderCreatedAt || new Date().toISOString();
    const createdTimestamp = new Date(orderCreatedDate).getTime();
    const deadlineTimestamp = createdTimestamp + settings.editingWindowMinutes * 60 * 1000;
    const now = Date.now();

    if (now > deadlineTimestamp) {
      return {
        eligible: false,
        reason: 'The post-purchase editing window for this order has closed',
        settings,
      };
    }

    const newSession: OrderEditSession = {
      _id: `sess-${orderId}-${Date.now().toString(36)}`,
      siteId,
      orderId,
      orderNumber: eligibility.orderNumber || '#1001',
      customerEmail: eligibility.customerEmail,
      originalOrderCreatedAt: orderCreatedDate,
      editingDeadline: new Date(deadlineTimestamp).toISOString(),
      status: 'ACTIVE',
      draftOrderId: null,
      originalLineItemsSnapshot: eligibility.lineItems || [],
      addedLineItems: [],
      calculatedDraftSnapshot: null,
      originalOrderTotal: eligibility.orderTotal || 0,
      updatedOrderTotal: eligibility.orderTotal || 0,
      currency: eligibility.currency || 'USD',
      additionalAmountDue: 0,
      paymentAdjustmentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      committedAt: null,
    };

    await repo.saveSession(newSession);
    await repo.recordAudit({
      orderId,
      orderNumber: newSession.orderNumber,
      editSessionId: newSession._id,
      actorType: 'CUSTOMER',
      action: 'SESSION_INITIALIZED',
      status: 'SUCCESS',
      metadata: { originalOrderTotal: newSession.originalOrderTotal },
    });

    // Automatically send email transmission to notify customer if enabled
    if (settings.sendCustomerEmailOnOrder && newSession.customerEmail) {
      import('../email/emailTransmissionService')
        .then(({ emailTransmissionService }) => {
          emailTransmissionService
            .sendOrderEditNotification({
              siteId,
              orderId,
              orderNumber: newSession.orderNumber,
              customerEmail: newSession.customerEmail!,
              editingDeadline: newSession.editingDeadline,
              editingWindowMinutes: settings.editingWindowMinutes,
              items: newSession.originalLineItemsSnapshot,
              currency: newSession.currency,
              total: newSession.originalOrderTotal,
              sessionId: newSession._id,
            })
            .catch((err) => logger.error('Failed to send auto email notification on session init', err));
        })
        .catch((err) => logger.error('Failed to import email transmission service', err));
    }

    return { eligible: true, session: newSession, settings };
  }

  /**
   * Enforces server-side deadline on every customer operation
   */
  isSessionExpired(session: OrderEditSession): boolean {
    const deadline = new Date(session.editingDeadline).getTime();
    return Date.now() > deadline;
  }
}

export const sessionManager = new SessionManager();
