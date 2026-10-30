import type { APIRoute } from 'astro';
import { WixDataRepository } from '@/backend/db/wixDataRepository';
import { OrderEditorSettingsSchema } from '@/types/schemas';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const siteId = url.searchParams.get('siteId') || 'default-site';

  try {
    const repo = new WixDataRepository(siteId);
    const settings = await repo.getSettings();

    return new Response(JSON.stringify(settings), {
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

export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const siteId = body.siteId || 'default-site';

    const repo = new WixDataRepository(siteId);
    const validated = OrderEditorSettingsSchema.partial().parse(body);

    const updated = await repo.updateSettings(validated);

    await repo.recordAudit({
      orderId: 'system',
      actorType: 'MERCHANT',
      action: 'SETTINGS_UPDATED',
      status: 'SUCCESS',
      metadata: { fieldsUpdated: Object.keys(validated) },
    });

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
