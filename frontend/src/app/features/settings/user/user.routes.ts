import { TypedRoute } from '@app/types';
import { getRoutePermissions } from '@app/config';

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
          authorizationsNeeded: getRoutePermissions('settings/users'),
        },
      },
      {
        path: 'add',
        loadComponent: () => import('./components/user-add/user-add.component'),
        data: {
          breadcrumb: 'nav.users_add',
          authorizationsNeeded: getRoutePermissions('settings/users/add'),
        },
      },
      {
        path: ':id',
        loadComponent: () => import('./components/user-view/user-view.component'),
        data: {
          breadcrumb: 'nav.users_detail',
          authorizationsNeeded: getRoutePermissions('settings/users/:id'),
        },
      },
    ],
  },
] satisfies TypedRoute[];
