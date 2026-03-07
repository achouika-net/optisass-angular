import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { AuthStore } from '@app/core/store';

/**
 * Guard d'authentification.
 * Note: La restauration de session est gérée par provideAppInitializer avant le bootstrap,
 * donc le guard s'exécute toujours après que la session soit restaurée.
 */
export const AuthGuard: CanActivateFn = (
  _route,
  state: RouterStateSnapshot
): boolean => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const dialog = inject(MatDialog);
  const toastr = inject(ToastrService);
  if (authStore.isAuthenticated()) {
    return true;
  }

  // Pas authentifié → redirect login
  dialog.closeAll();
  toastr.clear();
  void router.navigate(['/login'], {
    queryParams: { redirectUrl: state.url },
  });
  return false;
};
