import { Routes } from '@angular/router';
import { UserListComponent } from './user-list/user-list.component';
import { UserFormComponent } from './user-form/user-form.component';

export const userManagementRoutes: Routes = [
    {
        path: '',
        component: UserListComponent
    },
    {
        path: 'new',
        component: UserFormComponent
    },
    {
        path: ':id',
        component: UserFormComponent
    },
    {
        path: ':id/edit',
        component: UserFormComponent
    }
];
