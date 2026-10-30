import type { APIRoute } from 'astro';
import { catalogService } from '../../../../backend/catalog/catalogService';
import { WixDataRepository } from '../../../../backend/db/wixDataRepository';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const siteId = url.searchParams.get('siteId') || 'default-site';

  try {
    const repo = new WixDataRepository(siteId);
    const settings = await repo.getSettings();
    const products = await catalogService.getEligibleProducts(settings);

    return new Response(JSON.stringify({ products }), {
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
