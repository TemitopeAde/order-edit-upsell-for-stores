import { orders } from '@wix/ecom';
import { auth } from '@wix/essentials';
import { logger } from '../logger';
import { type OrderLineItem, type OrderEditorSettings } from '../../types/schemas';

const getOrder = auth.elevate(orders.getOrder);

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
    providedCustomerToken?: string,
    siteId = 'default-site',
  ): Promise<OrderDraftabilityResult> {
    logger.info('Evaluating order draftability and eligibility', { orderId });

    // Use demo data only for the explicitly seeded preview site. Real site
    // orders must come from Wix so we never email a synthetic customer address.
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

    let order: any;
    if (siteId === 'default-site') {
      order = mockOrderDatabase[orderId] || {
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
    } else {
      try {
        order = await getOrder(orderId);
      } catch (error: any) {
        logger.warn('Could not retrieve Wix order; skipping session initialization', {
          orderId,
          siteId,
          error: error?.message,
        });
        return {
          draftable: false,
          reason: 'The order could not be retrieved from Wix. Please try again later.',
        };
      }
    }

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

    const lineItems: OrderLineItem[] = (order.lineItems || []).map((item: any, index: number) => ({
      id: item._id || item.id || `${orderId}-line-${index}`,
      name: item.productName?.original || 'Item',
      quantity: item.quantity,
      price: parseFloat(item.price?.amount || '0'),
      currency: order.currency || 'USD',
      productId: item.catalogReference?.catalogItemId || item.productId,
      image: typeof item.image === 'string' ? item.image : item.image?.url,
      isOriginal: true,
    }));

    const orderDigits = String(order.number ?? '').replace(/\D/g, '');
    const orderNumber = orderDigits && Number(orderDigits) > 0
      ? `#${orderDigits}`
      : `#${orderId.replace(/\D/g, '').slice(-4) || '1001'}`;
    const createdDate = order._createdDate || order.createdDate;
    const createdAt = createdDate ? new Date(createdDate).toISOString() : new Date().toISOString();
    const total = order.priceSummary?.total?.amount ?? order.totals?.total;

    return {
      draftable: true,
      orderNumber,
      orderCreatedAt: createdAt,
      lineItems,
      orderTotal: Number(total) || 0,
      currency: order.currency || 'USD',
      customerEmail: order.buyerInfo?.email,
    };
  }
}

export const orderService = new OrderService();
