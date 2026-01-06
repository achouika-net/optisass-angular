import { Routes } from '@angular/router';
import { ProductListComponent } from './pages/product-list/product-list.component';

export const routes: Routes = [
    {
        path: '',
        component: ProductListComponent
    },
    {
        path: 'tree',
        loadComponent: () => import('./components/stock-hierarchy/stock-hierarchy.component').then(m => m.StockHierarchyComponent)
    },
    {
        path: 'new',
        loadComponent: () => import('./pages/product-form/product-form.component').then(m => m.ProductFormComponent)
    },
    {
        path: 'transfers',
        loadComponent: () => import('./pages/transfer-manager/transfer-manager.component').then(m => m.TransferManagerComponent)
    },
    {
        path: 'entry-v2',
        loadComponent: () => import('./pages/stock-entry-v2/stock-entry-v2.component').then(m => m.StockEntryV2Component)
    },
    {
        path: ':id',
        loadComponent: () => import('./pages/product-detail/product-detail.component').then(m => m.ProductDetailComponent)
    },
    {
        path: ':id/edit',
        loadComponent: () => import('./pages/product-form/product-form.component').then(m => m.ProductFormComponent)
    }
];
