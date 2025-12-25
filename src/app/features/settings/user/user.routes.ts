import { TypedRoute } from '@app/types';

export default [
  {
    path: '',
    loadComponent: () => import('./components/user.component'),
    children: [
      {
        path: '',
        loadComponent: () => import('./components/user-search/user-search.component'),
        data: {
          breadcrumb: 'breadcrumb.users_list',
          authorizationsNeeded: ['USERS_READ'],
        },
      },
      {
        path: 'add',
        loadComponent: () => import('./components/user-add/user-add.component'),
        data: {
          breadcrumb: 'breadcrumb.users_add',
          authorizationsNeeded: ['USERS_CREATE'],
        },
      },
      {
        path: ':id',
        loadComponent: () => import('./components/user-view/user-view.component'),
        data: {
          breadcrumb: 'breadcrumb.users_detail',
          authorizationsNeeded: ['USERS_READ'],
        },
      },
    ],
  },
] satisfies TypedRoute[];
