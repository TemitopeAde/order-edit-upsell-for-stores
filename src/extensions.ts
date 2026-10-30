import { app } from '@wix/astro/builders';
import dashboardPage from './extensions/dashboard/pages/order-editor/order-editor.extension.ts';
import sitePlugin from './extensions/site-plugins/thank-you-editor/thank-you-editor.extension.ts';
import dataCollections from './extensions/data-collections/collections.extension.ts';
import appTools from './extensions/app-tools/order-editor-tools.extension.ts';
import toolsProvider from './extensions/tools-provider/tools-provider.extension.ts';

import orderCreated from './extensions/backend/events/order-created/order-created.extension.ts';

export default app()
  .use(dashboardPage)
  .use(sitePlugin)
  .use(dataCollections)
  .use(appTools)
  .use(toolsProvider).use(orderCreated);
