import { Routes } from '@angular/router';

export const centersRoutes: Routes = [
    {
        path: ':id',
        loadComponent: () =>
            import('./center-detail/center-detail.component').then(
                (m) => m.CenterDetailComponent
            ),
    },
];
