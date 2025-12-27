import { TypedRoute } from '@app/types';
import { ROUTE_PERMISSIONS } from '@app/config';

export default [
  {
    path: '',
    loadComponent: () => import('./components/user.component'),
    children: [
      {
        path: '',
        loadComponent: () => import('./components/user-search/user-search.component'),
        data: {
          breadcrumb: 'nav.users_list',
          authorizationsNeeded: ROUTE_PERMISSIONS['settings/users'],
        },
      },
      {
        path: 'add',
        loadComponent: () => import('./components/user-add/user-add.component'),
        data: {
          breadcrumb: 'nav.users_add',
          authorizationsNeeded: ROUTE_PERMISSIONS['settings/users/add'],
        },
      },
      {
        path: ':id',
        loadComponent: () => import('./components/user-view/user-view.component'),
        data: {
          breadcrumb: 'nav.users_detail',
          authorizationsNeeded: ROUTE_PERMISSIONS['settings/users/:id'],
        },
      },
    ],
  },
] satisfies TypedRoute[];
