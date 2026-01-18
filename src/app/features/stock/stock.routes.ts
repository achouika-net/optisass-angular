import { PermissionCanActivateChildGuard } from '../../core/guards/permission.guard';
import { TypedRoute } from '@app/types';

export default [
  {
    path: '',
    canActivateChild: [PermissionCanActivateChildGuard],
    children: [
      { path: '', redirectTo: 'products', pathMatch: 'full' },
      {
        path: 'products',
        data: { breadcrumb: 'nav.products' },
        loadChildren: () => import('./product/product.routes'),
        canActivateChild: [PermissionCanActivateChildGuard],
      },
      {
        path: 'alimentation',
        data: { breadcrumb: 'nav.stock_alimentation' },
        loadChildren: () =>
          import('./alimentation/alimentation.routes').then((m) => m.ALIMENTATION_ROUTES),
      },
    ],
  },
] satisfies TypedRoute[];
