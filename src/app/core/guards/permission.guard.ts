import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateChildFn, CanActivateFn } from '@angular/router';
import { AuthStore } from '@app/core/store';
import { RouteAuthService } from '@app/core/services';
import { RouteData } from '@app/types';

export const PermissionCanActivateGuard: CanActivateFn = (route: ActivatedRouteSnapshot): boolean =>
  checkPermission(route);

export const PermissionCanActivateChildGuard: CanActivateChildFn = (route: ActivatedRouteSnapshot): boolean =>
  checkPermission(route);

/**
 * Vérifie si l'utilisateur a les autorisations nécessaires pour accéder à la route.
 * Si l'accès est refusé, redirige vers une route de fallback intelligente :
 * - Essaie d'abord la route par défaut du module
 * - Sinon, redirige vers la page d'accueil (/p)
 *
 * @param route - La route à vérifier
 * @returns true si l'accès est autorisé, false sinon
 */
const checkPermission = (route: ActivatedRouteSnapshot): boolean => {
  const authStore = inject(AuthStore);
  const routeAuthService = inject(RouteAuthService);

  const userAuthorizations = authStore.userAuthorizations();

  // Récupérer les autorisations requises depuis route.data (typé avec RouteData)
  const routeData = route.data as RouteData;
  const authorizationsNeeded = routeData.authorizationsNeeded ?? [];

  // Si aucune autorisation requise, accès autorisé
  if (authorizationsNeeded.length === 0) {
    return true;
  }

  // Vérifier que l'utilisateur a TOUTES les autorisations requises
  const hasAllAuthorizations = authorizationsNeeded.every((auth) => userAuthorizations.includes(auth));

  if (hasAllAuthorizations) {
    return true;
  }

  // Accès refusé → redirection vers fallback intelligent avec toast
  routeAuthService.navigateToFallback(userAuthorizations);
  return false;
};
