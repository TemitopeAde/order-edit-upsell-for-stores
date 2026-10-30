import { z } from 'zod';

export const ProductEligibilityModeSchema = z.enum(['ALL', 'SELECTED']);
export type ProductEligibilityMode = z.infer<typeof ProductEligibilityModeSchema>;

export const OrderEditorAppearanceSchema = z.object({
  widgetTitle: z.string().default('Forgot Something? Add to Your Order'),
  widgetDescription: z.string().default('You can add products to this order for the next few minutes. No extra shipping fees!'),
  addButtonLabel: z.string().default('Add to Order'),
  checkoutButtonLabel: z.string().default('Confirm & Pay Additional Amount'),
  primaryColor: z.string().default('#0f172a'),
  accentColor: z.string().default('#3b82f6'),
  borderRadius: z.string().default('12px'),
  fontFamily: z.string().default('Inter, system-ui, sans-serif'),
  bannerMessage: z.string().default('Limited time post-purchase editing window'),
});
export type OrderEditorAppearance = z.infer<typeof OrderEditorAppearanceSchema>;

export const OrderEditorSettingsSchema = z.object({
  _id: z.string().optional(),
  siteId: z.string().default('default-site'),
  enabled: z.boolean().default(true),
  editingWindowMinutes: z.number().min(1).max(1440).default(30),
  allowMultipleEdits: z.boolean().default(true),
  productEligibilityMode: z.string().optional().default('ALL'),
  includedProductIds: z.array(z.string()).optional().default([]),
  excludedProductIds: z.array(z.string()).optional().default([]),
  maxDistinctAddedProducts: z.number().min(1).max(20).default(5),
  maxAddedQuantity: z.number().min(1).max(100).default(10),
  maxAdditionalValue: z.number().nullable().default(null),
  minAdditionalValue: z.number().nullable().default(null),
  blockFulfilledOrders: z.boolean().default(true),
  blockCanceledOrders: z.boolean().default(true),
  blockRefundedOrders: z.boolean().default(true),
  blockSubscriptionOrders: z.boolean().default(true),
  appearance: OrderEditorAppearanceSchema.default({
    widgetTitle: 'Forgot Something? Add to Your Order',
    widgetDescription: 'You can add products to this order for the next few minutes. No extra shipping fees!',
    addButtonLabel: 'Add to Order',
    checkoutButtonLabel: 'Confirm & Pay Additional Amount',
    primaryColor: '#0f172a',
    accentColor: '#3b82f6',
    borderRadius: '12px',
    fontFamily: 'Inter, system-ui, sans-serif',
    bannerMessage: 'Limited time post-purchase editing window',
  }),
  paymentFeatureEnabled: z.boolean().default(true),
  pendingPaymentReminderMinutes: z.number().min(5).max(1440).default(60),
  sendCustomerEmailOnOrder: z.boolean().default(true),
  emailSubjectTemplate: z.string().default('You can still edit your order #{orderNumber}!'),
  customEmailNotice: z.string().default('Forgot something? Add items before your order ships with no additional shipping fee.'),
  emailSenderName: z.string().default('Order Support'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type OrderEditorSettings = z.infer<typeof OrderEditorSettingsSchema>;

export const OrderLineItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number().min(1),
  price: z.number(),
  currency: z.string().default('USD'),
  productId: z.string(),
  variantId: z.string().optional(),
  options: z.record(z.string(), z.string()).optional(),
  image: z.string().optional(),
  isOriginal: z.boolean().default(true),
});
export type OrderLineItem = z.infer<typeof OrderLineItemSchema>;

export const CalculatedDraftSnapshotSchema = z.object({
  subtotal: z.number(),
  tax: z.number().default(0),
  shipping: z.number().default(0),
  discount: z.number().default(0),
  total: z.number(),
  currency: z.string().default('USD'),
  originalTotal: z.number(),
  additionalAmountDue: z.number(),
  lineItemsCount: z.number(),
  balanceDue: z.number().default(0),
});
export type CalculatedDraftSnapshot = z.infer<typeof CalculatedDraftSnapshotSchema>;

export const OrderEditSessionStatusSchema = z.enum([
  'ACTIVE',
  'ITEMS_ADDED',
  'PAYMENT_PENDING',
  'COMMITTED',
  'EXPIRED',
  'CANCELLED',
  'COMPLETED',
]);
export type OrderEditSessionStatus = z.infer<typeof OrderEditSessionStatusSchema>;

export const OrderEditSessionSchema = z.object({
  _id: z.string(),
  siteId: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  customerReference: z.string().optional(),
  customerEmail: z.string().optional(),
  originalOrderCreatedAt: z.string(),
  editingDeadline: z.string(),
  status: OrderEditSessionStatusSchema.default('ACTIVE'),
  draftOrderId: z.string().nullable().default(null),
  originalLineItemsSnapshot: z.array(OrderLineItemSchema).default([]),
  addedLineItems: z.array(OrderLineItemSchema).default([]),
  calculatedDraftSnapshot: CalculatedDraftSnapshotSchema.nullable().default(null),
  originalOrderTotal: z.number().default(0),
  updatedOrderTotal: z.number().default(0),
  currency: z.string().default('USD'),
  additionalAmountDue: z.number().default(0),
  paymentAdjustmentId: z.string().nullable().default(null),
  sessionToken: z.string().optional(),
  emailNotificationSentAt: z.string().nullable().optional(),
  emailTransmissionId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  committedAt: z.string().nullable().default(null),
});
export type OrderEditSession = z.infer<typeof OrderEditSessionSchema>;

export const PaymentAdjustmentStatusSchema = z.enum([
  'CREATING',
  'UNPAID',
  'PAID',
  'EXPIRED',
  'VOIDED',
  'FAILED',
  'RECONCILIATION_REQUIRED',
  'NO_PAYMENT_REQUIRED',
]);
export type PaymentAdjustmentStatus = z.infer<typeof PaymentAdjustmentStatusSchema>;

export const OrderPaymentAdjustmentSchema = z.object({
  _id: z.string(),
  siteId: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  editSessionId: z.string(),
  paymentRequestId: z.string(),
  externalId: z.string(),
  amount: z.number(),
  currency: z.string().default('USD'),
  status: PaymentAdjustmentStatusSchema.default('UNPAID'),
  paymentPageUrl: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  paidAt: z.string().nullable().default(null),
  expiresAt: z.string().nullable().default(null),
  lastVerifiedAt: z.string().nullable().default(null),
  notes: z.string().optional(),
});
export type OrderPaymentAdjustment = z.infer<typeof OrderPaymentAdjustmentSchema>;

export const ActorTypeSchema = z.enum(['CUSTOMER', 'MERCHANT', 'SYSTEM', 'ARIA']);
export type ActorType = z.infer<typeof ActorTypeSchema>;

export const OrderEditAuditLogSchema = z.object({
  _id: z.string(),
  siteId: z.string(),
  orderId: z.string(),
  orderNumber: z.string().optional(),
  editSessionId: z.string().optional(),
  actorType: ActorTypeSchema,
  action: z.string(),
  status: z.enum(['SUCCESS', 'FAILURE', 'INFO']),
  requestId: z.string().optional(),
  metadata: z.record(z.string(), z.any()).default({}),
  createdAt: z.string(),
});
export type OrderEditAuditLog = z.infer<typeof OrderEditAuditLogSchema>;

export const CatalogProductVariantSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: z.number(),
  sku: z.string().optional(),
  inStock: z.boolean().default(true),
  choices: z.record(z.string(), z.string()).optional(),
});
export type CatalogProductVariant = z.infer<typeof CatalogProductVariantSchema>;

export const CatalogProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  price: z.number(),
  formattedPrice: z.string().optional(),
  currency: z.string().default('USD'),
  mainMedia: z.string().optional(),
  mediaItems: z.array(z.string()).default([]),
  inStock: z.boolean().default(true),
  manageVariants: z.boolean().default(false),
  variants: z.array(CatalogProductVariantSchema).default([]),
  options: z.array(z.object({
    name: z.string(),
    choices: z.array(z.string()),
  })).default([]),
});
export type CatalogProduct = z.infer<typeof CatalogProductSchema>;
