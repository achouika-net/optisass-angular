import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        loadComponent: () => import('./client-list/client-list.component').then(m => m.ClientListComponent),
    },
    {
        path: 'new',
        loadComponent: () => import('./client-form/client-form.component').then(m => m.ClientFormComponent),
    },
    {
        path: ':id',
        loadComponent: () => import('./client-detail/client-detail.component').then(m => m.ClientDetailComponent),
    },
    {
        path: ':id/edit',
        loadComponent: () => import('./client-form/client-form.component').then(m => m.ClientFormComponent),
    },
    {
        path: ':clientId/fiche-monture/new',
        loadComponent: () => import('./fiches/monture-form/monture-form.component').then(m => m.MontureFormComponent),
    },
    {
        path: ':clientId/fiche-monture/:ficheId',
        loadComponent: () => import('./fiches/monture-form/monture-form.component').then(m => m.MontureFormComponent),
    },
    {
        path: ':clientId/fiche-lentilles/new',
        loadComponent: () => import('./fiches/lentilles-form/lentilles-form.component').then(m => m.LentillesFormComponent),
    },
    {
        path: ':clientId/fiche-lentilles/:ficheId',
        loadComponent: () => import('./fiches/lentilles-form/lentilles-form.component').then(m => m.LentillesFormComponent),
    },
];
