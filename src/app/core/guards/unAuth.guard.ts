import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { ToastrService } from 'ngx-toastr';
import { IsAuthenticatedSelector } from '../store/auth/auth.selectors';

export const UnAuthGuard: CanActivateFn = (): boolean => {
  const store = inject(Store);
  const router = inject(Router);
  const dialog = inject(MatDialog);
  const toastr = inject(ToastrService);
  const isAuthenticated = store.selectSignal<boolean>(IsAuthenticatedSelector);
  if (isAuthenticated()) {
    void router.navigate(['/p']);
    return false;
  }
  dialog.closeAll();
  toastr.clear();
  return !isAuthenticated();
};
