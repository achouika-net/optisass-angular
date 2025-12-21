import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthStore } from '@app/core/store';

export const AuthGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): boolean => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const dialog = inject(MatDialog);
  const toastr = inject(ToastrService);
  
  const isAuthenticated = authStore.isAuthenticated();
  
  if (!isAuthenticated) {
    dialog.closeAll();
    toastr.clear();
    void router.navigate(['/login'], {
      queryParams: { redirectUrl: state.url },
    });
  }
  
  return isAuthenticated;
};
