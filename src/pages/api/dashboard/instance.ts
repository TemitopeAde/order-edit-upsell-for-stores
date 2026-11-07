import type { APIRoute } from 'astro';
import { appInstances } from '@wix/app-management';
import { auth } from '@wix/essentials';

const getAppInstance = auth.elevate(appInstances.getAppInstance);

export const GET: APIRoute = async () => {
  try {
    const response = await getAppInstance();
    console.log('App instance loaded successfully:', response);
    return Response.json(response);
  } catch (error) {
    console.error('Failed to load app instance:', error);
    return Response.json({ error: 'Failed to load app instance' }, { status: 500 });
  }
};
