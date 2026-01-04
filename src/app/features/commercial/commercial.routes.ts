import { PermissionCanActivateChildGuard } from '../../core/guards/permission.guard';
import { TypedRoute } from '@app/types';

export default [
  {
    path: '',
    canActivateChild: [PermissionCanActivateChildGuard],
    children: [
      { path: '', redirectTo: 'stock', pathMatch: 'full' },
      {
        path: 'stock',
        data: { breadcrumb: 'nav.stock' },
        loadChildren: () => import('./stock/stock.routes'),
        canActivateChild: [PermissionCanActivateChildGuard],
      },
    ],
  },
] satisfies TypedRoute[];
