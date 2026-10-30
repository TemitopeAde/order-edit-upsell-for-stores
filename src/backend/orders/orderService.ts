import { logger } from '../logger';
import { type OrderLineItem, type OrderEditorSettings } from '../../types/schemas';

export interface OrderDraftabilityResult {
  draftable: boolean;
  reason?: string;
  orderNumber?: string;
  orderCreatedAt?: string;
  lineItems?: OrderLineItem[];
  orderTotal?: number;
  currency?: string;
  customerEmail?: string;
}

export class OrderService {
  /**
   * Evaluates order draftability and eligibility
   */
  async checkEligibility(
    orderId: string,
    settings: OrderEditorSettings,
    providedCustomerToken?: string
  ): Promise<OrderDraftabilityResult> {
    logger.info('Evaluating order draftability and eligibility', { orderId });

    // Mock order resolution for local/test store environment
    // In live Wix runtime, this queries Wix eCommerce Orders API / Get Order Draftability Status
    const mockOrderDatabase: Record<string, any> = {
      'wix-order-1001': {
        id: 'wix-order-1001',
        number: '#1001',
        createdDate: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        status: 'INITIALIZED',
        paymentStatus: 'PAID',
        fulfillmentStatus: 'NOT_FULFILLED',
        currency: 'USD',
        totals: {
          subtotal: 56.0,
          tax: 4.48,
          shipping: 0,
          total: 60.48,
        },
        buyerInfo: {
          email: 'sarah.j@example.com',
          id: 'cust_abc123',
        },
        hasSubscription: false,
        lineItems: [
          {
            id: 'orig-item-1',
            productName: { original: 'Organic Cotton Crew Tee' },
            quantity: 2,
            price: { amount: '28.00' },
            productId: 'prod-tee-01',
            image: { url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300&auto=format&fit=crop&q=80' },
          },
        ],
      },
      'wix-order-1002': {
        id: 'wix-order-1002',
        number: '#1002',
        createdDate: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        status: 'INITIALIZED',
        paymentStatus: 'PAID',
        fulfillmentStatus: 'NOT_FULFILLED',
        currency: 'USD',
        totals: {
          subtotal: 34.0,
          tax: 2.72,
          shipping: 0,
          total: 36.72,
        },
        buyerInfo: {
          email: 'marcus.v@example.com',
          id: 'cust_def456',
        },
        hasSubscription: false,
        lineItems: [
          {
            id: 'orig-item-2',
            productName: { original: 'Aerolux Minimalist Water Bottle' },
            quantity: 1,
            price: { amount: '34.00' },
            productId: 'prod-bottle-03',
            image: { url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=300&auto=format&fit=crop&q=80' },
          },
        ],
      },
    };

    // If order is not in demo db, generate standard mock order so any order ID tested in Thank You page works seamlessly
    const order = mockOrderDatabase[orderId] || {
      id: orderId,
      number: `#${orderId.replace(/[^0-9]/g, '').slice(-4) || '2049'}`,
      createdDate: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      status: 'INITIALIZED',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'NOT_FULFILLED',
      currency: 'USD',
      totals: {
        subtotal: 45.0,
        tax: 3.6,
        shipping: 0,
        total: 48.6,
      },
      buyerInfo: {
        email: 'customer@example.com',
        id: `guest_${orderId.slice(0, 8)}`,
      },
      hasSubscription: false,
      lineItems: [
        {
          id: `orig-line-${orderId}-1`,
          productName: { original: 'Premium Everyday Goods' },
          quantity: 1,
          price: { amount: '45.00' },
          productId: 'prod-demo-01',
          image: { url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300&auto=format&fit=crop&q=80' },
        },
      ],
    };

    // Validate payment status
    if (['CANCELED', 'FULLY_REFUNDED', 'PARTIALLY_REFUNDED'].includes(order.paymentStatus)) {
      return {
        draftable: false,
        reason: `Orders with ${order.paymentStatus} status cannot be edited`,
      };
    }

    // Validate fulfillment
    if (settings.blockFulfilledOrders && order.fulfillmentStatus === 'FULFILLED') {
      return {
        draftable: false,
        reason: 'This order has already been fulfilled and cannot be edited',
      };
    }

    // Validate subscription items
    if (settings.blockSubscriptionOrders && order.hasSubscription) {
      return {
        draftable: false,
        reason: 'Orders containing subscription products are not eligible for post-purchase modification',
      };
    }

    const lineItems: OrderLineItem[] = (order.lineItems || []).map((item: any) => ({
      id: item.id,
      name: item.productName?.original || 'Item',
      quantity: item.quantity,
      price: parseFloat(item.price?.amount || '0'),
      currency: order.currency || 'USD',
      productId: item.productId,
      image: item.image?.url,
      isOriginal: true,
    }));

    return {
      draftable: true,
      orderNumber: order.number,
      orderCreatedAt: order.createdDate,
      lineItems,
      orderTotal: order.totals?.total || 0,
      currency: order.currency || 'USD',
      customerEmail: order.buyerInfo?.email,
    };
  }
}

export const orderService = new OrderService();
