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
        path: 'settings/loyalty',
        loadComponent: () => import('./features/settings/loyalty-config/loyalty-config.component').then(m => m.LoyaltyConfigComponent),
      },
      {
        path: 'settings/caisses',
        loadComponent: () => import('./features/finance/caisse/pages/caisse-list/caisse-list.component').then(m => m.CaisseListComponent),
        data: { mode: 'management' }
      },
      {
        path: 'settings/marketing',
        loadComponent: () => import('./features/settings/marketing-config/marketing-config.component').then(m => m.MarketingConfigComponent),
      },
      {
        path: 'stats',
        loadComponent: () => import('./features/reports/advanced-stats/advanced-stats.component').then(m => m.AdvancedStatsComponent),
      },
      {
        path: 'finance',
        loadChildren: () => import('./features/finance/finance.routes').then(m => m.routes),
      },
      {
        path: 'commercial',
        loadChildren: () => import('./features/commercial/commercial.routes').then(m => m.routes),
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
