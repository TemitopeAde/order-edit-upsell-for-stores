import { logger } from '../logger';
import { WixDataRepository } from '../db/wixDataRepository';

export class AriaService {
  /**
   * Dispatches and handles App Tools invoked by Wix Aria
   */
  async executeTool(siteId: string, toolName: string, inputs: Record<string, any>): Promise<any> {
    logger.info('Wix Aria invoking App Tool', { toolName, siteId });
    const repo = new WixDataRepository(siteId);

    switch (toolName) {
      case 'get_order_editor_summary': {
        const sessions = await repo.listSessions();
        const adjustments = await repo.listPaymentAdjustments();

        const totalEdited = sessions.filter((s) => s.status === 'COMMITTED' || s.status === 'COMPLETED').length;
        const pendingPayments = adjustments.filter((a) => a.status === 'UNPAID');
        const paidPayments = adjustments.filter((a) => a.status === 'PAID');

        const additionalRevenueCollected = paidPayments.reduce((sum, a) => sum + a.amount, 0);
        const additionalRevenuePending = pendingPayments.reduce((sum, a) => sum + a.amount, 0);

        await repo.recordAudit({
          orderId: 'all',
          actorType: 'ARIA',
          action: 'ARIA_SUMMARY_REQUESTED',
          status: 'SUCCESS',
          metadata: { totalEdited, additionalRevenueCollected },
        });

        return {
          totalEditedOrders: totalEdited,
          activeEditingSessions: sessions.filter((s) => s.status === 'ACTIVE' || s.status === 'ITEMS_ADDED').length,
          pendingPaymentRequestsCount: pendingPayments.length,
          pendingPaymentAmount: Math.round(additionalRevenuePending * 100) / 100,
          collectedAdditionalRevenue: Math.round(additionalRevenueCollected * 100) / 100,
          currency: 'USD',
        };
      }

      case 'list_pending_order_payments': {
        const adjustments = await repo.listPaymentAdjustments({ status: 'UNPAID' });
        return {
          pendingCount: adjustments.length,
          payments: adjustments.map((a) => ({
            orderId: a.orderId,
            orderNumber: a.orderNumber,
            amount: a.amount,
            currency: a.currency,
            createdAt: a.createdAt,
            paymentRequestId: a.paymentRequestId,
          })),
        };
      }

      case 'get_order_edit_history': {
        const orderId = inputs.orderId;
        if (!orderId) {
          throw new Error('orderId is required');
        }
        const session = await repo.getActiveSessionForOrder(orderId);
        const auditLogs = await repo.listAuditLogs({ orderId });
        return {
          orderId,
          orderNumber: session?.orderNumber,
          status: session?.status || 'NO_SESSION',
          originalLineItems: session?.originalLineItemsSnapshot || [],
          addedLineItems: session?.addedLineItems || [],
          originalOrderTotal: session?.originalOrderTotal,
          updatedOrderTotal: session?.updatedOrderTotal,
          additionalAmountDue: session?.additionalAmountDue,
          auditHistory: auditLogs.map((log) => ({
            actor: log.actorType,
            action: log.action,
            timestamp: log.createdAt,
            status: log.status,
          })),
        };
      }

      case 'get_order_editing_settings': {
        const settings = await repo.getSettings();
        return {
          enabled: settings.enabled,
          editingWindowMinutes: settings.editingWindowMinutes,
          maxDistinctAddedProducts: settings.maxDistinctAddedProducts,
          maxAddedQuantity: settings.maxAddedQuantity,
          paymentFeatureEnabled: settings.paymentFeatureEnabled,
        };
      }

      case 'update_order_editing_window': {
        const duration = Number(inputs.durationMinutes);
        if (isNaN(duration) || duration < 1 || duration > 1440) {
          throw new Error('durationMinutes must be a number between 1 and 1440');
        }
        const updated = await repo.updateSettings({ editingWindowMinutes: duration });
        await repo.recordAudit({
          orderId: 'system',
          actorType: 'ARIA',
          action: 'SETTINGS_WINDOW_UPDATED',
          status: 'SUCCESS',
          metadata: { newWindowMinutes: duration },
        });
        return {
          success: true,
          message: `Order editing window successfully set to ${duration} minutes`,
          currentWindowMinutes: updated.editingWindowMinutes,
        };
      }

      case 'set_order_editing_enabled': {
        const enabled = Boolean(inputs.enabled);
        const updated = await repo.updateSettings({ enabled });
        await repo.recordAudit({
          orderId: 'system',
          actorType: 'ARIA',
          action: 'SETTINGS_ENABLED_TOGGLED',
          status: 'SUCCESS',
          metadata: { enabled },
        });
        return {
          success: true,
          enabled: updated.enabled,
          message: `Order editing has been ${enabled ? 'enabled' : 'disabled'}`,
        };
      }

      default:
        throw new Error(`Unknown Aria tool: ${toolName}`);
    }
  }
}

export const ariaService = new AriaService();
