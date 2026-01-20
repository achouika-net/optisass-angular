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
        path: 'entry',
        data: { breadcrumb: 'nav.stockEntry' },
        loadChildren: () =>
          import('./stock-entry/stock-entry.routes').then((m) => m.STOCK_ENTRY_ROUTES),
      },
    ],
  },
] satisfies TypedRoute[];
