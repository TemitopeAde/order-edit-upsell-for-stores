import React, { useState, useEffect } from 'react';
import {
  type OrderEditSession,
  type OrderEditorSettings,
  type OrderPaymentAdjustment,
  type OrderEditAuditLog,
} from '../../../../types/schemas';
import {
  LayoutDashboard,
  PackagePlus,
  ShoppingBag,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Search,
  Check,
  Sliders,
  Sparkles,
  DollarSign,
  X,
  Eye,
  Mail,
  Send,
} from 'lucide-react';
import { httpClient } from '@wix/essentials';
import { dashboard } from '@wix/dashboard';
import { I18nProvider, useTranslation, LanguageSelector } from '../../../../i18n/I18nContext';

const SITE_PLUGIN_ID = '2504a718-ca95-4e95-b972-6786417e40c0';

const getApiUrl = (path: string): string => {
  try {
    return new URL(path, import.meta.url).href;
  } catch {
    return path;
  }
};

const OrderEditorDashboardContent: React.FC = () => {
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'orders' | 'payments' | 'setup'>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [settings, setSettings] = useState<OrderEditorSettings | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [orders, setOrders] = useState<OrderEditSession[]>([]);
  const [payments, setPayments] = useState<OrderPaymentAdjustment[]>([]);
  const [statusChecklist, setStatusChecklist] = useState<any[]>([]);
  const [storesInstalled, setStoresInstalled] = useState<boolean | null>(null);
  const [pluginPlaced, setPluginPlaced] = useState<boolean | null>(null);
  const [pluginStatusError, setPluginStatusError] = useState<string | null>(null);
  const [checkingPluginPlacement, setCheckingPluginPlacement] = useState(false);
  const [placingPlugin, setPlacingPlugin] = useState(false);

  // Filtering & Modal states
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderEditSession | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [sendingEmailOrderId, setSendingEmailOrderId] = useState<string | null>(null);
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  // Settings form local state
  const [formSettings, setFormSettings] = useState<Partial<OrderEditorSettings>>({});

  const applyStatusResponse = (statusResponse: any) => {
    setStatusChecklist(statusResponse.checklist || []);
    setPluginPlaced(
      typeof statusResponse.pluginPlacement?.placedInSlot === 'boolean'
        ? statusResponse.pluginPlacement.placedInSlot
        : null,
    );
    setPluginStatusError(statusResponse.pluginPlacement?.error || null);
  };

  const loadPluginPlacementStatus = async () => {
    setCheckingPluginPlacement(true);
    try {
      const response = await httpClient.fetchWithAuth(getApiUrl('/api/dashboard/status'));
      if (!response.ok) {
        throw new Error('Failed to load plugin placement status');
      }
      applyStatusResponse(await response.json());
    } catch (err) {
      console.error('Failed to load plugin placement status:', err);
      setPluginStatusError(err instanceof Error ? err.message : 'Failed to load plugin placement status');
    } finally {
      setCheckingPluginPlacement(false);
    }
  };

  const loadAppInstance = async () => {
    try {
      const response = await httpClient.fetchWithAuth(getApiUrl('/api/dashboard/instance'));
      if (!response.ok) {
        throw new Error('Failed to load app instance');
      }
      const appInstance = await response.json();
      const installedWixApps = appInstance.site?.installedWixApps;
      if (Array.isArray(installedWixApps)) {
        setStoresInstalled(installedWixApps.includes('stores'));
      }
    } catch (err) {
      console.error('Failed to load app instance:', err);
    }
  };

  const loadAllData = async () => {
    try {
      setRefreshing(true);
      const [settingsRes, analyticsRes, ordersRes, paymentsRes, statusRes] = await Promise.all([
        httpClient.fetchWithAuth(getApiUrl('/api/dashboard/settings')),
        httpClient.fetchWithAuth(getApiUrl('/api/dashboard/analytics')),
        httpClient.fetchWithAuth(getApiUrl('/api/dashboard/orders')),
        httpClient.fetchWithAuth(getApiUrl('/api/dashboard/payment-adjustments')),
        httpClient.fetchWithAuth(getApiUrl('/api/dashboard/status')),
      ]);

      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setSettings(s);
        setFormSettings(s);
      }
      if (analyticsRes.ok) {
        setAnalytics(await analyticsRes.json());
      }
      if (ordersRes.ok) {
        const o = await ordersRes.json();
        setOrders(o.orders || []);
      }
      if (paymentsRes.ok) {
        const p = await paymentsRes.json();
        setPayments(p.adjustments || []);
      }
      if (statusRes.ok) {
        applyStatusResponse(await statusRes.json());
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handlePlacePlugin = async () => {
    setPlacingPlugin(true);
    try {
      await dashboard.addSitePlugin(SITE_PLUGIN_ID, {});
      await loadPluginPlacementStatus();
    } catch (err: any) {
      console.error('Failed to place site plugin:', err);
      alert(err?.message || 'Wix could not place the plugin. Please open the Thank You page in the Wix Editor and try again.');
    } finally {
      setPlacingPlugin(false);
    }
  };

  useEffect(() => {
    loadAllData();
    loadAppInstance();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await httpClient.fetchWithAuth(getApiUrl('/api/dashboard/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formSettings),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setSaveSuccessMsg(t('settings.saveSuccess'));
        setTimeout(() => setSaveSuccessMsg(null), 3500);
      }
    } catch {
      alert('Failed to save settings');
    }
  };

  const handleReconcilePayment = async (adjustmentId: string) => {
    try {
      const res = await httpClient.fetchWithAuth(getApiUrl(`/api/dashboard/payment-adjustments/${adjustmentId}/reconcile`), {
        method: 'POST',
      });
      if (res.ok) {
        loadAllData();
      }
    } catch {
      alert('Failed to reconcile payment');
    }
  };

  const handleSendEditEmail = async (orderId: string) => {
    try {
      setSendingEmailOrderId(orderId);
      const res = await httpClient.fetchWithAuth(getApiUrl(`/api/dashboard/orders/${orderId}/send-email`), {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSaveSuccessMsg(
          data.simulated
            ? `Order edit email simulated (Tx ID: ${data.transmissionId?.slice(0, 14)}...)`
            : `Order edit email transmitted via Wix SDK (Tx ID: ${data.transmissionId?.slice(0, 14)}...)`
        );
        setTimeout(() => setSaveSuccessMsg(null), 4000);
        await loadAllData();
        if (selectedOrder && selectedOrder.orderId === orderId) {
          setSelectedOrder({
            ...selectedOrder,
            emailNotificationSentAt: new Date().toISOString(),
            emailTransmissionId: data.transmissionId,
          });
        }
      } else {
        alert(data.error || 'Failed to send email transmission');
      }
    } catch (err: any) {
      alert(err.message || 'Error communicating with email service');
    } finally {
      setSendingEmailOrderId(null);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchQuery =
      o.orderNumber.toLowerCase().includes(orderSearch.toLowerCase()) ||
      (o.customerEmail && o.customerEmail.toLowerCase().includes(orderSearch.toLowerCase())) ||
      o.orderId.toLowerCase().includes(orderSearch.toLowerCase());
    return matchQuery;
  });

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      color: '#0f172a',
      display: 'flex',
    }}>
      {/* Sidebar Navigation */}
      <aside style={{
        width: '260px',
        background: '#ffffff',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        boxSizing: 'border-box',
      }}>
        {/* Brand header */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)',
            }}>
              <PackagePlus size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                {t('brand.title')}
              </h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                {t('brand.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            { id: 'overview', label: t('nav.overview'), icon: LayoutDashboard },
            { id: 'orders', label: t('nav.orders'), icon: ShoppingBag, badge: orders.length },
            { id: 'payments', label: t('nav.payments'), icon: CreditCard, badge: payments.filter((p) => p.status === 'UNPAID').length },
            { id: 'settings', label: t('nav.settings'), icon: Sliders },
            { id: 'setup', label: t('nav.setup'), icon: CheckCircle2 },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: active ? '#eff6ff' : 'transparent',
                  color: active ? '#2563eb' : '#475569',
                  fontWeight: active ? 600 : 500,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={18} color={active ? '#2563eb' : '#64748b'} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '999px',
                    background: active ? '#2563eb' : '#f1f5f9',
                    color: active ? '#ffffff' : '#64748b',
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Aria Status card in sidebar */}
        <div style={{ padding: '16px', margin: '16px 12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Sparkles size={16} color="#3b82f6" />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{t('aria.title')}</span>
          </div>
          <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
            {t('aria.description')}
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '32px 40px', boxSizing: 'border-box', overflowY: 'auto' }}>
        {/* Header Bar */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              {activeTab === 'overview' && t('header.overview')}
              {activeTab === 'orders' && t('header.orders')}
              {activeTab === 'payments' && t('header.payments')}
              {activeTab === 'settings' && t('header.settings')}
              {activeTab === 'setup' && t('header.setup')}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748b' }}>
              {t('header.subtitle')}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <LanguageSelector />
            <button
              onClick={loadAllData}
              disabled={refreshing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? t('header.refreshing') : t('header.refresh')}</span>
            </button>
          </div>
        </header>

        {storesInstalled === false && (
          <div
            role="status"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 18px',
              marginBottom: '24px',
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              borderRadius: '10px',
              color: '#9a3412',
              fontSize: '14px',
              lineHeight: 1.5,
            }}
          >
            <AlertTriangle size={18} aria-hidden="true" />
            <span>Wix Stores is not installed on this site. Install Wix Stores to use order editing and upsell features.</span>
          </div>
        )}

        {saveSuccessMsg && (
          <div style={{
            padding: '12px 18px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '10px',
            color: '#065f46',
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <CheckCircle2 size={18} />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div>
            {/* Status Alert Banner */}
            <div style={{
              padding: '16px 20px',
              borderRadius: '12px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: settings?.enabled ? '#f0fdf4' : '#fff7ed',
              border: settings?.enabled ? '1px solid #bbf7d0' : '1px solid #fed7aa',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: settings?.enabled ? '#16a34a' : '#ea580c',
                }} />
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: settings?.enabled ? '#15803d' : '#c2410c' }}>
                    {settings?.enabled ? t('overview.status.active') : t('overview.status.disabled')}
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                    {t('overview.status.windowNotice', { minutes: settings?.editingWindowMinutes || 30 })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('settings')}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#334155',
                }}
              >
                {t('nav.settings')}
              </button>
            </div>

            {/* KPI Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
                  <span>{t('overview.metrics.paidPayments')}</span>
                  <DollarSign size={18} color="#16a34a" />
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: '10px 0 4px' }}>
                  ${(analytics?.metrics?.collectedPaymentsAmount || 0).toFixed(2)}
                </div>
                <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>
                  Confirmed via Wix Payment Requests
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
                  <span>{t('overview.metrics.pendingPayment')}</span>
                  <Clock size={18} color="#f59e0b" />
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: '10px 0 4px' }}>
                  ${(analytics?.metrics?.pendingPaymentsAmount || 0).toFixed(2)}
                </div>
                <div style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 600 }}>
                  {analytics?.metrics?.pendingPaymentsCount || 0} customer requests awaiting payment
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
                  <span>{t('overview.metrics.totalEdited')}</span>
                  <ShoppingBag size={18} color="#2563eb" />
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: '10px 0 4px' }}>
                  {analytics?.metrics?.editedToday || 0}
                </div>
                <div style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600 }}>
                  Out of {analytics?.metrics?.eligibleToday || 0} eligible orders
                </div>
              </div>

              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
                  <span>{t('overview.metrics.additionalRevenue')}</span>
                  <PackagePlus size={18} color="#8b5cf6" />
                </div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: '10px 0 4px' }}>
                  ${(analytics?.metrics?.additionalRevenueCommitted || 0).toFixed(2)}
                </div>
                <div style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: 600 }}>
                  Items combined into original packages
                </div>
              </div>
            </div>

            {/* Recent Orders Preview */}
            <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{t('overview.recentOrders.title')}</h3>
                <button
                  onClick={() => setActiveTab('orders')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t('overview.recentOrders.viewAll')} →
                </button>
              </div>

              {orders.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>
                  {t('overview.recentOrders.empty')}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {orders.slice(0, 5).map((order) => (
                    <div
                      key={order._id}
                      style={{
                        padding: '14px 18px',
                        background: '#f8fafc',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>{order.orderNumber}</span>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>({order.customerEmail || 'Guest'})</span>
                          {order.emailNotificationSentAt && (
                            <span style={{ background: '#ecfdf5', color: '#065f46', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              ✉️ {t('orders.status.sent')}
                            </span>
                          )}
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                          {t('orders.productsCount', { count: order.addedLineItems.length })} • +${order.additionalAmountDue.toFixed(2)}
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: order.status === 'COMPLETED' ? '#dcfce7' : order.status === 'PAYMENT_PENDING' ? '#fef3c7' : '#eff6ff',
                          color: order.status === 'COMPLETED' ? '#15803d' : order.status === 'PAYMENT_PENDING' ? '#b45309' : '#1d4ed8',
                        }}>
                          {order.status}
                        </span>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {t('orders.actions.viewDetails')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ORDERS */}
        {activeTab === 'orders' && (
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700 }}>{t('orders.title')}</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                {t('orders.subtitle')}
              </p>
            </div>

            {/* Search and Filters */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: '420px' }}>
                <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder={t('orders.searchPlaceholder')}
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px 10px 38px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                  {t('orders.totalCount', { count: filteredOrders.length })}
                </span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '14px 24px', fontWeight: 600 }}>{t('orders.table.orderNumber')}</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>{t('orders.table.customer')}</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>{t('orders.table.emailNotification')}</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>{t('orders.table.createdDate')}</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>{t('orders.table.originalTotal')}</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>{t('orders.table.addedItems')}</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>{t('orders.table.additionalAmount')}</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>{t('orders.table.status')}</th>
                    <th style={{ padding: '14px 24px', fontWeight: 600 }}>{t('orders.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                        {t('orders.empty')}
                      </td>
                    </tr>
                  ) : filteredOrders.map((order) => (
                    <tr key={order._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 24px', fontWeight: 700, color: '#0f172a' }}>{order.orderNumber}</td>
                      <td style={{ padding: '14px 16px', color: '#334155' }}>{order.customerEmail || 'Guest Checkout'}</td>
                      <td style={{ padding: '14px 16px' }}>
                        {order.emailNotificationSentAt ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            background: '#ecfdf5',
                            color: '#065f46',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}>
                            <Check size={12} />
                            <span>{t('orders.status.sent')}</span>
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            background: '#f8fafc',
                            color: '#64748b',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 500,
                          }}>
                            <Mail size={12} />
                            <span>{t('orders.status.pending')}</span>
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '12px' }}>
                        {new Date(order.originalOrderCreatedAt).toLocaleString(language)}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#64748b' }}>${order.originalOrderTotal.toFixed(2)}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                          {t('orders.productsCount', { count: order.addedLineItems.length })}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#2563eb' }}>
                        +${order.additionalAmountDue.toFixed(2)}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: order.status === 'COMPLETED' ? '#dcfce7' : order.status === 'PAYMENT_PENDING' ? '#fef3c7' : '#eff6ff',
                          color: order.status === 'COMPLETED' ? '#15803d' : order.status === 'PAYMENT_PENDING' ? '#b45309' : '#1d4ed8',
                        }}>
                          {order.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 24px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          style={{
                            background: '#0f172a',
                            color: '#ffffff',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {t('orders.actions.viewDetails')}
                        </button>
                        <button
                          onClick={() => handleSendEditEmail(order.orderId)}
                          disabled={sendingEmailOrderId === order.orderId}
                          title="Send order edit email via Wix Email Transmission SDK"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: sendingEmailOrderId === order.orderId ? 'not-allowed' : 'pointer',
                            opacity: sendingEmailOrderId === order.orderId ? 0.6 : 1,
                          }}
                        >
                          <Send size={12} />
                          <span>{sendingEmailOrderId === order.orderId ? t('orders.actions.sending') : t('orders.actions.email')}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: PAYMENTS */}
        {activeTab === 'payments' && (
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700 }}>{t('payments.title')}</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                {t('payments.subtitle')}
              </p>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '14px 24px', fontWeight: 600 }}>{t('payments.table.orderNumber')}</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>{t('payments.table.paymentRequestId')}</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>{t('payments.table.amountDue')}</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>{t('payments.table.status')}</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>{t('payments.table.createdDate')}</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>{t('payments.table.notes')}</th>
                    <th style={{ padding: '14px 24px', fontWeight: 600 }}>{t('payments.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                        {t('payments.empty')}
                      </td>
                    </tr>
                  ) : payments.map((adj) => (
                    <tr key={adj._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 24px', fontWeight: 700, color: '#0f172a' }}>{adj.orderNumber}</td>
                      <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: '12px', color: '#64748b' }}>
                        {adj.paymentRequestId}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700, color: '#0f172a' }}>
                        ${adj.amount.toFixed(2)} {adj.currency}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: adj.status === 'PAID' ? '#dcfce7' : adj.status === 'UNPAID' ? '#fef3c7' : '#f1f5f9',
                          color: adj.status === 'PAID' ? '#15803d' : adj.status === 'UNPAID' ? '#b45309' : '#475569',
                        }}>
                          {adj.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '12px' }}>
                        {new Date(adj.createdAt).toLocaleString(language)}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '12px', maxWidth: '240px' }}>
                        {adj.notes}
                      </td>
                      <td style={{ padding: '14px 24px' }}>
                        {adj.status === 'UNPAID' ? (
                          <button
                            onClick={() => handleReconcilePayment(adj._id)}
                            style={{
                              background: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              borderRadius: '6px',
                              padding: '5px 12px',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <span>{t('payments.actions.reconcile')}</span>
                          </button>
                        ) : (
                          <span style={{ color: '#16a34a', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={14} /> Reconciled
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: SETTINGS */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
            {/* General Settings */}
            <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                {t('settings.window.title')}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    {t('settings.window.label')}
                  </label>
                  <select
                    value={formSettings.editingWindowMinutes || 30}
                    onChange={(e) => setFormSettings({ ...formSettings, editingWindowMinutes: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                  >
                    <option value={10}>{t('settings.minutes.10')}</option>
                    <option value={15}>{t('settings.minutes.15')}</option>
                    <option value={30}>{t('settings.minutes.30')}</option>
                    <option value={45}>{t('settings.minutes.45')}</option>
                    <option value={60}>{t('settings.minutes.60')}</option>
                    <option value={120}>{t('settings.minutes.120')}</option>
                  </select>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                    {t('settings.window.help')}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    id="enabled"
                    checked={formSettings.enabled ?? true}
                    onChange={(e) => setFormSettings({ ...formSettings, enabled: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <label htmlFor="enabled" style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                    {t('settings.window.enable')}
                  </label>
                </div>
              </div>
            </div>

            {/* Merchant Quantity & Safety Limits */}
            <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                {t('settings.limits.title')}
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    {t('settings.limits.maxDistinct')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={formSettings.maxDistinctAddedProducts || 5}
                    onChange={(e) => setFormSettings({ ...formSettings, maxDistinctAddedProducts: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    {t('settings.limits.maxQuantity')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={formSettings.maxAddedQuantity || 10}
                    onChange={(e) => setFormSettings({ ...formSettings, maxAddedQuantity: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            {/* Order Safeguards */}
            <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 700, borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                {t('settings.safeguards.title')}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { key: 'blockFulfilledOrders', label: t('settings.safeguards.blockFulfilled') },
                  { key: 'blockCanceledOrders', label: t('settings.safeguards.blockCanceled') },
                  { key: 'blockRefundedOrders', label: t('settings.safeguards.blockRefunded') },
                  { key: 'blockSubscriptionOrders', label: t('settings.safeguards.blockSubscription') },
                ].map((toggle) => (
                  <div key={toggle.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="checkbox"
                      id={toggle.key}
                      checked={(formSettings as any)[toggle.key] ?? true}
                      onChange={(e) => setFormSettings({ ...formSettings, [toggle.key]: e.target.checked })}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <label htmlFor={toggle.key} style={{ fontSize: '13px', color: '#334155', fontWeight: 500 }}>
                      {toggle.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Email Notifications (Wix Email Transmission SDK) */}
            <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Mail size={18} color="#2563eb" />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                    {t('settings.email.title')}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEmailPreview(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Eye size={13} />
                  <span>{t('settings.email.preview')}</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    id="sendCustomerEmailOnOrder"
                    checked={formSettings.sendCustomerEmailOnOrder ?? true}
                    onChange={(e) => setFormSettings({ ...formSettings, sendCustomerEmailOnOrder: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <div>
                    <label htmlFor="sendCustomerEmailOnOrder" style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                      {t('settings.email.autoSend')}
                    </label>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                      {t('settings.email.autoSendHelp')}
                    </p>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    {t('settings.email.subjectLabel')}
                  </label>
                  <input
                    type="text"
                    value={formSettings.emailSubjectTemplate || 'You can still edit your order #{orderNumber}!'}
                    onChange={(e) => setFormSettings({ ...formSettings, emailSubjectTemplate: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                    {t('settings.email.subjectHelp')}
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    {t('settings.email.noticeLabel')}
                  </label>
                  <input
                    type="text"
                    value={formSettings.customEmailNotice || ''}
                    onChange={(e) => setFormSettings({ ...formSettings, customEmailNotice: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    {t('settings.email.senderLabel')}
                  </label>
                  <input
                    type="text"
                    value={formSettings.emailSenderName || 'Order Support'}
                    onChange={(e) => setFormSettings({ ...formSettings, emailSenderName: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              style={{
                padding: '14px 24px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                alignSelf: 'flex-start',
              }}
            >
              {t('settings.saveButton')}
            </button>
          </form>
        )}

        {/* TAB 6: SETUP & CHECKLIST */}
        {activeTab === 'setup' && (
          <div style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', maxWidth: '800px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '24px' }}>
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 700 }}>{t('setup.title')}</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  {t('setup.subtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={loadPluginPlacementStatus}
                disabled={checkingPluginPlacement || placingPlugin}
                style={{
                  flexShrink: 0,
                  background: '#ffffff',
                  color: '#2563eb',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: checkingPluginPlacement || placingPlugin ? 'not-allowed' : 'pointer',
                  opacity: checkingPluginPlacement || placingPlugin ? 0.6 : 1,
                }}
              >
                {checkingPluginPlacement ? 'Checking...' : 'Check placement status'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {statusChecklist.map((item) => (
                <div key={item.id} style={{
                  padding: '16px',
                  borderRadius: '12px',
                  border: item.status === 'COMPLETE' ? '1px solid #bbf7d0' : '1px solid #fed7aa',
                  background: item.status === 'COMPLETE' ? '#f0fdf4' : '#fff7ed',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                }}>
                  <div style={{ color: item.status === 'COMPLETE' ? '#16a34a' : '#f97316', marginTop: '2px' }}>
                    {item.status === 'COMPLETE' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                      {item.title}
                    </h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                      {item.id === 'plugin_placed' && pluginStatusError ? pluginStatusError : item.description}
                    </p>
                    {item.id === 'plugin_placed' && pluginPlaced === false && !pluginStatusError && (
                      <button
                        type="button"
                        onClick={handlePlacePlugin}
                        disabled={placingPlugin || checkingPluginPlacement}
                        style={{
                          marginTop: '12px',
                          background: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 14px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: placingPlugin || checkingPluginPlacement ? 'not-allowed' : 'pointer',
                          opacity: placingPlugin || checkingPluginPlacement ? 0.6 : 1,
                        }}
                      >
                        {placingPlugin ? 'Placing plugin...' : 'Place plugin'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ORDER DETAILS MODAL */}
        {selectedOrder && (
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
            padding: '20px',
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '30px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                    {t('modal.orderTitle', { orderNumber: selectedOrder.orderNumber })}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                    {t('modal.sessionId', { id: selectedOrder._id })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', padding: '8px', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Original snapshot vs added items */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 700, color: '#334155' }}>{t('modal.originalItems')}</h4>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  {selectedOrder.originalLineItemsSnapshot.map((i) => (
                    <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                      <span>{i.quantity}x {i.name}</span>
                      <strong>${(i.price * i.quantity).toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 700, color: '#2563eb' }}>{t('modal.addedItems')}</h4>
                <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                  {selectedOrder.addedLineItems.map((i) => (
                    <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px' }}>
                      <span style={{ fontWeight: 600, color: '#1e40af' }}>{i.quantity}x {i.name}</span>
                      <strong style={{ color: '#1e40af' }}>+${(i.price * i.quantity).toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Summary */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>{t('modal.originalTotal')}</span>
                  <strong>${selectedOrder.originalOrderTotal.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                  <span>{t('modal.additionalAmountDue')}</span>
                  <strong style={{ color: '#2563eb' }}>+${selectedOrder.additionalAmountDue.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0f172a', fontSize: '15px', fontWeight: 700, marginTop: '6px' }}>
                  <span>{t('modal.updatedTotal')}</span>
                  <span>${selectedOrder.updatedOrderTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Customer Email Transmission Status */}
              <div style={{
                marginTop: '20px',
                padding: '16px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <Mail size={16} color="#2563eb" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                      {t('modal.email.title')}
                    </span>
                    {selectedOrder.emailNotificationSentAt ? (
                      <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                        {t('orders.status.delivered')}
                      </span>
                    ) : (
                      <span style={{ background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                        {t('orders.status.pending')}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    {t('modal.email.recipient', { email: selectedOrder.customerEmail || 'No email' })}
                    {selectedOrder.emailNotificationSentAt && ` • ${t('modal.email.sentAt', { time: new Date(selectedOrder.emailNotificationSentAt).toLocaleTimeString(language) })}`}
                  </p>
                  {selectedOrder.emailTransmissionId && (
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                      {t('modal.email.txId', { id: selectedOrder.emailTransmissionId })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleSendEditEmail(selectedOrder.orderId)}
                  disabled={sendingEmailOrderId === selectedOrder.orderId || !selectedOrder.customerEmail}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: sendingEmailOrderId === selectedOrder.orderId ? 'not-allowed' : 'pointer',
                    opacity: sendingEmailOrderId === selectedOrder.orderId ? 0.6 : 1,
                  }}
                >
                  <Send size={13} />
                  <span>
                    {sendingEmailOrderId === selectedOrder.orderId
                      ? t('modal.email.sending')
                      : selectedOrder.emailNotificationSentAt
                      ? t('modal.email.resendBtn')
                      : t('modal.email.sendBtn')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* EMAIL PREVIEW MODAL */}
        {showEmailPreview && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '20px',
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '760px',
              width: '100%',
              height: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '10px', color: '#2563eb' }}>
                    <Mail size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                      {t('preview.title')}
                    </h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                      {t('preview.subtitle')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEmailPreview(false)}
                  style={{ background: '#e2e8f0', border: 'none', borderRadius: '50%', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={18} />
                </button>
              </div>
              <div style={{ flex: 1, background: '#f1f5f9', position: 'relative' }}>
                <iframe
                  src="/api/dashboard/email-preview"
                  title="Email Preview"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export const OrderEditorDashboard: React.FC = () => {
  return (
    <I18nProvider>
      <OrderEditorDashboardContent />
    </I18nProvider>
  );
};

export default OrderEditorDashboard;
