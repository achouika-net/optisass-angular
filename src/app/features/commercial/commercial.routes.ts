import { PermissionCanActivateChildGuard } from '../../core/guards/permission.guard';
import { TypedRoute } from '@app/types';

export default [
  {
    path: '',
    canActivateChild: [PermissionCanActivateChildGuard],
    children: [
      { path: '', redirectTo: 'client', pathMatch: 'full' },
      {
        path: 'client',
        data: { breadcrumb: 'nav.clients' },
        loadChildren: () => import('./client/client.routes'),
        canActivateChild: [PermissionCanActivateChildGuard],
      },
      {
        path: 'stock',
        data: { breadcrumb: 'nav.stock' },
        loadChildren: () => import('./stock/stock.routes'),
        canActivateChild: [PermissionCanActivateChildGuard],
      },
    ],
  },
] satisfies TypedRoute[];
