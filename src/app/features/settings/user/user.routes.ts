export default [
  {
    path: '',
    loadComponent: () => import('./components/user.component'),
    children: [
      {
        path: '',
        loadComponent: () => import('./components/user-search/user-search.component'),
      },
      {
        path: 'add',
        loadComponent: () => import('./components/user-add/user-add.component'),
      },
      {
        path: ':id',
        loadComponent: () => import('./components/user-view/user-view.component'),
      },
    ],
  },
];
