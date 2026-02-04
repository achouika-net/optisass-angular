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
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.MainDashboardComponent),
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
        path: 'profit-report',
        loadComponent: () => import('./features/reports/profit-report/profit-report.component').then(m => m.ProfitReportComponent),
      },
      {
        path: 'advanced-search',
        loadComponent: () => import('./features/advanced-search/advanced-search.component').then(m => m.AdvancedSearchComponent),
      },
      {
        path: 'online-payments',
        loadComponent: () => import('./features/online-payments/online-payments.component').then(m => m.OnlinePaymentsComponent),
      },
      {
        path: 'agenda',
        loadComponent: () => import('./features/agenda/agenda.component').then(m => m.AgendaComponent),
      },
      {
        path: 'finance',
        loadChildren: () => import('./features/finance/finance.routes').then(m => m.routes),
      },
      {
        path: 'gestion-depenses',
        loadChildren: () => import('./features/finance/finance.routes').then(m => m.routes),
      },
      {
        path: 'commercial',
        loadChildren: () => import('./features/commercial/commercial.routes').then(m => m.routes),
      },
      {
        path: 'personnel',
        loadChildren: () => import('./features/personnel-management/personnel-management.routes').then(m => m.personnelManagementRoutes),
      },
      {
        path: 'finance/accounting',
        loadComponent: () => import('./features/accounting/accounting-dashboard/accounting-dashboard.component').then(m => m.AccountingDashboardComponent),
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
