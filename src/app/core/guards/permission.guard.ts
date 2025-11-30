import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateChildFn,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { findMenuItemByUrl, userHasAccessToItem } from '@app/helpers';
import { Store } from '@ngrx/store';
import { MENU } from '../../config/menu.config';
import { UserRoleSelector } from '../store/auth/auth.selectors';

export const PermissionCanActivateGuard: CanActivateFn = (
  next: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): boolean => checkPermission(state.url);

export const PermissionCanActivateChildGuard: CanActivateChildFn = (
  next: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): boolean => checkPermission(state.url);

const checkPermission = (url: string): boolean => {
  const router = inject(Router);
  const store = inject(Store);
  const userRole = store.selectSignal(UserRoleSelector);
  if (userHasAccessToItem(findMenuItemByUrl(MENU, url), userRole())) {
    return true;
  } else {
    void router.navigate(['page-not-found']);
    return false;
  }
};
