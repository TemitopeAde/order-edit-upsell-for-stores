import { extensions } from '@wix/astro/builders';

export default extensions.dashboardPage({
  id: '97ff9515-f70b-478e-a249-50d2bafa9fcf',
  title: 'My Page',
  routePath: '',
  component: './extensions/dashboard/pages/my-page/my-page.tsx',
  fullPage: false,
  metaData: {
    searchable: true,
    description: 'Manage My Page in your dashboard.',
  },
});
