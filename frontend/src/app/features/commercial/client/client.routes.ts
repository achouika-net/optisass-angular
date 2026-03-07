import { TypedRoute } from '@app/types';
import { getRoutePermissions } from '@app/config';

export default [
  {
    path: '',
    loadComponent: () => import('./components/client.component'),
    children: [
      {
        path: '',
        loadComponent: () => import('./components/client-search/client-search.component'),
        data: {
          breadcrumb: 'nav.clients_list',
          authorizationsNeeded: getRoutePermissions('commercial/client'),
        },
      },
    ],
  },
] satisfies TypedRoute[];
