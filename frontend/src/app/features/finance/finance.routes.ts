import { Routes } from '@angular/router';
import { SupplierListComponent } from './pages/supplier-list/supplier-list.component';
import { ExpenseListComponent } from './pages/expense-list/expense-list.component';
import { SupplierInvoiceListComponent } from './pages/supplier-invoice-list/supplier-invoice-list.component';
import { FinanceDashboardComponent } from './pages/finance-dashboard/finance-dashboard.component';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'expenses',
        pathMatch: 'full'
    },
    {
        path: 'suppliers',
        component: SupplierListComponent
    },
    {
        path: 'expenses',
        component: ExpenseListComponent
    },
    {
        path: 'invoices',
        component: SupplierInvoiceListComponent
    },
    {
        path: 'dashboard',
        component: FinanceDashboardComponent
    }
];
