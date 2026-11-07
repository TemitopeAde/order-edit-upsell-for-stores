// Backwards-compatible alias for clients that still call /api/order-editor.
// Keep the implementation in the customer order-editor session route.
export { GET, POST } from './customer/order-editor/session';
