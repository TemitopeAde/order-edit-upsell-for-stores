import type { APIRoute } from 'astro';
import { ariaService } from '../../../backend/aria/ariaService';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { toolName, inputs = {}, siteId = 'default-site' } = body;

    if (!toolName) {
      return new Response(JSON.stringify({ error: 'toolName is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await ariaService.executeTool(siteId, toolName, inputs);

    return new Response(JSON.stringify({
      output: result,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message || 'Aria tool execution failed',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
