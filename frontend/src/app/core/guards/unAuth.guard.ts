import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CanActivateFn, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthStore } from '@app/core/store';

export const UnAuthGuard: CanActivateFn = (): boolean => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const dialog = inject(MatDialog);
  const toastr = inject(ToastrService);
  
  const isAuthenticated = authStore.isAuthenticated();
  
  if (isAuthenticated) {
    void router.navigate(['/p']);
    return false;
  }
  
  dialog.closeAll();
  toastr.clear();
  
  return !isAuthenticated;
};
