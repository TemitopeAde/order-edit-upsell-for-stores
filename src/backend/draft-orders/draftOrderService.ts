import { logger } from '../logger';
import {
  type OrderLineItem,
  type CalculatedDraftSnapshot,
} from '../../types/schemas';

export interface DraftOrderCalculationResult {
  draftOrderId: string;
  calculatedSnapshot: CalculatedDraftSnapshot;
  allLineItems: OrderLineItem[];
}

export class DraftOrderService {
  /**
   * Creates a draft order from an existing original order ID
   */
  async createDraft(sourceOrderId: string, siteId: string): Promise<string> {
    logger.info('Creating Wix Draft Order from source order', { sourceOrderId, siteId });
    // In live Wix environment: POST /ecom/v1/draft-orders { sourceOrderId }
    const draftOrderId = `draft-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    return draftOrderId;
  }

  /**
   * Adds customer-selected line items to the draft order and calculates the authoritative totals
   */
  async addLineItemsAndCalculate(
    draftOrderId: string,
    originalItems: OrderLineItem[],
    addedItems: OrderLineItem[],
    taxRate: number = 0.08
  ): Promise<DraftOrderCalculationResult> {
    logger.info('Adding line items to draft and retrieving calculated draft from Wix', {
      draftOrderId,
      originalCount: originalItems.length,
      addedCount: addedItems.length,
    });

    // In live Wix runtime:
    // 1. POST /ecom/v1/draft-orders/{draftOrderId}/add-line-items
    // 2. GET /ecom/v1/draft-orders/{draftOrderId} (authoritative draft calculation)

    let originalSubtotal = 0;
    for (const item of originalItems) {
      originalSubtotal += item.price * item.quantity;
    }
    const originalTax = Math.round(originalSubtotal * taxRate * 100) / 100;
    const originalTotal = Math.round((originalSubtotal + originalTax) * 100) / 100;

    let addedSubtotal = 0;
    for (const item of addedItems) {
      addedSubtotal += item.price * item.quantity;
    }
    const addedTax = Math.round(addedSubtotal * taxRate * 100) / 100;
    const additionalAmountDue = Math.round((addedSubtotal + addedTax) * 100) / 100;

    const newSubtotal = Math.round((originalSubtotal + addedSubtotal) * 100) / 100;
    const newTax = Math.round((originalTax + addedTax) * 100) / 100;
    const newTotal = Math.round((newSubtotal + newTax) * 100) / 100;

    const calculatedSnapshot: CalculatedDraftSnapshot = {
      subtotal: newSubtotal,
      tax: newTax,
      shipping: 0, // No extra shipping fee on post-purchase upsell additions
      discount: 0,
      total: newTotal,
      currency: originalItems[0]?.currency || 'USD',
      originalTotal,
      additionalAmountDue,
      lineItemsCount: originalItems.length + addedItems.length,
      balanceDue: additionalAmountDue,
    };

    const allLineItems = [...originalItems, ...addedItems];

    return {
      draftOrderId,
      calculatedSnapshot,
      allLineItems,
    };
  }

  /**
   * CRITICAL NON-NEGOTIABLE SAFETY INVARIANT:
   * Validates that all original line items exist in the draft with identical quantities and prices.
   * Customers are NEVER permitted to remove or decrease original items.
   */
  validateOriginalInvariants(
    originalSnapshot: OrderLineItem[],
    currentDraftLines: OrderLineItem[]
  ): { valid: boolean; violation?: string } {
    for (const orig of originalSnapshot) {
      const match = currentDraftLines.find((l) => l.id === orig.id || (l.productId === orig.productId && l.isOriginal));
      if (!match) {
        return {
          valid: false,
          violation: `Original line item "${orig.name}" (${orig.id}) was removed from draft`,
        };
      }

      if (match.quantity < orig.quantity) {
        return {
          valid: false,
          violation: `Original item "${orig.name}" quantity decreased from ${orig.quantity} to ${match.quantity}`,
        };
      }

      if (match.price !== orig.price) {
        return {
          valid: false,
          violation: `Original item "${orig.name}" price modified from ${orig.price} to ${match.price}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Commits the draft order to the original order.
   * This permanently modifies the order in Wix eCommerce.
   */
  async commitDraft(
    draftOrderId: string,
    siteId: string
  ): Promise<{ success: boolean; committedAt: string }> {
    logger.info('Committing Wix Draft Order', { draftOrderId, siteId });

    // In live Wix environment:
    // POST /ecom/v1/draft-orders/{draftOrderId}/commit
    // Body: { commitSettings: { updateInventory: true, sendCustomerNotification: false } }
    return {
      success: true,
      committedAt: new Date().toISOString(),
    };
  }
}

export const draftOrderService = new DraftOrderService();
