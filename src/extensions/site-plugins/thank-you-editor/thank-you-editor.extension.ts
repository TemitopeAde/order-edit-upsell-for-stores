import { extensions } from '@wix/astro/builders';

export default extensions.sitePlugin({
  id: '2504a718-ca95-4e95-b972-6786417e40c0',
  name: 'Thank You Page Order Editor',
  tagName: 'order-editor-plugin',
  element: './extensions/site-plugins/thank-you-editor/element.tsx',
  settings: './extensions/site-plugins/thank-you-editor/settings.tsx',
  installation: {
    autoAdd: true,
  },
  placements: [
    {
      appDefinitionId: '1380b703-ce81-ff05-f115-39571d94dfcd',
      widgetId: '1380bbb4-8df0-fd38-a235-88821cf3f8a4',
      slotId: '55240cc6-0b87-4657-b626-88b90915151e',
    },
    {
      appDefinitionId: '1380b703-ce81-ff05-f115-39571d94dfcd',
      widgetId: '1380bbb4-8df0-fd38-a235-88821cf3f8a4',
      slotId: '1a9cafe0-52bd-4fbd-b632-0403fc9c72f8',
    },
    {
      appDefinitionId: '1380b703-ce81-ff05-f115-39571d94dfcd',
      widgetId: '1380bbb4-8df0-fd38-a235-88821cf3f8a4',
      slotId: 'f15386d3-bae5-4e53-965e-0fb7d25e6a5a',
    },
  ],
  marketData: {
    name: 'Wix Order Editor & Post-Purchase Upsell',
    description: 'Empower customers to add forgotten items directly from the Thank You page before fulfillment.',
  },
});
