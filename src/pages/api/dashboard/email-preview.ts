import type { APIRoute } from 'astro';
import { WixDataRepository } from '../../../backend/db/wixDataRepository';
import { emailTransmissionService } from '../../../backend/email/emailTransmissionService';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const siteId = url.searchParams.get('siteId') || 'default-site';

  try {
    const repo = new WixDataRepository(siteId);
    const settings = await repo.getSettings();

    const sampleDeadline = new Date(Date.now() + (settings.editingWindowMinutes || 30) * 60 * 1000).toISOString();
    const portalUrl = `https://${siteId === 'default-site' ? 'mystore.wixsite.com' : siteId}.com/thank-you-page?orderId=wix-order-1001`;

    const html = emailTransmissionService.generateOrderEditEmailHtml({
      orderNumber: '#1001',
      customerName: 'Sarah Jenkins',
      editingDeadline: sampleDeadline,
      editingWindowMinutes: settings.editingWindowMinutes,
      items: [
        {
          id: 'item-preview-1',
          name: 'Organic Cotton Crew Tee',
          quantity: 2,
          price: 28.0,
          currency: 'USD',
          productId: 'prod-tee-01',
          isOriginal: true,
        },
      ],
      currency: 'USD',
      total: 60.48,
      portalUrl,
      settings,
    });

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error: any) {
    return new Response(`Error generating preview: ${error.message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
};
