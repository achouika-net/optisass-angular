import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/public-layout/public-layout.component'),
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./features/authentication/authentication.routes').then((el) => el.routes),
      },
    ],
  },
  {
    path: 'p',
    loadComponent: () => import('./layout/private-layout/private-layout.component'),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'page-not-found',
    loadComponent: () => import('./features/error-page/error-page.component'),
    data: {
      message: 'pageNotFound',
    },
  },
  {
    path: '**',
    redirectTo: 'page-not-found',
  },
];
