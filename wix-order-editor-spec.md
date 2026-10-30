# Wix Order Editor --- Product & Technical Specification

**Document status:** Implementation specification\
**Product type:** Wix app for Wix eCommerce / Wix Stores\
**Primary surface:** Wix eCommerce Thank You page Site Plugin\
**Development approach:** Wix CLI, Astro, React, Wix APIs\
**Last documentation review:** 30 October 2026

------------------------------------------------------------------------

## 1. Product overview

Wix Order Editor lets a customer add eligible products to an order
immediately after checkout, directly from the Wix eCommerce Thank You
page.

The merchant configures an editing window. Customers can add products
only while that window is open. They cannot remove original order items,
reduce original quantities, change original product prices, or edit
existing line items.

When a customer adds products, the app uses Wix Draft Orders to
calculate and commit the additional line items to the original order. It
then uses the Wix Order Payment Requests API to request the additional
amount from the customer through a Wix-hosted payment page.

The app must distinguish clearly between:

-   **Order updated:** the additional line items have been committed to
    the order.
-   **Additional payment pending:** the customer still owes the
    additional amount.
-   **Additional payment paid:** Wix has confirmed the payment request
    is paid.

Committing a draft does not itself collect payment. The app must never
report the additional amount as paid until Wix confirms it.

### Product goals

1.  Give customers a short post-purchase opportunity to add forgotten
    products.
2.  Prevent customers from reducing or removing anything from the
    original order.
3.  Let merchants control the editing window and eligible products.
4.  Use Wix's own order, draft-order, and payment-request
    infrastructure.
5.  Prevent duplicate additions, duplicate payment requests,
    unauthorized order access, and inconsistent payment states.
6.  Provide merchants with a clear audit trail and visibility into
    pending additional payments.
7.  Expose useful merchant actions and reports to Wix Aria through App
    Tools.

### Out of scope for the initial release

-   Removing original products.
-   Decreasing quantities on original line items.
-   Editing original product prices or discounts.
-   Changing existing product variants.
-   Editing shipping address, billing address, or customer contact
    details.
-   Issuing refunds.
-   Creating a separate replacement order.
-   Automatically fulfilling newly added items before the additional
    payment is confirmed.
-   Editing subscription orders or other orders Wix reports as
    non-draftable.

------------------------------------------------------------------------

## 2. User roles

### Merchant / site owner

Can configure the app, define the editing window, choose eligible
products, inspect editing sessions, monitor additional payments, and
review the edit history.

### Customer

Can access the editor for their own eligible order from the Thank You
page, add eligible products, review the updated total, and pay the
additional balance.

### App backend

Validates access, deadlines, order eligibility, product availability,
pricing, draft-order state, payment-request state, webhooks, and audit
history. All privileged Wix API calls run server-side.

### Wix Aria

Can use the app's App Tools to retrieve merchant reports and perform
explicitly authorized merchant actions, such as changing the editing
window. Aria is not involved in the customer checkout or payment
authorization flow.

------------------------------------------------------------------------

## 3. Customer experience

### 3.1 Thank You page placement

Build the customer editor as a Wix **eCommerce Thank You page Site
Plugin**, not as a generic embedded script or standalone site widget.

The plugin must:

-   Declare the supported Thank You page placement slot ID(s) using the
    current `placementsSlotIds` configuration.
-   Use the current order context supplied by the host slot.
-   Render a useful static/placeholder preview inside the Wix Editor,
    where plugin code is sandboxed and Wix API calls are unavailable.
-   Load the real order state only in preview/published runtime.
-   Support automatic placement on installation where supported, while
    showing placement status and manual placement instructions in the
    dashboard if automatic placement fails.
-   Avoid assuming that every store has the same Thank You page layout
    or slot context.

Before implementation, inspect the current Thank You page slot
documentation and its exact context schema. Do not guess the slot ID or
context property names.

Official docs: -
https://dev.wix.com/docs/overview/extensions-framework/site-extensions/site-plugins -
https://dev.wix.com/docs/build-apps/develop-your-app/extensions/site-extensions/site-plugins/supported-wix-app-pages/about-slots

### 3.2 Initial customer state

When the Thank You page loads:

1.  Read the order context from the plugin host.
2.  Call the app backend with the order context.
3.  Verify the order and customer access server-side.
4.  Check the merchant's editing settings.
5.  Check the order's draftability and payment/fulfillment state.
6.  Check the editing deadline.
7.  Return only the order and catalog information the customer needs.

Display one of the following states:

-   **Editing available:** show the Add products button and remaining
    time.
-   **Payment required:** show the existing pending payment request and
    a Continue to payment action. Do not allow another edit session
    until the pending balance is resolved or safely reconciled.
-   **Editing expired:** show that the editing window has closed.
-   **Order not eligible:** explain the reason in customer-friendly
    language.
-   **Order unavailable:** show a generic error without exposing private
    order details.

### 3.3 Customer editing permissions

  -----------------------------------------------------------------------
  Operation                           Customer permission
  ----------------------------------- -----------------------------------
  Browse eligible catalog products    Allowed

  Add a new product to the order      Allowed

  Add multiple units of a newly       Allowed, subject to merchant
  selected product                    quantity limits

  Add a product already present in    Allowed only as a new addition; do
  the original order                  not mutate the original line item

  Remove an original order item       Never allowed

  Remove an original order quantity   Never allowed

  Decrease an original order quantity Never allowed

  Change an original product variant  Never allowed

  Change an original product price    Never allowed

  Change an original discount         Never allowed

  Change shipping/billing details     Not in initial release

  Change customer contact details     Not in initial release
  -----------------------------------------------------------------------

**Important implementation rule:** Do not call Draft Orders Update Line
Items for original line items. The customer flow should use Add Line
Items To Draft Order only. The backend must compare the final draft with
the original order and reject any draft that removes, decreases, or
changes an original line item.

### 3.4 Product selection

The customer product picker should show:

-   Product image.
-   Product name.
-   Short description, where available.
-   Current catalog price.
-   Available options/variants, where supported.
-   Availability/stock state where reliably available.
-   Quantity selector for the new addition.
-   Add button.

Product selection must use Wix catalog data and current Wix-calculated
draft totals. Do not trust a client-supplied price, product title, tax
amount, or total.

Merchant controls should include:

-   All eligible products or selected products only.
-   Excluded products.
-   Maximum number of distinct added products.
-   Maximum total quantity that can be added.
-   Optional maximum additional order value.
-   Optional minimum additional order value.

The backend must revalidate product availability, variant selection, and
quantity immediately before adding line items to the draft. Wix's
calculated draft is the source of truth for final pricing, tax,
shipping, and totals.

### 3.5 Review and confirmation

Before committing, show:

-   Original order items, clearly marked **Already purchased** and
    read-only.
-   Newly added items, clearly marked **Added to this order**.
-   Quantity and unit price of newly added items.
-   Updated subtotal, tax, shipping, discounts, and order total returned
    by Wix.
-   Amount already paid / balance due returned by Wix, where available.
-   Additional amount to pay.
-   A clear confirmation action.

Do not label a draft total as the final paid total. Explain that the
order will be updated and the additional amount must be paid separately.

### 3.6 After confirmation

After successful commit:

-   Display that the order has been updated.
-   If the additional balance is greater than zero, show **Additional
    payment required** and redirect or open the Wix payment page URL
    returned by the Order Payment Requests API.
-   If Wix reports no additional balance, show the updated order
    confirmation without creating a zero-value payment request.
-   If payment is pending, show a safe return link and allow the
    customer to retrieve the existing payment request URL.
-   Do not mark added products as paid or eligible for fulfillment until
    payment is confirmed.

------------------------------------------------------------------------

## 4. Editing window and eligibility

### 4.1 Merchant editing-window settings

Default configuration:

  -----------------------------------------------------------------------
  Setting                             Default
  ----------------------------------- -----------------------------------
  Order editing                       Enabled

  Editing window                      30 minutes

  Start point                         Original order creation time

  Allow multiple successful edit      Yes, only after prior payment is
  sessions                            resolved

  Customer can add products           Yes

  Customer can remove original items  No

  Customer can decrease original      No
  quantities                          

  Block fulfilled orders              Yes

  Block canceled orders               Yes

  Block refunded / partially refunded Yes
  orders                              

  Block orders with subscription      Yes
  items                               
  -----------------------------------------------------------------------

Supported presets: 10 minutes, 15 minutes, 30 minutes, 45 minutes, 1
hour, 2 hours, 4 hours, and custom duration. Enforce sensible minimum
and maximum values.

### 4.2 Deadline calculation

Calculate the deadline using the original order's server-provided
creation timestamp:

`editingDeadline = order.createdDate + configuredEditingWindow`

Persist the computed deadline for audit and consistency, but re-check
the authoritative order creation timestamp and current merchant
configuration on the backend.

Use UTC timestamps for storage and comparisons. Format the deadline in
the customer's local display locale/time zone. Do not trust the browser
clock.

The deadline is enforced server-side for every operation:

-   Starting an editing session.
-   Creating or retrieving an editable draft for the customer.
-   Adding products.
-   Confirming/committing the draft.

A customer cannot extend the deadline by refreshing the page, changing
browser time, replaying a request, or reusing an old session.

### 4.3 Order eligibility

Before creating a draft, call Wix **Get Order Draftability Status** and
inspect `orderDraftable` and `nonDraftableReasons`.

Also validate the latest order state. The app must handle Wix
limitations, including:

-   Orders with subscription items are not editable through Draft
    Orders.
-   Orders with `CANCELED`, `FULLY_REFUNDED`, or `PARTIALLY_REFUNDED`
    payment status cannot be used to create a draft.
-   Gift card products cannot be edited through Draft Orders.
-   Fulfilled line items cannot be edited.
-   Membership-priced line items have price-update restrictions.
-   A draft must contain at least one line item.
-   A draft can contain up to 300 catalog and custom line items
    combined.
-   Currency and weight measurement units must match the site's business
    settings.
-   An order can have only one active draft at a time.
-   A draft created for an existing order expires 24 hours after its
    last update.
-   Only the identity that created a draft can modify, commit, or delete
    it.

For this app, the customer must not be able to modify original lines
regardless of whether Wix technically permits an operation.

Official docs: -
https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/draft-orders/sample-flows -
https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/draft-orders/update-line-items -
https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/draft-orders/introduction

------------------------------------------------------------------------

## 5. Order editing and price calculation

### 5.1 Wix Draft Orders API

Use the Draft Orders API to update the existing order.

High-level flow:

1.  Retrieve the order from Wix.
2.  Check draftability.
3.  Create a draft using `sourceOrderId`.
4.  Persist the returned draft ID and session association.
5.  Add customer-selected catalog line items using **Add Line Items To
    Draft Order**.
6.  Retrieve the calculated draft.
7.  Validate that original order lines remain unchanged.
8.  Validate that only permitted additions were made.
9.  Review calculation errors and totals.
10. Commit the draft to update the original order.

Relevant REST endpoints:

-   Create draft: `POST /ecom/v1/draft-orders`
-   Add line items:
    `POST /ecom/v1/draft-orders/{draftOrderId}/add-line-items`
-   Get draft: use the current Get Draft Order endpoint documented by
    Wix.
-   Commit draft: `POST /ecom/v1/draft-orders/{draftOrderId}/commit`

Use the current Wix REST schemas or generated SDK types. Do not invent
request properties or hardcode incomplete example payloads.

### 5.2 Preserve original order lines

Before editing, save a normalized snapshot of the original line items:

-   Line item ID.
-   Catalog reference.
-   Product/variant identifiers.
-   Quantity.
-   Price and currency.
-   Relevant option/variant data.

After Wix calculates the draft and before commit, compare original lines
against the draft.

The validation must prove:

-   Every original line still exists.
-   Every original line's quantity is unchanged.
-   Every original line's product/variant reference is unchanged.
-   Every original line's price is unchanged, subject to Wix's
    representation of the same original value.
-   All new lines correspond to products selected by the customer.
-   No unexpected line items, discounts, fees, or other changes were
    introduced.

If the comparison fails, do not commit. Log the conflict and
discard/delete the app-owned draft where safe.

Do not rely only on hiding remove/decrease controls in the frontend. The
backend must enforce this invariant.

### 5.3 Price calculation

Do not calculate tax, discounts, shipping, or final order totals
independently.

Use the calculated draft response from Wix as the authoritative source
for:

-   Line item prices.
-   Subtotal.
-   Discounts.
-   Tax.
-   Shipping.
-   Fees.
-   Order total.
-   Balance summary.

Do not assume `newOrderTotal - originalOrderTotal` is always the exact
amount to collect. Retrieve the updated order after commit and use the
current order balance/payment information and the Order Payment Requests
API rules to determine the collectible amount.

Never trust a price, total, currency, or balance supplied by the
browser.

### 5.4 Commit behavior and inventory

Committing a draft is permanent and cannot be undone. A committed draft
cannot be modified again.

Wix documentation notes that inventory levels change only for line items
passed in `commitSettings.updateInventory`. Inspect the current commit
schema and explicitly decide how newly added catalog items should affect
inventory. Test this behavior with Wix Stores before release. Do not
assume inventory is automatically deducted in every commit
configuration.

Also inspect and configure commit side effects, including
customer/merchant notifications, according to the current Wix API
schema. Avoid sending duplicate notifications if the app separately
sends its own confirmation.

Official docs: -
https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/draft-orders/introduction -
https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/draft-orders/sample-flows -
https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/draft-orders/draft-order-object

------------------------------------------------------------------------

## 6. Additional payment workflow

### 6.1 Recommended Wix API

Use the **Wix Order Payment Requests API** to collect the outstanding
balance on the existing order.

This API creates a payment request for an existing eCommerce order and
returns a Wix-hosted payment page URL. It supports payment-request
retrieval, URL retrieval, updates/deletion where permitted, voiding, and
lifecycle webhooks.

**Important release constraint:** Wix currently labels the Order Payment
Requests API Developer Preview. Its API contract may change. The API
requires the `Manage eCommerce - all permissions` scope. The merchant
site must have a Payment Request Page added and published, otherwise
request creation fails with `ORDER_PAYMENT_REQUEST_PAGE_NOT_FOUND`.

Treat this as a launch gate: - Validate availability for the app's
intended distribution and target sites. - Test payment methods, currency
behavior, payment status transitions, and webhook delivery. - Keep the
payment integration behind a feature flag until the API is verified in
the target environment. - If the API is unavailable or unsuitable for
production, do not silently substitute a custom card form. Provide a
merchant-managed fallback or defer the feature until an approved Wix
payment flow is available.

Official docs: -
https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/order-payment-requests/create-order-payment-request

### 6.2 Payment sequence

1.  Customer reviews the calculated draft.
2.  Backend commits the draft to the original order.
3.  Backend retrieves the updated order and its latest balance/payment
    data.
4.  Backend determines the outstanding amount using Wix's authoritative
    order/payment data.
5.  If the outstanding amount is zero, mark the adjustment as
    `NO_PAYMENT_REQUIRED`.
6.  If the outstanding amount is greater than zero, create an Order
    Payment Request for that amount.
7.  Save the payment request ID, amount, currency, status, and external
    ID.
8.  Return the Wix payment page URL to the customer.
9.  Customer completes payment on Wix's hosted page.
10. Backend receives the payment-request webhook, verifies the JWT,
    retrieves the request from Wix, and verifies that it is `PAID`.
11. Backend marks the adjustment as paid and sends confirmation.

### 6.3 Payment request rules

-   The payment request must reference the existing order ID.
-   Use a unique `source.externalId` for each adjustment/payment
    attempt.
-   Use the current Wix schema for the request object; do not copy
    illustrative payloads without checking the live schema.
-   The amount cannot be changed after the request is created.
-   Only `UNPAID` requests can be updated, and amount changes are not
    permitted.
-   If an unpaid request must be replaced, first void it if the API
    permits, verify its final state, then create a new request with a
    new external ID.
-   Never create multiple active requests for the same adjustment.
-   Never create a payment request for zero or negative amounts.
-   Never trust a browser redirect or query parameter as proof of
    payment.
-   Retrieve the payment request from Wix after receiving the webhook
    and verify its order, amount, currency, external ID, and `PAID`
    status.
-   Make webhook handling idempotent.

### 6.4 Important order/payment state behavior

The draft commit updates the order before the additional payment is
collected. This means the order may contain additional items while the
additional balance is still unpaid.

The app must therefore: - Show the adjustment as `PAYMENT_PENDING`. -
Avoid claiming the full updated order is paid. - Avoid treating the new
items as paid/ready for fulfillment. - Display a clear pending-payment
indicator in the merchant dashboard. - Prevent another customer edit
while the additional payment is unresolved. - Notify the merchant if
payment remains pending beyond a configurable threshold. - Provide a
reconciliation workflow for expired, voided, failed, or abandoned
payment requests.

Do not automatically roll back a committed draft. Wix documents commit
as irreversible. If a payment is not completed, the merchant must decide
how to handle the unpaid additional items using a supported
order-management workflow.

### 6.5 Payment decrease/refunds

Customer actions cannot reduce the original order, so the initial
customer flow must never create a refund.

If a merchant later changes an order manually or a reconciliation
creates a lower balance, do not issue an automatic refund in this app's
initial release. Record the discrepancy and direct the merchant to Wix's
supported refund workflow.

------------------------------------------------------------------------

## 7. Security and customer order access

The Thank You page is a public-facing surface and an order ID alone is
not proof that a visitor owns an order.

Required controls:

-   Use the order context supplied by the Thank You page host.
-   Validate the order and visitor/session context on the backend.
-   Use Wix-supported visitor/member identity and any trusted
    checkout/order context available to the plugin.
-   Never authorize access solely because the browser submitted a
    valid-looking order ID.
-   Never expose app secrets, Wix app tokens, or privileged API
    credentials in frontend code.
-   Keep all privileged order, draft, payment-request, and webhook
    operations on the backend.
-   Return only the minimum customer/order fields required by the UI.
-   Rate-limit order lookup, session creation, product additions, and
    payment URL retrieval.
-   Use opaque, short-lived editing-session tokens where appropriate;
    store only hashes where practical.
-   Bind every session to one site, order, customer/visitor context,
    deadline, and app installation.
-   Re-check authorization and deadline on every mutation.
-   Validate all IDs, quantities, product references, currency values,
    and request payloads with Zod.
-   Protect against CSRF and replay attacks using Wix-supported
    request/session protections.
-   Verify Wix webhook signatures/JWTs before processing events.
-   Do not log payment credentials or sensitive customer data.
-   Apply tenant isolation to every database query.

**Implementation blocker to resolve early:** Confirm the exact security
context exposed by the Thank You page plugin for both logged-in
customers and guest checkout customers. If the slot does not provide a
trustworthy guest-order authorization mechanism, design and validate a
secure alternative before enabling guest editing. Do not ship an
order-ID-only access flow.

------------------------------------------------------------------------

## 8. Merchant dashboard

Build a responsive dashboard using React and shadcn/ui.

### 8.1 Navigation

-   Overview
-   Settings
-   Eligible products
-   Edited orders
-   Payment adjustments
-   Activity log
-   Help / setup

### 8.2 Overview

Show summary cards:

-   Orders eligible for editing today.
-   Orders edited today.
-   Products added today.
-   Additional payments pending.
-   Additional payments collected.
-   Editing sessions expired.

Charts: - Added revenue over time. - Number of edited orders over
time. - Pending vs paid adjustments.

All analytics must be derived from the app's persisted records and
reconciled with Wix order/payment data where relevant.

### 8.3 Settings

**General** - Enable/disable order editing. - Editing window
preset/custom duration. - Allow multiple edit sessions after prior
adjustment is paid. - Customer-facing heading and description. -
Customer-facing button label.

**Product eligibility** - All products / selected products. - Excluded
products. - Maximum added product count. - Maximum added quantity. -
Maximum additional value. - Optional minimum additional value. - Product
availability behavior.

**Order eligibility** - Block fulfilled orders. - Block canceled
orders. - Block refunded and partially refunded orders. - Block
subscription orders. - Block orders containing unsupported products. -
Optional minimum/maximum original order value.

**Payment** - Enable Wix Order Payment Requests integration. - Payment
pending reminder threshold. - Payment request expiry policy, based on
the supported Wix API schema. - Merchant notification
recipients/settings. - Show clear setup warning if the Payment Request
Page is not published or the API is unavailable.

**Appearance** - Widget title and description. - Add products button
label. - Checkout/payment button label. - Colors, border, radius,
spacing. - Typography. - Empty, loading, error, expired, and success
messages.

### 8.4 Edited orders table

Columns: - Order number. - Customer. - Original order total. -
Additional items total. - Current order balance. - Editing deadline. -
Edit status. - Payment status. - Last updated.

Filters: - Date range. - Editing status. - Payment status. - Order
number. - Customer email.

Order detail view: - Original order snapshot. - Added line items. -
Draft ID and committed draft ID. - Payment request ID and URL status. -
Payment events. - Audit timeline. - Wix order link, where supported.

### 8.5 Placement status

Show whether the Thank You page plugin is placed. If not placed, show
setup instructions and an action to open the relevant Wix
Editor/placement workflow if a supported host action exists. Do not
claim automatic placement succeeded until confirmed.

------------------------------------------------------------------------

## 9. Wix Aria integration

Add Wix **App Tools** and the corresponding **Tools Provider service
plugin** so Wix Aria can discover and invoke merchant-facing app
functions.

This is a supported Wix extension model. It is separate from embedding a
chatbot or using an external AI model.

Suggested tools:

  -------------------------------------------------------------------------------
  Tool                            Description             Inputs
  ------------------------------- ----------------------- -----------------------
  `get_order_editor_summary`      Returns order editing   Date range
                                  and additional-payment  
                                  metrics for a period    

  `list_pending_order_payments`   Lists orders with       Optional date range,
                                  unpaid additional       limit
                                  payment requests        

  `get_order_edit_history`        Retrieves edit history  Order ID
                                  for a specific order    

  `get_order_editing_settings`    Returns current editing None
                                  configuration           

  `update_order_editing_window`   Updates the merchant's  Duration in minutes
                                  editing duration        

  `set_order_editing_enabled`     Enables or disables the Boolean
                                  feature                 
  -------------------------------------------------------------------------------

Aria tools must: - Operate only within the installed merchant site. -
Use the Wix-provided authenticated app/site context. - Validate every
request with Zod. - Require explicit confirmation for consequential
changes where appropriate. - Never expose customer payment data or
secrets. - Never mark payments as paid, create arbitrary charges, issue
refunds, or bypass customer editing rules. - Return concise structured
results and clear errors.

Do not claim Aria integration exists until both the App Tools
declaration and Tools Provider service plugin are implemented and
tested.

Official docs: -
https://dev.wix.com/docs/build-apps/develop-your-app/extensions/backend-extensions/app-tools/about-app-tools-extensions -
https://dev.wix.com/docs/overview/extensions-framework/backend-extensions/app-tools -
https://dev.wix.com/docs/overview/ai-the-wix-platform/about-aria

------------------------------------------------------------------------

## 10. Technical architecture

### 10.1 Stack

  -----------------------------------------------------------------------
  Layer                               Technology
  ----------------------------------- -----------------------------------
  App framework                       Astro + Wix CLI

  Dashboard                           React + shadcn/ui

  Icons                               lucide-react

  Notifications                       Sonner

  Validation                          Zod

  Customer surface                    Wix Thank You page Site Plugin

  Order editing                       Wix Draft Orders REST API /
                                      supported Wix SDK

  Payment collection                  Wix Order Payment Requests API,
                                      subject to preview validation

  Order data                          Wix Orders API

  Persistence                         Wix Data

  Backend endpoints                   Astro endpoints under `pages/api`

  Authenticated Wix requests          `fetchWithAuth`

  Aria integration                    App Tools + Tools Provider service
                                      plugin

  Logging                             Structured server-side logs with
                                      sensitive-data redaction
  -----------------------------------------------------------------------

Use the shadcn dashboard approach rather than Wix Design System for the
dashboard. Use lucide-react icons and Sonner toasts. Keep the UI
typography consistent with the app's chosen font and expose configurable
customer-widget typography.

### 10.2 Backend modules

Suggested module boundaries:

-   `orders/`: get order, draftability, order state, balance
    reconciliation.
-   `draft-orders/`: create draft, add catalog lines, get calculated
    draft, validate invariants, commit.
-   `payments/`: create/retrieve/void payment requests, payment
    reconciliation.
-   `sessions/`: customer editing sessions, deadlines, tokens,
    concurrency.
-   `catalog/`: eligible product listing, product validation,
    variant/option validation.
-   `settings/`: merchant settings and validation.
-   `webhooks/`: Wix order, draft-order, payment-request event handlers.
-   `audit/`: immutable event history.
-   `aria/`: App Tools declarations and tool handlers.
-   `notifications/`: customer and merchant notifications.

### 10.3 API route suggestions

Use Astro API routes under `pages/api`. Exact route names may be
adjusted to match the existing Wix CLI project.

Customer routes: - `GET /api/customer/order-editor/session` -
`GET /api/customer/order-editor/products` -
`POST /api/customer/order-editor/session` -
`POST /api/customer/order-editor/add-items` -
`POST /api/customer/order-editor/confirm` -
`GET /api/customer/order-editor/payment-status` -
`GET /api/customer/order-editor/payment-url`

Dashboard routes: - `GET /api/dashboard/settings` -
`PUT /api/dashboard/settings` - `GET /api/dashboard/orders` -
`GET /api/dashboard/orders/:orderId` - `GET /api/dashboard/analytics` -
`GET /api/dashboard/payment-adjustments` -
`POST /api/dashboard/payment-adjustments/:id/reconcile`

Webhook routes: - `POST /api/webhooks/wix/order-updated` -
`POST /api/webhooks/wix/draft-order-updated` -
`POST /api/webhooks/wix/order-payment-request-paid` -
`POST /api/webhooks/wix/order-payment-request-expired` -
`POST /api/webhooks/wix/order-payment-request-voided`

Register only the event subscriptions that Wix currently supports for
the app. Verify exact webhook event names and payload schemas from the
current Wix docs before implementation.

### 10.4 Wix authentication and permissions

Use Wix CLI app authentication and the supported authenticated request
helper (`fetchWithAuth`) for all communications:

-   **Frontend-to-Backend Astro Endpoints**: Extensions (Site Plugins,
    Dashboard Pages) must call backend Astro routes under `/api/*` using
    `httpClient.fetchWithAuth()` from `@wix/essentials` (with endpoint URLs
    resolved via `new URL(path, import.meta.url).href`) instead of plain
    `fetch`. This ensures caller authentication tokens and Wix context
    are attached, and prevents requests on storefront pages from erroneously
    resolving to the merchant site's domain.
-   **Server-to-Wix API**: Use `fetchWithAuth` / elevated SDK clients for
    server-side Wix platform API calls.

Request only the required scopes, but note that the Order Payment
Requests API currently requires the broad
`Manage eCommerce - all permissions` scope. Draft Orders requires
`Edit an order`.

Confirm all permission names and current app-review requirements in the
Wix app dashboard and current docs before submitting.

Never make privileged API calls from the browser.

------------------------------------------------------------------------

## 11. Wix Data collections

Create collections idempotently during app installation/initialization
where supported. Do not create duplicate schemas or seed records on
every app load.

### `OrderEditorSettings`

-   `_id`
-   `siteId`
-   `enabled`
-   `editingWindowMinutes`
-   `allowMultipleEdits`
-   `productEligibilityMode`
-   `includedProductIds`
-   `excludedProductIds`
-   `maxDistinctAddedProducts`
-   `maxAddedQuantity`
-   `maxAdditionalValue`
-   `minAdditionalValue`
-   `blockFulfilledOrders`
-   `blockCanceledOrders`
-   `blockRefundedOrders`
-   `blockSubscriptionOrders`
-   `appearance`
-   `paymentFeatureEnabled`
-   `pendingPaymentReminderMinutes`
-   `createdAt`
-   `updatedAt`

### `OrderEditSessions`

-   `_id`
-   `siteId`
-   `orderId`
-   `orderNumber`
-   `customerReference` (minimum necessary, privacy-aware)
-   `originalOrderCreatedAt`
-   `editingDeadline`
-   `status`
-   `draftOrderId`
-   `originalLineItemsSnapshot`
-   `addedLineItems`
-   `calculatedDraftSnapshot`
-   `originalOrderTotal`
-   `updatedOrderTotal`
-   `currency`
-   `additionalAmountDue`
-   `paymentAdjustmentId`
-   `createdAt`
-   `updatedAt`
-   `committedAt`

### `OrderPaymentAdjustments`

-   `_id`
-   `siteId`
-   `orderId`
-   `editSessionId`
-   `paymentRequestId`
-   `externalId`
-   `amount`
-   `currency`
-   `status` (`CREATING`, `UNPAID`, `PAID`, `EXPIRED`, `VOIDED`,
    `FAILED`, `RECONCILIATION_REQUIRED`)
-   `paymentPageUrl` (protect access; do not expose in merchant
    analytics)
-   `createdAt`
-   `updatedAt`
-   `paidAt`
-   `expiresAt`
-   `lastVerifiedAt`

### `OrderEditAuditLog`

-   `_id`
-   `siteId`
-   `orderId`
-   `editSessionId`
-   `actorType` (`CUSTOMER`, `MERCHANT`, `SYSTEM`, `ARIA`)
-   `action`
-   `status`
-   `requestId`
-   `metadata` (redacted, minimal)
-   `createdAt`

### Data rules

-   Enforce site-level tenant isolation.
-   Restrict collection permissions; customer-facing code must not query
    or write privileged collections directly.
-   Perform writes through backend code.
-   Add indexes for `siteId`, `orderId`, `status`, `editingDeadline`,
    `paymentRequestId`, and timestamps as supported by Wix Data.
-   Use deterministic IDs or unique constraints where supported to
    prevent duplicate session/payment records.
-   Do not store card data or payment credentials.
-   Define retention and deletion behavior for customer/order data.

------------------------------------------------------------------------

## 12. Concurrency, idempotency, and recovery

### 12.1 One active edit per order

Wix permits only one active draft per order, and the draft belongs to
the identity that created it.

The app must: - Serialize editing operations per order. - Use an
application-level lock or lease with an expiry. - Detect
`ORDER_IS_ALREADY_EDITED`. - Reuse only a draft created by this app
identity and associated with the active session. - Never modify a draft
created by another app/user identity. - Release locks on success,
failure, or lease expiry.

### 12.2 Idempotency

Use idempotency keys for: - Session creation. - Add-items requests. -
Commit requests. - Payment-request creation. - Webhook processing.

Persist the result of each mutation so retries return the previous
result instead of adding the same product or charging twice.

### 12.3 Recovery cases

  -----------------------------------------------------------------------
  Failure                             Recovery
  ----------------------------------- -----------------------------------
  Draft creation times out            Query/reconcile app-owned active
                                      draft before retry

  Add-items request times out         Retrieve draft and compare
                                      requested additions before retry

  Draft validation fails              Do not commit; log and safely
                                      discard app-owned draft

  Commit request times out            Retrieve draft and original order
                                      to determine whether commit
                                      succeeded

  Commit succeeds, payment-request    Keep adjustment
  creation fails                      pending/reconciliation-required;
                                      retry payment-request creation
                                      safely

  Payment page abandoned              Keep payment pending; allow
                                      retrieval of the same request URL

  Payment request expires             Reconcile status; void/replace only
                                      under supported API rules

  Duplicate webhook                   Return success without repeating
                                      side effects

  Webhook delayed                     Periodically reconcile pending
                                      requests with Wix

  Customer closes tab after commit    Restore session/payment status on
                                      return
  -----------------------------------------------------------------------

A committed draft cannot be rolled back. Recovery must reconcile actual
Wix state rather than assume the request failed.

------------------------------------------------------------------------

## 13. Notifications

Customer messages: - Editing available. - Order updated; additional
payment required. - Additional payment received. - Editing window
expired. - Product unavailable or price changed before confirmation. -
Payment still pending.

Merchant messages: - Order edited. - Additional payment pending. -
Additional payment received. - Payment request expired or voided. -
Payment reconciliation required. - Thank You page plugin not placed. -
Payment Request Page missing/unpublished.

Use Wix-supported notification/email capabilities where available. Do
not send duplicate messages if Wix commit settings already trigger
equivalent notifications. Make notification behavior configurable and
log delivery outcomes.

------------------------------------------------------------------------

## 14. Analytics and reporting

Track: - Number of eligible orders. - Editing widget impressions where
privacy-compliant. - Editing session starts. - Successful edits. -
Products and quantities added. - Additional value committed. -
Additional payment requests created. - Additional payments paid. -
Payment conversion rate. - Expired/abandoned payment requests. -
Failed/reconciled sessions.

Revenue reporting must distinguish: - Additional order value
committed. - Additional amount requested. - Additional amount actually
paid.

Never report committed-but-unpaid additions as collected revenue.

------------------------------------------------------------------------

## 15. UI and accessibility requirements

### Customer widget

-   Responsive on mobile, tablet, and desktop.
-   Clear loading, empty, error, expired, and payment-pending states.
-   Accessible labels and keyboard navigation.
-   Do not rely on color alone for status.
-   Confirm before committing changes.
-   Show currency using the order's currency and locale.
-   Use the host site's context and a merchant-configurable style.
-   Avoid showing sensitive customer/order details to unauthorized
    visitors.

### Dashboard

-   Responsive shadcn/ui layout with sidebar and main content.
-   lucide-react icons.
-   Sonner toasts.
-   Skeleton/loading states.
-   Zod validation.
-   Do not use browser-native validation as the only validation layer.
-   Do not change submit-button labels during loading; show a spinner
    inside the button.
-   Preserve useful empty states and clear setup instructions.

### Localization

-   No hardcoded customer-facing strings.
-   Prepare translation keys for the top 20 languages supported by the
    product's localization plan.
-   Use locale-aware currency, number, and date formatting.
-   Merchant-defined text must be stored separately from translation
    keys.

------------------------------------------------------------------------

## 16. App installation and setup

On installation:

1.  Register the Thank You page Site Plugin extension.
2.  Register the App Tools extension and Tools Provider service plugin.
3.  Request and verify required app permissions.
4.  Initialize Wix Data collections idempotently.
5.  Create default settings once.
6.  Register supported Wix webhook subscriptions.
7.  Detect whether the Thank You page plugin was placed.
8.  Check the site's Payment Request Page prerequisite where the API
    supports verification; otherwise provide a clear manual setup
    checklist.
9.  Show a setup checklist in the dashboard.

Setup checklist: - App installed. - Required permissions granted. -
Thank You page plugin placed. - Order editing enabled. - Product
eligibility configured. - Payment Request Page added and published. -
Payment request API tested successfully. - Webhooks registered and
verified.

Do not enable customer editing until all required capabilities for the
selected payment workflow are ready.

------------------------------------------------------------------------

## 17. Testing plan and acceptance criteria

### Editing rules

-   Customer can add an eligible product.
-   Customer can add multiple units within configured limits.
-   Original line items remain unchanged.
-   Customer cannot remove an original line.
-   Customer cannot decrease an original quantity.
-   Customer cannot change an original variant or price.
-   Customer cannot submit a product that is excluded, unavailable, or
    over the configured limit.
-   Backend rejects tampered requests even if the frontend is modified.

### Editing deadline

-   Editing is available before the deadline.
-   Editing is blocked at and after the deadline.
-   Browser clock changes do not affect eligibility.
-   Refreshing or replaying requests does not extend the window.
-   Merchant setting changes are applied consistently according to
    documented policy.

### Draft Orders

-   Draftability check blocks unsupported orders.
-   Existing app-owned draft is handled safely.
-   Draft calculation is retrieved and validated before commit.
-   Original-line invariants are checked before commit.
-   Commit updates the original order.
-   Inventory behavior is verified with real Wix Stores test products.
-   Commit retries do not duplicate additions.
-   A committed draft is never treated as reversible.

### Payment

-   Correct outstanding amount and currency are requested.
-   Zero-balance edits do not create payment requests.
-   Customer is redirected to the Wix-hosted payment page.
-   Payment status is verified server-side.
-   Browser return alone never marks payment paid.
-   Duplicate webhooks do not duplicate state changes or notifications.
-   Expired/voided/unpaid requests are reconciled correctly.
-   Payment-request creation failure after commit is recoverable.
-   Pending additional products are not represented as paid.

### Security

-   A customer cannot access another customer's order by changing an
    order ID.
-   Guest checkout access is tested.
-   Logged-in customer access is tested.
-   Site A cannot access Site B records.
-   App credentials never reach the browser.
-   Webhook JWT verification rejects forged events.
-   Rate limits and idempotency work under retry conditions.

### Aria

-   Aria can retrieve summary metrics.
-   Aria can list pending payment adjustments.
-   Aria can retrieve an order's edit history.
-   Aria can read and update the editing window.
-   Aria cannot bypass customer or payment safeguards.
-   Tool permissions are scoped to the current installed site.

### Release acceptance

Do not submit for App Market review until: - All critical tests pass on
a real Wix test site. - Thank You page plugin context and guest
authorization are verified. - Order Payment Requests API availability
and Developer Preview status are resolved for the intended release. -
Payment Request Page prerequisite is documented and tested. - App
permissions are minimized as far as the API permits. - Webhooks,
retries, and reconciliation are production-ready. - Merchant setup and
customer-facing limitations are documented.

------------------------------------------------------------------------

## 18. Implementation phases

### Phase 1 --- Foundation

-   Astro + Wix CLI project.
-   App authentication and scopes.
-   Wix Data collections.
-   Dashboard shell and settings.
-   Installation/setup checklist.

### Phase 2 --- Thank You page plugin

-   Site Plugin extension.
-   Slot context integration.
-   Editor placeholder/preview.
-   Customer order access validation.
-   Editing window and eligibility UI.

### Phase 3 --- Catalog and Draft Orders

-   Eligible product listing.
-   Product/variant validation.
-   Draftability check.
-   Create draft.
-   Add catalog line items.
-   Draft calculation.
-   Original-line invariant validation.
-   Commit and inventory tests.

### Phase 4 --- Payment Requests

-   Confirm API availability and preview constraints.
-   Payment Request Page setup detection/instructions.
-   Create payment request.
-   Wix-hosted payment page redirect.
-   Payment request webhooks.
-   Status reconciliation and failure recovery.

### Phase 5 --- Merchant operations

-   Edited orders table.
-   Payment adjustments.
-   Audit log.
-   Analytics.
-   Notifications.

### Phase 6 --- Wix Aria

-   App Tools declaration.
-   Tools Provider service plugin.
-   Read-only reporting tools.
-   Merchant settings tools with confirmation and validation.
-   Aria end-to-end testing.

### Phase 7 --- Hardening and release

-   Security review.
-   Guest checkout testing.
-   Concurrency/idempotency tests.
-   Localization.
-   Accessibility.
-   App Market assets and listing.
-   Wix review preparation.

------------------------------------------------------------------------

## 19. Official Wix documentation references

Use the current documentation and generated schemas during
implementation. Wix API contracts can change; do not treat example
payloads in this specification as a substitute for the live schema.

### Site Plugin / Thank You page

-   Site Plugins:
    https://dev.wix.com/docs/overview/extensions-framework/site-extensions/site-plugins
-   Supported Wix app pages and slots:
    https://dev.wix.com/docs/build-apps/develop-your-app/extensions/site-extensions/site-plugins/supported-wix-app-pages/about-slots

### Draft Orders

-   Draft Orders introduction and sample flows:
    https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/draft-orders/introduction
-   Draft Orders sample flows:
    https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/draft-orders/sample-flows
-   Create Draft Order:
    https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/draft-orders/create-draft-order
-   Add Line Items To Draft Order:
    https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/draft-orders/add-line-items-to-draft-order
-   Update Line Items:
    https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/draft-orders/update-line-items
-   Commit Draft Order:
    https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/draft-orders/commit-draft-order

### Order Payment Requests

-   Create Order Payment Request and API overview:
    https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/order-payment-requests/create-order-payment-request
-   Payment request lifecycle/webhooks: consult the Order Payment
    Requests section in the Wix API reference.

### Wix Aria

-   About Aria:
    https://dev.wix.com/docs/overview/ai-the-wix-platform/about-aria
-   About App Tools Extensions:
    https://dev.wix.com/docs/build-apps/develop-your-app/extensions/backend-extensions/app-tools/about-app-tools-extensions
-   App Tools overview:
    https://dev.wix.com/docs/overview/extensions-framework/backend-extensions/app-tools

------------------------------------------------------------------------

## 20. Non-negotiable engineering rules

1.  Customers can add products only. Never expose remove, decrease, or
    edit-original-item actions.
2.  Enforce all permissions, eligibility, and deadlines on the backend.
3.  Wix calculated draft totals are authoritative.
4.  Validate the original order lines remain unchanged before commit.
5.  A draft commit is irreversible; design recovery around
    reconciliation.
6.  Committing an order change does not mean the additional amount has
    been paid.
7.  Only a verified Wix payment-request `PAID` state can mark an
    adjustment paid.
8.  Do not launch the Order Payment Requests integration without
    resolving its Developer Preview status and prerequisites.
9.  Never authorize an order using only an order ID supplied by the
    browser.
10. Do not claim Wix Aria support until App Tools and the Tools Provider
    are implemented and tested.
