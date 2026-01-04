import { TypedRoute } from '@app/types';
import { getRoutePermissions } from '@app/config';

export default [
  {
    path: '',
    loadComponent: () => import('./components/stock.component'),
    children: [
      {
        path: '',
        loadComponent: () => import('./components/product-search/product-search.component'),
        data: {
          breadcrumb: 'nav.stock_list',
          authorizationsNeeded: getRoutePermissions('commercial/stock'),
        },
      },
      {
        path: 'add',
        loadComponent: () => import('./components/product-add/product-add.component'),
        data: {
          breadcrumb: 'nav.stock_add',
          authorizationsNeeded: getRoutePermissions('commercial/stock/add'),
        },
      },
      {
        path: ':id',
        loadComponent: () => import('./components/product-view/product-view.component'),
        data: {
          breadcrumb: 'nav.stock_detail',
          authorizationsNeeded: getRoutePermissions('commercial/stock/:id'),
        },
      },
    ],
  },
] satisfies TypedRoute[];
