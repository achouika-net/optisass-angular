import { Routes } from '@angular/router';
import { EmployeeListComponent } from './employee-list/employee-list.component';
import { EmployeeFormComponent } from './employee-form/employee-form.component';
import { PayrollManagerComponent } from './payroll-manager/payroll-manager.component';
import { HRDashboardComponent } from './hr-dashboard/hr-dashboard.component';

export const personnelManagementRoutes: Routes = [
    {
        path: '',
        redirectTo: 'employees',
        pathMatch: 'full'
    },
    {
        path: 'employees',
        component: EmployeeListComponent
    },
    {
        path: 'employees/new',
        component: EmployeeFormComponent
    },
    {
        path: 'employees/:id/edit',
        component: EmployeeFormComponent
    },
    {
        path: 'payroll',
        component: PayrollManagerComponent
    },
    {
        path: 'dashboard',
        component: HRDashboardComponent
    }
];
