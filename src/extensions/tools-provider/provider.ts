import { ariaService } from '../../backend/aria/ariaService';

export async function executeTool(toolName: string, inputs: Record<string, any>, context: any) {
  const siteId = context?.siteId || 'default-site';
  return ariaService.executeTool(siteId, toolName, inputs);
}

export default {
  executeTool,
};
