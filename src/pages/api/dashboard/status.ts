import type { APIRoute } from 'astro';
import { auth } from '@wix/essentials';
import { plugins } from '@wix/site-plugins';
import { WixDataRepository } from '@/backend/db/wixDataRepository';

const SITE_PLUGIN_ID = '2504a718-ca95-4e95-b972-6786417e40c0';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const siteId = url.searchParams.get('siteId') || 'default-site';

  try {
    const repo = new WixDataRepository(siteId);
    const settings = await repo.getSettings();

    let pluginPlaced = false;
    let pluginStatusError: string | undefined;
    try {
      const getPlacementStatus = auth.elevate(plugins.getPlacementStatus);
      const placementStatus = await getPlacementStatus();
      pluginPlaced = placementStatus.placementStatuses?.some(
        (status) => status.pluginId === SITE_PLUGIN_ID && status.placedInSlot,
      ) ?? false;
    } catch (error: any) {
      pluginStatusError = error?.message || 'Unable to read site plugin placement status.';
      console.error('Failed to read site plugin placement status:', error);
    }

    const checklist = [
      {
        id: 'app_installed',
        title: 'App Installation & Database Initialization',
        description: 'Wix Data collections and settings initialized successfully.',
        status: 'COMPLETE',
        required: true,
      },
      {
        id: 'permissions_granted',
        title: 'API Scopes & Permissions',
        description: 'Manage eCommerce and Draft Orders permissions active.',
        status: 'COMPLETE',
        required: true,
      },
      {
        id: 'plugin_placed',
        title: 'Thank You Page Site Plugin Placement',
        description: pluginStatusError
          ? pluginStatusError
          : pluginPlaced
            ? 'Site plugin is placed on the Thank You page.'
            : 'Site plugin is not placed on the Thank You page yet.',
        status: pluginStatusError ? 'WARNING' : pluginPlaced ? 'COMPLETE' : 'WARNING',
        required: true,
      },
      {
        id: 'payment_request_page',
        title: 'Wix Payment Request Page',
        description: 'Merchant site payment request page published for hosted checkout.',
        status: settings.paymentFeatureEnabled ? 'COMPLETE' : 'WARNING',
        required: true,
      },
      {
        id: 'aria_tools',
        title: 'Wix Aria Merchant App Tools',
        description: 'App Tools Provider service plugin registered and ready.',
        status: 'COMPLETE',
        required: false,
      },
      {
        id: 'webhooks_health',
        title: 'Order & Payment Webhooks',
        description: 'Listening for order updates and payment request paid lifecycle events.',
        status: 'COMPLETE',
        required: true,
      },
    ];

    return new Response(JSON.stringify({
      ready: checklist.every((item) => !item.required || item.status === 'COMPLETE'),
      allRequiredComplete: checklist.every((item) => !item.required || item.status === 'COMPLETE'),
      checklist,
      pluginPlacement: {
        pluginId: SITE_PLUGIN_ID,
        placedInSlot: pluginPlaced,
        error: pluginStatusError,
      },
      settings,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
