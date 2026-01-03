import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: 'promotions',
        loadComponent: () => import('./pages/promotion-management/promotion-management.component').then(m => m.PromotionManagementComponent),
    },
    {
        path: 'code-promo',
        loadComponent: () => import('./pages/promotion-management/promotion-management.component').then(m => m.PromotionManagementComponent),
    }
];
