import { TypedRoute } from '@app/types';
import { getRoutePermissions } from '@app/config';

export default [
  {
    path: '',
    loadComponent: () => import('./product.component'),
    children: [
      {
        path: '',
        loadComponent: () => import('./components/product-search/product-search.component'),
        data: {
          breadcrumb: 'nav.products_list',
          authorizationsNeeded: getRoutePermissions('stock/products'),
        },
      },
      {
        path: 'add',
        loadComponent: () => import('./components/product-add/product-add.component'),
        data: {
          breadcrumb: 'nav.products_add',
          authorizationsNeeded: getRoutePermissions('stock/products/add'),
        },
      },
      {
        path: ':id',
        loadComponent: () => import('./components/product-view/product-view.component'),
        data: {
          breadcrumb: 'nav.products_detail',
          authorizationsNeeded: getRoutePermissions('stock/products/:id'),
        },
      },
    ],
  },
] satisfies TypedRoute[];
