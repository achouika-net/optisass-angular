import { Route } from '@angular/router';
import { PermissionCanActivateGuard } from '../../core/guards/permission.guard';

export default [
  {
    path: '',
    canActivate: [PermissionCanActivateGuard],
    children: [
      { path: '', redirectTo: 'users', pathMatch: 'full' },
      {
        path: 'users',
        loadChildren: () => import('./user/user.routes'),
      },
    ],
  },
] as Route[];
