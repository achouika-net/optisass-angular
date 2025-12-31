import { Routes } from '@angular/router';
import { SupplierListComponent } from './pages/supplier-list/supplier-list.component';
import { ExpenseListComponent } from './pages/expense-list/expense-list.component';
import { SupplierInvoiceListComponent } from './pages/supplier-invoice-list/supplier-invoice-list.component';
import { FinanceDashboardComponent } from './pages/finance-dashboard/finance-dashboard.component';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'caisse',
        pathMatch: 'full'
    },
    {
        path: 'suppliers',
        children: [
            { path: '', component: SupplierListComponent },
            { path: 'new', loadComponent: () => import('./components/supplier-form-dialog/supplier-form-dialog.component').then(m => m.SupplierFormDialogComponent) },
            { path: 'edit/:id', loadComponent: () => import('./components/supplier-form-dialog/supplier-form-dialog.component').then(m => m.SupplierFormDialogComponent) }
        ]
    },
    {
        path: 'expenses',
        children: [
            { path: '', component: ExpenseListComponent },
            { path: 'new', loadComponent: () => import('./components/expense-form-dialog/expense-form-dialog.component').then(m => m.ExpenseFormDialogComponent) },
            { path: 'edit/:id', loadComponent: () => import('./components/expense-form-dialog/expense-form-dialog.component').then(m => m.ExpenseFormDialogComponent) }
        ]
    },
    {
        path: 'invoices',
        children: [
            { path: '', component: SupplierInvoiceListComponent },
            { path: 'new', loadComponent: () => import('./components/invoice-form-dialog/invoice-form-dialog.component').then(m => m.InvoiceFormDialogComponent) },
            { path: 'edit/:id', loadComponent: () => import('./components/invoice-form-dialog/invoice-form-dialog.component').then(m => m.InvoiceFormDialogComponent) }
        ]
    },
    {
        path: 'dashboard',
        component: FinanceDashboardComponent
    },
    {
        path: 'payments',
        loadComponent: () => import('./pages/outgoing-payment-list/outgoing-payment-list.component').then(m => m.OutgoingPaymentListComponent)
    },
    {
        path: 'sales-control',
        loadComponent: () => import('../reports/sales-control-report/sales-control-report.component').then(m => m.SalesControlReportComponent)
    },
    {
        path: 'portfolio',
        loadComponent: () => import('./pages/portfolio-management/portfolio-management.component').then(m => m.PortfolioManagementComponent)
    },
    {
        path: 'caisse',
        children: [
            { path: '', loadComponent: () => import('./caisse/pages/caisse-list/caisse-list.component').then(m => m.CaisseListComponent) },
            { path: 'ouvrir', loadComponent: () => import('./caisse/pages/ouverture-caisse/ouverture-caisse.component').then(m => m.OuvertureCaisseComponent) },
            { path: 'live/:id', loadComponent: () => import('./caisse/pages/caisse-live/caisse-live.component').then(m => m.CaisseLiveComponent) },
            { path: 'cloture/:id', loadComponent: () => import('./caisse/pages/cloture-caisse/cloture-caisse.component').then(m => m.ClotureCaisseComponent) },
            { path: 'history', loadComponent: () => import('./caisse/pages/caisse-history/caisse-history.component').then(m => m.CaisseHistoryComponent) }
        ]
    },
    {
        path: 'funding-requests',
        loadComponent: () => import('./pages/funding-request-list/funding-request-list.component').then(m => m.FundingRequestListComponent)
    }
];
