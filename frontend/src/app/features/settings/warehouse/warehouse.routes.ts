import { TypedRoute } from '@app/types';
import { getRoutePermissions } from '@app/config';

export default [
  {
    path: '',
    loadComponent: () => import('./components/warehouse.component'),
    children: [
      {
        path: '',
        loadComponent: () => import('./components/warehouse-search/warehouse-search.component'),
        data: {
          breadcrumb: 'nav.warehouses_list',
          authorizationsNeeded: getRoutePermissions('settings/warehouses'),
        },
      },
      {
        path: 'add',
        loadComponent: () => import('./components/warehouse-add/warehouse-add.component'),
        data: {
          breadcrumb: 'nav.warehouses_add',
          authorizationsNeeded: getRoutePermissions('settings/warehouses/add'),
        },
      },
      {
        path: ':id',
        loadComponent: () => import('./components/warehouse-view/warehouse-view.component'),
        data: {
          breadcrumb: 'nav.warehouses_detail',
          authorizationsNeeded: getRoutePermissions('settings/warehouses/:id'),
        },
      },
    ],
  },
] satisfies TypedRoute[];
