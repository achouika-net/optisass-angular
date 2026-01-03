import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./pages/client-list/client-list.component').then(m => m.ClientListComponent),
    },
    {
        path: 'new',
        loadComponent: () => import('./pages/client-form/client-form.component').then(m => m.ClientFormComponent),
    },
    {
        path: 'factures',
        loadComponent: () => import('./pages/facture-list/facture-list.component').then(m => m.FactureListComponent),
    },
    {
        path: 'factures/new',
        loadComponent: () => import('./pages/facture-form/facture-form.component').then(m => m.FactureFormComponent),
    },
    {
        path: 'factures/:id',
        loadComponent: () => import('./pages/facture-form/facture-form.component').then(m => m.FactureFormComponent),
    },
    {
        path: 'promotions',
        loadComponent: () => import('./pages/promotion-management/promotion-management.component').then(m => m.PromotionManagementComponent),
    },
    {
        path: ':id',
        loadComponent: () => import('./pages/client-detail/client-detail.component').then(m => m.ClientDetailComponent),
    },
    {
        path: ':id/edit',
        loadComponent: () => import('./pages/client-form/client-form.component').then(m => m.ClientFormComponent),
    },
    {
        path: ':clientId/fiche-monture/new',
        loadComponent: () => import('./pages/monture-form/monture-form.component').then(m => m.MontureFormComponent),
    },
    {
        path: ':clientId/fiche-monture/:ficheId',
        loadComponent: () => import('./pages/monture-form/monture-form.component').then(m => m.MontureFormComponent),
    },
    {
        path: ':clientId/fiche-lentilles/new',
        loadComponent: () => import('./pages/lentilles-form/lentilles-form.component').then(m => m.LentillesFormComponent),
    },
    {
        path: ':clientId/fiche-lentilles/:ficheId',
        loadComponent: () => import('./pages/lentilles-form/lentilles-form.component').then(m => m.LentillesFormComponent),
    },
    {
        path: 'instance-sales',
        loadComponent: () => import('./pages/instance-sales-dashboard/instance-sales-dashboard.component').then(m => m.InstanceSalesDashboardComponent),
    },
];
