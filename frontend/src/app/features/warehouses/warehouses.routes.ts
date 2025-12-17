import { Routes } from '@angular/router';

export const warehousesRoutes: Routes = [
    {
        path: ':id',
        loadComponent: () =>
            import('./warehouse-detail/warehouse-detail.component').then(
                (m) => m.WarehouseDetailComponent
            ),
    },
];
