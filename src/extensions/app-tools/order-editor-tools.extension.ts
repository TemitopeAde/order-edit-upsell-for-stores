import { extensions } from '@wix/astro/builders';

export default extensions.appTools({
  id: '6f19e160-9ac3-409d-af0c-ec5b959da324',
  name: 'Wix Order Editor Aria Tools',
  tools: [
    {
      methodName: 'get_order_editor_summary',
      displayName: 'Get Order Editor Summary',
      description: 'Returns order editing and additional payment metrics for a specified period',
      activated: true,
      requestSchema: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date ISO string' },
          endDate: { type: 'string', description: 'End date ISO string' },
        },
      },
      responseSchema: {
        type: 'object',
        properties: {
          totalEditedOrders: { type: 'number' },
          pendingPaymentRequestsCount: { type: 'number' },
          pendingPaymentAmount: { type: 'number' },
          collectedAdditionalRevenue: { type: 'number' },
          currency: { type: 'string' },
        },
      },
    },
    {
      methodName: 'list_pending_order_payments',
      displayName: 'List Pending Order Payments',
      description: 'Lists orders with unpaid additional payment requests awaiting customer completion',
      activated: true,
      requestSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Maximum records to return' },
        },
      },
      responseSchema: {
        type: 'object',
        properties: {
          pendingCount: { type: 'number' },
          payments: { type: 'array' },
        },
      },
    },
    {
      methodName: 'get_order_edit_history',
      displayName: 'Get Order Edit History',
      description: 'Retrieves complete post-purchase edit and payment audit history for an order',
      activated: true,
      requestSchema: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'The Wix order ID' },
        },
        required: ['orderId'],
      },
      responseSchema: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
          orderNumber: { type: 'string' },
          status: { type: 'string' },
          originalOrderTotal: { type: 'number' },
          updatedOrderTotal: { type: 'number' },
          additionalAmountDue: { type: 'number' },
          auditHistory: { type: 'array' },
        },
      },
    },
    {
      methodName: 'get_order_editing_settings',
      displayName: 'Get Order Editing Settings',
      description: 'Returns current merchant editing window and addition settings',
      activated: true,
      requestSchema: {
        type: 'object',
        properties: {},
      },
      responseSchema: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          editingWindowMinutes: { type: 'number' },
          maxDistinctAddedProducts: { type: 'number' },
          maxAddedQuantity: { type: 'number' },
          paymentFeatureEnabled: { type: 'boolean' },
        },
      },
    },
    {
      methodName: 'update_order_editing_window',
      displayName: 'Update Order Editing Window',
      description: 'Updates the merchant post-checkout editing window duration in minutes',
      activated: true,
      requestSchema: {
        type: 'object',
        properties: {
          durationMinutes: { type: 'number', description: 'Duration in minutes (e.g. 15, 30, 60)' },
        },
        required: ['durationMinutes'],
      },
      responseSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          currentWindowMinutes: { type: 'number' },
        },
      },
    },
    {
      methodName: 'set_order_editing_enabled',
      displayName: 'Set Order Editing Enabled',
      description: 'Enables or disables post-purchase order editing for the store',
      activated: true,
      requestSchema: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', description: 'True to enable, false to disable' },
        },
        required: ['enabled'],
      },
      responseSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          enabled: { type: 'boolean' },
          message: { type: 'string' },
        },
      },
    },
  ],
});
