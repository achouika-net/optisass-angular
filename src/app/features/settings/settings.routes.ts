import { PermissionCanActivateChildGuard } from '../../core/guards/permission.guard';
import { TypedRoute } from '@app/types';

export default [
  {
    path: '',
    canActivateChild: [PermissionCanActivateChildGuard],
    children: [
      { path: '', redirectTo: 'users', pathMatch: 'full' },
      {
        path: 'users',
        data: { breadcrumb: 'breadcrumb.users' },
        loadChildren: () => import('./user/user.routes'),
        canActivateChild: [PermissionCanActivateChildGuard],
      },
    ],
  },
] satisfies TypedRoute[];
