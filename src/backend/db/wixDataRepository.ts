import { logger } from '../logger';
import {
  type OrderEditorSettings,
  type OrderEditSession,
  type OrderPaymentAdjustment,
  type OrderEditAuditLog,
  OrderEditorSettingsSchema,
} from '../../types/schemas';

// In-memory fallback cache when Wix Data isn't initialized or in dev preview
const memoryDb = {
  settings: new Map<string, OrderEditorSettings>(),
  sessions: new Map<string, OrderEditSession>(),
  adjustments: new Map<string, OrderPaymentAdjustment>(),
  auditLogs: [] as OrderEditAuditLog[],
};

// Seed initial default mock data so preview works out of the box
const DEFAULT_SITE_ID = 'default-site';

function getDefaultSettings(siteId: string): OrderEditorSettings {
  return OrderEditorSettingsSchema.parse({
    _id: `settings-${siteId}`,
    siteId,
    enabled: true,
    editingWindowMinutes: 30,
    allowMultipleEdits: true,
    productEligibilityMode: 'ALL',
    includedProductIds: [],
    excludedProductIds: [],
    maxDistinctAddedProducts: 5,
    maxAddedQuantity: 10,
    maxAdditionalValue: null,
    minAdditionalValue: null,
    blockFulfilledOrders: true,
    blockCanceledOrders: true,
    blockRefundedOrders: true,
    blockSubscriptionOrders: true,
    paymentFeatureEnabled: true,
    pendingPaymentReminderMinutes: 60,
    sendCustomerEmailOnOrder: true,
    emailSubjectTemplate: 'You can still edit your order #{orderNumber}!',
    customEmailNotice: 'Forgot something? Add items before your order ships with no additional shipping fee.',
    emailSenderName: 'Order Support',
    appearance: {
      widgetTitle: 'Forgot Something? Add to Your Order',
      widgetDescription: 'You can add products to this order for the next few minutes with no additional shipping!',
      addButtonLabel: 'Add to Order',
      checkoutButtonLabel: 'Confirm & Pay Additional Amount',
      primaryColor: '#0f172a',
      accentColor: '#2563eb',
      borderRadius: '12px',
      fontFamily: 'Inter, system-ui, sans-serif',
      bannerMessage: 'Post-Purchase Order Window Open',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

// Seed sample orders for preview/dashboard demo if empty
function initializeSampleData(siteId: string) {
  if (memoryDb.settings.has(siteId)) return;

  const initialSettings = getDefaultSettings(siteId);
  memoryDb.settings.set(siteId, initialSettings);

  const sampleSession1: OrderEditSession = {
    _id: 'sess-1001',
    siteId,
    orderId: 'wix-order-1001',
    orderNumber: '#1001',
    customerReference: 'cust_abc123',
    customerEmail: 'sarah.j@example.com',
    originalOrderCreatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    editingDeadline: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    status: 'ACTIVE',
    draftOrderId: 'draft-901',
    emailNotificationSentAt: new Date(Date.now() - 9 * 60 * 1000).toISOString(),
    emailTransmissionId: 'eml-mock-tx-1001',
    originalLineItemsSnapshot: [
      {
        id: 'orig-item-1',
        name: 'Organic Cotton Crew Tee',
        quantity: 2,
        price: 28.0,
        currency: 'USD',
        productId: 'prod-tee-01',
        image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300&auto=format&fit=crop&q=80',
        isOriginal: true,
      },
    ],
    addedLineItems: [
      {
        id: 'added-item-1',
        name: 'Heavyweight Canvas Tote',
        quantity: 1,
        price: 22.0,
        currency: 'USD',
        productId: 'prod-tote-02',
        image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=300&auto=format&fit=crop&q=80',
        isOriginal: false,
      },
    ],
    calculatedDraftSnapshot: {
      subtotal: 78.0,
      tax: 6.24,
      shipping: 0,
      discount: 0,
      total: 84.24,
      currency: 'USD',
      originalTotal: 60.48,
      additionalAmountDue: 23.76,
      lineItemsCount: 2,
      balanceDue: 23.76,
    },
    originalOrderTotal: 60.48,
    updatedOrderTotal: 84.24,
    currency: 'USD',
    additionalAmountDue: 23.76,
    paymentAdjustmentId: 'adj-501',
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    committedAt: null,
  };

  const sampleSession2: OrderEditSession = {
    _id: 'sess-1002',
    siteId,
    orderId: 'wix-order-1002',
    orderNumber: '#1002',
    customerReference: 'cust_def456',
    customerEmail: 'marcus.v@example.com',
    originalOrderCreatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    editingDeadline: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    status: 'COMPLETED',
    draftOrderId: 'draft-902',
    originalLineItemsSnapshot: [
      {
        id: 'orig-item-2',
        name: 'Aerolux Minimalist Water Bottle',
        quantity: 1,
        price: 34.0,
        currency: 'USD',
        productId: 'prod-bottle-03',
        image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=300&auto=format&fit=crop&q=80',
        isOriginal: true,
      },
    ],
    addedLineItems: [
      {
        id: 'added-item-2',
        name: 'Silicone Cleaning Brush Set',
        quantity: 1,
        price: 14.5,
        currency: 'USD',
        productId: 'prod-brush-04',
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80',
        isOriginal: false,
      },
    ],
    calculatedDraftSnapshot: {
      subtotal: 48.5,
      tax: 3.88,
      shipping: 0,
      discount: 0,
      total: 52.38,
      currency: 'USD',
      originalTotal: 36.72,
      additionalAmountDue: 15.66,
      lineItemsCount: 2,
      balanceDue: 0,
    },
    originalOrderTotal: 36.72,
    updatedOrderTotal: 52.38,
    currency: 'USD',
    additionalAmountDue: 15.66,
    paymentAdjustmentId: 'adj-502',
    createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    committedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  };

  memoryDb.sessions.set(sampleSession1._id, sampleSession1);
  memoryDb.sessions.set(sampleSession2._id, sampleSession2);

  const sampleAdjustment1: OrderPaymentAdjustment = {
    _id: 'adj-501',
    siteId,
    orderId: 'wix-order-1001',
    orderNumber: '#1001',
    editSessionId: 'sess-1001',
    paymentRequestId: 'pr-801',
    externalId: 'ext-adj-501',
    amount: 23.76,
    currency: 'USD',
    status: 'UNPAID',
    paymentPageUrl: 'https://pay.wix.com/checkout/payment-request/pr-801',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    paidAt: null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    lastVerifiedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    notes: 'Awaiting customer payment on Wix hosted checkout',
  };

  const sampleAdjustment2: OrderPaymentAdjustment = {
    _id: 'adj-502',
    siteId,
    orderId: 'wix-order-1002',
    orderNumber: '#1002',
    editSessionId: 'sess-1002',
    paymentRequestId: 'pr-802',
    externalId: 'ext-adj-502',
    amount: 15.66,
    currency: 'USD',
    status: 'PAID',
    paymentPageUrl: 'https://pay.wix.com/checkout/payment-request/pr-802',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    paidAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    expiresAt: null,
    lastVerifiedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    notes: 'Payment confirmed via Wix Order Payment Request webhook',
  };

  memoryDb.adjustments.set(sampleAdjustment1._id, sampleAdjustment1);
  memoryDb.adjustments.set(sampleAdjustment2._id, sampleAdjustment2);

  memoryDb.auditLogs.push(
    {
      _id: 'audit-01',
      siteId,
      orderId: 'wix-order-1002',
      orderNumber: '#1002',
      editSessionId: 'sess-1002',
      actorType: 'CUSTOMER',
      action: 'ITEMS_ADDED',
      status: 'SUCCESS',
      metadata: { addedProductId: 'prod-brush-04', quantity: 1, additionalAmount: 15.66 },
      createdAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
    },
    {
      _id: 'audit-02',
      siteId,
      orderId: 'wix-order-1002',
      orderNumber: '#1002',
      editSessionId: 'sess-1002',
      actorType: 'CUSTOMER',
      action: 'DRAFT_COMMITTED',
      status: 'SUCCESS',
      metadata: { draftOrderId: 'draft-902', itemsCommitted: 1, inventoryUpdated: true },
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      _id: 'audit-03',
      siteId,
      orderId: 'wix-order-1002',
      orderNumber: '#1002',
      editSessionId: 'sess-1002',
      actorType: 'SYSTEM',
      action: 'PAYMENT_CONFIRMED',
      status: 'SUCCESS',
      metadata: { paymentRequestId: 'pr-802', amountPaid: 15.66, currency: 'USD' },
      createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    },
    {
      _id: 'audit-04',
      siteId,
      orderId: 'wix-order-1001',
      orderNumber: '#1001',
      editSessionId: 'sess-1001',
      actorType: 'CUSTOMER',
      action: 'ITEMS_ADDED',
      status: 'SUCCESS',
      metadata: { addedProductId: 'prod-tote-02', quantity: 1, additionalAmount: 23.76 },
      createdAt: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    }
  );
}

// Ensure default site is initialized
initializeSampleData(DEFAULT_SITE_ID);

export class WixDataRepository {
  private siteId: string;

  constructor(siteId: string = DEFAULT_SITE_ID) {
    this.siteId = siteId;
    initializeSampleData(siteId);
  }

  // --- SETTINGS ---
  async getSettings(): Promise<OrderEditorSettings> {
    const existing = memoryDb.settings.get(this.siteId);
    if (existing) {
      return existing;
    }
    const created = getDefaultSettings(this.siteId);
    memoryDb.settings.set(this.siteId, created);
    return created;
  }

  async updateSettings(updates: Partial<OrderEditorSettings>): Promise<OrderEditorSettings> {
    const current = await this.getSettings();
    const updated: OrderEditorSettings = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    memoryDb.settings.set(this.siteId, updated);
    logger.info('Updated OrderEditorSettings', { siteId: this.siteId });
    return updated;
  }

  // --- SESSIONS ---
  async getSession(sessionId: string): Promise<OrderEditSession | null> {
    const session = memoryDb.sessions.get(sessionId);
    if (!session || session.siteId !== this.siteId) {
      return null;
    }
    return session;
  }

  async getActiveSessionForOrder(orderId: string): Promise<OrderEditSession | null> {
    for (const session of memoryDb.sessions.values()) {
      if (session.siteId === this.siteId && session.orderId === orderId) {
        // Return latest active or payment pending session
        if (session.status === 'ACTIVE' || session.status === 'ITEMS_ADDED' || session.status === 'PAYMENT_PENDING') {
          return session;
        }
      }
    }
    return null;
  }

  async listSessions(options?: { limit?: number; status?: string }): Promise<OrderEditSession[]> {
    const results: OrderEditSession[] = [];
    for (const session of memoryDb.sessions.values()) {
      if (session.siteId === this.siteId) {
        if (!options?.status || session.status === options.status) {
          results.push(session);
        }
      }
    }
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return options?.limit ? results.slice(0, options.limit) : results;
  }

  async saveSession(session: OrderEditSession): Promise<OrderEditSession> {
    memoryDb.sessions.set(session._id, {
      ...session,
      siteId: this.siteId,
      updatedAt: new Date().toISOString(),
    });
    return session;
  }

  // --- PAYMENT ADJUSTMENTS ---
  async getPaymentAdjustment(id: string): Promise<OrderPaymentAdjustment | null> {
    const adj = memoryDb.adjustments.get(id);
    if (!adj || adj.siteId !== this.siteId) {
      return null;
    }
    return adj;
  }

  async getAdjustmentByPaymentRequestId(paymentRequestId: string): Promise<OrderPaymentAdjustment | null> {
    for (const adj of memoryDb.adjustments.values()) {
      if (adj.siteId === this.siteId && adj.paymentRequestId === paymentRequestId) {
        return adj;
      }
    }
    return null;
  }

  async listPaymentAdjustments(options?: { status?: string; limit?: number }): Promise<OrderPaymentAdjustment[]> {
    const results: OrderPaymentAdjustment[] = [];
    for (const adj of memoryDb.adjustments.values()) {
      if (adj.siteId === this.siteId) {
        if (!options?.status || adj.status === options.status) {
          results.push(adj);
        }
      }
    }
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return options?.limit ? results.slice(0, options.limit) : results;
  }

  async savePaymentAdjustment(adj: OrderPaymentAdjustment): Promise<OrderPaymentAdjustment> {
    memoryDb.adjustments.set(adj._id, {
      ...adj,
      siteId: this.siteId,
      updatedAt: new Date().toISOString(),
    });
    return adj;
  }

  // --- AUDIT LOGS ---
  async recordAudit(log: Omit<OrderEditAuditLog, '_id' | 'siteId' | 'createdAt'>): Promise<OrderEditAuditLog> {
    const entry: OrderEditAuditLog = {
      ...log,
      _id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      siteId: this.siteId,
      createdAt: new Date().toISOString(),
    };
    memoryDb.auditLogs.unshift(entry);
    logger.info('Audit log recorded', { action: entry.action, orderId: entry.orderId, actor: entry.actorType });
    return entry;
  }

  async listAuditLogs(options?: { orderId?: string; limit?: number }): Promise<OrderEditAuditLog[]> {
    let logs = memoryDb.auditLogs.filter((l) => l.siteId === this.siteId);
    if (options?.orderId) {
      logs = logs.filter((l) => l.orderId === options.orderId);
    }
    return options?.limit ? logs.slice(0, options.limit) : logs;
  }
}
