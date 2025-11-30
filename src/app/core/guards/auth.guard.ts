import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { Store } from '@ngrx/store';
import { IsAuthenticatedSelector } from '../store/auth/auth.selectors';

export const AuthGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): boolean => {
  const store = inject(Store);
  const router = inject(Router);
  const dialog = inject(MatDialog);
  const toastr = inject(ToastrService);
  const isAuthenticated = store.selectSignal(IsAuthenticatedSelector);
  if (!isAuthenticated()) {
    dialog.closeAll();
    toastr.clear();
    void router.navigate(['/login'], {
      queryParams: { redirectUrl: state.url },
    });
  }
  return isAuthenticated();
};
