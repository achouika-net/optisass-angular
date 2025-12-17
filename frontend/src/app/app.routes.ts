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
        redirectTo: 'clients',
        pathMatch: 'full',
      },
      {
        path: 'clients',
        loadChildren: () => import('./features/client-management/client-management.routes').then(m => m.routes),
      },
      {
        path: 'stock',
        loadChildren: () => import('./features/stock-management/stock-management.routes').then(m => m.routes),
      },
      {
        path: 'groups',
        loadChildren: () => import('./features/groups/groups.routes').then(m => m.groupsRoutes),
      },
      {
        path: 'centers',
        loadChildren: () => import('./features/centers/centers.routes').then(m => m.centersRoutes),
      },
      {
        path: 'warehouses',
        loadChildren: () => import('./features/warehouses/warehouses.routes').then(m => m.warehousesRoutes),
      },
      {
        path: 'users',
        loadChildren: () => import('./features/user-management/user-management.routes').then(m => m.userManagementRoutes),
      },
      {
        path: 'reports/sales-control',
        loadComponent: () => import('./features/reports/sales-control-report/sales-control-report.component').then(m => m.SalesControlReportComponent),
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
