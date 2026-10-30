import React, { useState, useEffect } from 'react';
import {
  type OrderEditSession,
  type OrderEditorSettings,
  type CatalogProduct,
  type OrderLineItem,
} from '../../../types/schemas';
import { httpClient } from '@wix/essentials';
import {
  Clock,
  Plus,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  PackageCheck,
  ChevronRight,
  X,
  CreditCard,
  Sparkles,
  Mail,
} from 'lucide-react';

const getApiUrl = (path: string): string => {
  try {
    return new URL(path, import.meta.url).href;
  } catch {
    return path;
  }
};

interface ThankYouEditorProps {
  orderId?: string;
  siteId?: string;
  isEditorPreview?: boolean;
}

export const ThankYouEditor: React.FC<ThankYouEditorProps> = ({
  orderId = 'wix-order-1001',
  siteId = 'default-site',
  isEditorPreview = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<OrderEditSession | null>(null);
  const [settings, setSettings] = useState<OrderEditorSettings | null>(null);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [secondsLeft, setSecondsLeft] = useState<number>(1800);
  const [addedItems, setAddedItems] = useState<{ product: CatalogProduct; quantity: number; variantId?: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [emailSentNotice, setEmailSentNotice] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Fetch session data
  useEffect(() => {
    if (isEditorPreview) {
      setLoading(false);
      return;
    }

    async function loadData() {
      try {
        setLoading(true);
        const res = await httpClient.fetchWithAuth(getApiUrl(`/api/customer/order-editor/session?orderId=${encodeURIComponent(orderId)}&siteId=${encodeURIComponent(siteId)}`));
        const data = await res.json();

        if (data.eligible && data.session) {
          setSession(data.session);
          setSettings(data.settings);
          setProducts(data.eligibleProducts || []);
          setSecondsLeft(data.remainingSeconds || 0);

          if (data.paymentAdjustment?.paymentPageUrl) {
            setPaymentUrl(data.paymentAdjustment.paymentPageUrl);
          }
        } else {
          setError(data.reason || 'Order is not eligible for post-purchase additions');
          if (data.settings) setSettings(data.settings);
        }
      } catch (err: any) {
        setError(err.message || 'Unable to connect to order service');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [orderId, siteId, isEditorPreview]);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0 || !session || session.status === 'COMPLETED' || session.status === 'EXPIRED') return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (session) {
            setSession({ ...session, status: 'EXPIRED' });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsLeft, session]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleAddProduct = (product: CatalogProduct) => {
    const maxQty = settings?.maxAddedQuantity || 10;
    const maxDistinct = settings?.maxDistinctAddedProducts || 5;

    const existingIndex = addedItems.findIndex((item) => item.product.id === product.id);

    if (existingIndex > -1) {
      const currentQty = addedItems[existingIndex].quantity;
      if (currentQty >= maxQty) {
        alert(`You can add up to ${maxQty} units of this product.`);
        return;
      }
      const updated = [...addedItems];
      updated[existingIndex].quantity += 1;
      setAddedItems(updated);
    } else {
      if (addedItems.length >= maxDistinct) {
        alert(`You can add up to ${maxDistinct} distinct products to this order.`);
        return;
      }
      const chosenVar = selectedVariants[product.id] || (product.variants?.[0]?.id);
      setAddedItems([...addedItems, { product, quantity: 1, variantId: chosenVar }]);
    }
  };

  const handleRemoveAddedItem = (productId: string) => {
    setAddedItems(addedItems.filter((item) => item.product.id !== productId));
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    const maxQty = settings?.maxAddedQuantity || 10;
    setAddedItems((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > maxQty) return item;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as typeof addedItems
    );
  };

  // Submit confirmation & commit draft
  const handleConfirmAndPay = async () => {
    if (!session || addedItems.length === 0) return;

    try {
      setSubmitting(true);
      setError(null);

      // 1. Send items to backend draft
      const addRes = await httpClient.fetchWithAuth(getApiUrl('/api/customer/order-editor/add-items'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          sessionId: session._id,
          items: addedItems.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            variantId: item.variantId,
          })),
        }),
      });

      const addData = await addRes.json();
      if (!addRes.ok) {
        throw new Error(addData.error || 'Failed to add items to draft');
      }

      // 2. Commit draft and create payment request
      const confirmRes = await httpClient.fetchWithAuth(getApiUrl('/api/customer/order-editor/confirm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          sessionId: session._id,
        }),
      });

      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) {
        throw new Error(confirmData.error || 'Failed to confirm order update');
      }

      setSession(confirmData.session);
      setShowReviewModal(false);

      if (confirmData.paymentRequired && confirmData.paymentPageUrl) {
        setPaymentUrl(confirmData.paymentPageUrl);
        // Direct customer to Wix-hosted payment page
        window.location.href = confirmData.paymentPageUrl;
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong while updating your order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCustomerEmail = async () => {
    if (!session?.orderId) return;
    try {
      setSendingEmail(true);
      const res = await httpClient.fetchWithAuth(getApiUrl('/api/customer/order-editor/send-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: session.orderId, siteId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEmailSentNotice(`Direct order edit link sent to ${data.email || session.customerEmail}!`);
        setTimeout(() => setEmailSentNotice(null), 5000);
      }
    } catch {
      // ignore
    } finally {
      setSendingEmail(false);
    }
  };

  // Calculating additions
  const additionsSubtotal = addedItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const additionsTax = Math.round(additionsSubtotal * 0.08 * 100) / 100;
  const additionsTotal = Math.round((additionsSubtotal + additionsTax) * 100) / 100;

  // Editor preview mode placeholder
  if (isEditorPreview) {
    return (
      <div style={{
        padding: '24px',
        backgroundColor: '#f8fafc',
        border: '2px dashed #94a3b8',
        borderRadius: '16px',
        textAlign: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{ display: 'inline-flex', padding: '10px', background: '#e0e7ff', borderRadius: '50%', marginBottom: '12px', color: '#4338ca' }}>
          <ShoppingBag size={28} />
        </div>
        <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
          Wix Order Editor Plugin (Editor Preview)
        </h3>
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#64748b', maxWidth: '460px', marginLeft: 'auto', marginRight: 'auto' }}>
          This plugin renders automatically for customers immediately after checkout on the Thank You page. Customers can add products to their order before the deadline.
        </p>
        <span style={{ display: 'inline-block', fontSize: '12px', fontWeight: 600, color: '#0369a1', background: '#e0f2fe', padding: '4px 12px', borderRadius: '999px' }}>
          Slot: after items (55240cc6-0b87-4657-b626-88b90915151e)
        </span>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '12px', fontSize: '14px', color: '#64748b' }}>Checking order editing window...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Payment pending status
  if (session?.status === 'PAYMENT_PENDING' && paymentUrl) {
    return (
      <div style={{
        marginTop: '24px',
        marginBottom: '24px',
        padding: '28px',
        background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
        border: '1.5px solid #bfdbfe',
        borderRadius: '18px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <div style={{ padding: '10px', background: '#dbeafe', borderRadius: '12px', color: '#1d4ed8' }}>
            <CreditCard size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e3a8a' }}>
              Order Updated — Additional Payment Pending
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#3b82f6' }}>
              Your order has been updated with your added items. Please complete your payment of <strong>${session.additionalAmountDue.toFixed(2)}</strong> to finalize the order.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '20px' }}>
          <a
            href={paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: '#2563eb',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '10px',
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
            }}
          >
            <span>Complete Payment Now</span>
            <ExternalLink size={16} />
          </a>
        </div>
      </div>
    );
  }

  // Already completed status
  if (session?.status === 'COMPLETED') {
    return (
      <div style={{
        marginTop: '24px',
        marginBottom: '24px',
        padding: '24px',
        background: '#f0fdf4',
        border: '1.5px solid #bbf7d0',
        borderRadius: '16px',
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        <div style={{ padding: '10px', background: '#dcfce7', borderRadius: '12px', color: '#15803d' }}>
          <PackageCheck size={28} />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#14532d' }}>
            Order Successfully Updated & Paid!
          </h4>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#166534' }}>
            Your added products have been combined into order {session.orderNumber}. All payment requirements have been verified.
          </p>
        </div>
      </div>
    );
  }

  // Expired status
  if (secondsLeft <= 0 || session?.status === 'EXPIRED') {
    return (
      <div style={{
        marginTop: '20px',
        padding: '18px 24px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        color: '#64748b',
      }}>
        <Clock size={20} color="#94a3b8" />
        <span style={{ fontSize: '13px', fontWeight: 500 }}>
          The post-purchase editing window for order {session?.orderNumber || ''} has closed.
        </span>
      </div>
    );
  }

  if (error && !session) {
    return null; // Gracefully do not obstruct Thank You page if not eligible
  }

  return (
    <section style={{
      marginTop: '28px',
      marginBottom: '36px',
      background: '#ffffff',
      borderRadius: settings?.appearance?.borderRadius || '16px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)',
      overflow: 'hidden',
      fontFamily: settings?.appearance?.fontFamily || 'Inter, system-ui, sans-serif',
    }}>
      {/* Top Banner with live ticking countdown */}
      <div style={{
        padding: '14px 24px',
        background: 'linear-gradient(90deg, #1e293b 0%, #0f172a 100%)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles size={18} color="#f59e0b" />
          <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.02em' }}>
            {settings?.appearance?.bannerMessage || 'Limited-Time Post-Purchase Opportunity'}
          </span>
          <span style={{ background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', textTransform: 'uppercase' }}>
            No extra shipping
          </span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          padding: '6px 14px',
          borderRadius: '999px',
          color: '#fca5a5',
        }}>
          <Clock size={15} />
          <span style={{ fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {formatTimer(secondsLeft)} remaining to add
          </span>
        </div>
      </div>

      {/* Main Body */}
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
              {settings?.appearance?.widgetTitle || 'Forgot Something? Add to Your Order'}
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b', maxWidth: '640px' }}>
              {settings?.appearance?.widgetDescription || 'Add forgotten items directly to this package before it gets packed. Items will be combined with order ' + (session?.orderNumber || '') + '.'}
            </p>
          </div>

          {addedItems.length > 0 && (
            <button
              onClick={() => setShowReviewModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              }}
            >
              <ShoppingBag size={16} />
              <span>Review Added Items ({addedItems.reduce((acc, i) => acc + i.quantity, 0)})</span>
              <span style={{ background: 'rgba(255,255,255,0.25)', padding: '2px 8px', borderRadius: '999px', fontSize: '12px' }}>
                +${additionsTotal.toFixed(2)}
              </span>
            </button>
          )}
        </div>

        {session?.customerEmail && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            background: '#eff6ff',
            border: '1px solid #dbeafe',
            borderRadius: '10px',
            fontSize: '12px',
            color: '#1e40af',
            marginBottom: '18px',
            flexWrap: 'wrap',
            gap: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={15} color="#2563eb" />
              <span>
                {emailSentNotice || `A direct edit link has also been emailed to ${session.customerEmail}. You can modify this order anytime before the timer closes.`}
              </span>
            </div>
            <button
              onClick={handleResendCustomerEmail}
              disabled={sendingEmail}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#2563eb',
                fontWeight: 600,
                textDecoration: 'underline',
                cursor: sendingEmail ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                padding: 0,
              }}
            >
              {sendingEmail ? 'Sending...' : 'Resend email link'}
            </button>
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#dc2626', fontSize: '13px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Catalog Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '18px',
          marginTop: '16px',
        }}>
          {products.map((product) => {
            const addedEntry = addedItems.find((i) => i.product.id === product.id);
            return (
              <div
                key={product.id}
                style={{
                  border: addedEntry ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '14px',
                  background: addedEntry ? '#f8fafc' : '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div>
                  <div style={{
                    width: '100%',
                    height: '140px',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    background: '#f1f5f9',
                    marginBottom: '12px',
                    position: 'relative',
                  }}>
                    {product.mainMedia ? (
                      <img
                        src={product.mainMedia}
                        alt={product.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                        <ShoppingBag size={32} />
                      </div>
                    )}
                    {addedEntry && (
                      <span style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: '#2563eb',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '999px',
                      }}>
                        {addedEntry.quantity} added
                      </span>
                    )}
                  </div>

                  <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 600, color: '#0f172a', lineHeight: 1.3 }}>
                    {product.name}
                  </h3>
                  <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#64748b', lineClamp: 2, overflow: 'hidden', height: '32px' }}>
                    {product.description}
                  </p>

                  {/* Variant choices if any */}
                  {product.manageVariants && product.variants.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <select
                        value={selectedVariants[product.id] || product.variants[0].id}
                        onChange={(e) => setSelectedVariants({ ...selectedVariants, [product.id]: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px',
                          background: '#ffffff',
                        }}
                      >
                        {product.variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.title} (${v.price.toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                      ${product.price.toFixed(2)}
                    </span>
                    <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <CheckCircle2 size={12} /> In Stock
                    </span>
                  </div>

                  {addedEntry ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '4px 8px',
                        flex: 1,
                        background: '#ffffff',
                      }}>
                        <button
                          onClick={() => handleUpdateQuantity(product.id, -1)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 6px', fontSize: '14px', fontWeight: 700 }}
                        >
                          -
                        </button>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{addedEntry.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(product.id, 1)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 6px', fontSize: '14px', fontWeight: 700 }}
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => handleRemoveAddedItem(product.id)}
                        style={{
                          background: '#f1f5f9',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '7px 10px',
                          cursor: 'pointer',
                          color: '#64748b',
                        }}
                        title="Remove item"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAddProduct(product)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        color: '#1e293b',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <Plus size={14} />
                      <span>{settings?.appearance?.addButtonLabel || 'Add to Order'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review Drawer / Modal */}
      {showReviewModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px',
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            maxWidth: '560px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 700, color: '#0f172a' }}>
                  Review Order Changes
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Original items cannot be modified. Confirm the additions to proceed to payment.
                </p>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Original Items (Read-only) */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Original Items (Already Purchased)
                </span>
                <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                  Locked & Preserved
                </span>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '12px', border: '1px solid #e2e8f0' }}>
                {session?.originalLineItemsSnapshot.map((item) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #edf2f7' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', color: '#334155' }}>{item.quantity}x</span>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#1e293b' }}>{item.name}</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Newly Added Items */}
            <div style={{ marginBottom: '24px' }}>
              <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Newly Added to This Order
              </span>
              <div style={{ background: '#eff6ff', borderRadius: '12px', padding: '12px', border: '1px solid #bfdbfe' }}>
                {addedItems.map((item) => (
                  <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #dbeafe' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e40af' }}>{item.product.name}</div>
                      <div style={{ fontSize: '12px', color: '#3b82f6' }}>Qty: {item.quantity} × ${item.product.price.toFixed(2)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e40af' }}>
                        +${(item.product.price * item.quantity).toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleRemoveAddedItem(item.product.id)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Price Breakdown */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>
                <span>Original Order Total</span>
                <span>${(session?.originalOrderTotal || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>
                <span>Additional Items Subtotal</span>
                <span>+${additionsSubtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>
                <span>Estimated Additional Tax</span>
                <span>+${additionsTax.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#16a34a', marginBottom: '12px' }}>
                <span>Combined Shipping</span>
                <span>FREE ($0.00)</span>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '17px',
                fontWeight: 800,
                color: '#0f172a',
                paddingTop: '12px',
                borderTop: '2px dashed #e2e8f0',
              }}>
                <span>Additional Amount Due Now</span>
                <span style={{ color: '#2563eb' }}>${additionsTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Confirmation CTA */}
            <button
              onClick={handleConfirmAndPay}
              disabled={submitting}
              style={{
                width: '100%',
                padding: '14px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? (
                <>
                  <div style={{ width: '18px', height: '18px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <span>Calculating & Creating Payment Request...</span>
                </>
              ) : (
                <>
                  <span>{settings?.appearance?.checkoutButtonLabel || 'Confirm & Pay Additional Amount'}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '14px', fontSize: '12px', color: '#64748b' }}>
              <ShieldCheck size={14} color="#16a34a" />
              <span>Secure checkout powered by Wix Order Payment Requests</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ThankYouEditor;
