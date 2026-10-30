import { extensions } from '@wix/astro/builders';

export default extensions.dashboardPage({
  id: '97ff9515-f70b-478e-a249-50d2bafa9fcf',
  title: 'Order Editor & Upsell',
  routePath: '',
  component: './extensions/dashboard/pages/order-editor/OrderEditorDashboard.tsx',
  fullPage: true,
  metaData: {
    searchable: true,
    description: 'Manage post-purchase order editing, customer additions, deadlines, and payment requests.',
  },
});
