import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { UnAuthGuard } from './core/guards/unAuth.guard';
import { TypedRoute } from '@app/types';

export const routes: Routes = [
  {
    path: '',
    canActivate: [UnAuthGuard],
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
    canActivate: [AuthGuard],
    loadComponent: () => import('./layout/private-layout/private-layout.component'),
    children: [
      {
        path: '',
        redirectTo: 'settings',
        pathMatch: 'full',
      },
      {
        path: 'settings',
        data: { breadcrumb: 'nav.settings' },
        loadChildren: () => import('./features/settings/settings.routes'),
      } satisfies TypedRoute,
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
