import type { APIRoute } from 'astro';
import { WixDataRepository } from '../../../../backend/db/wixDataRepository';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const siteId = url.searchParams.get('siteId') || 'default-site';
  const status = url.searchParams.get('status') || undefined;

  try {
    const repo = new WixDataRepository(siteId);
    const sessions = await repo.listSessions({ status });

    return new Response(JSON.stringify({ orders: sessions }), {
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
