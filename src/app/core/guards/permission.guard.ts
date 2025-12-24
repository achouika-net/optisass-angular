import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateChildFn,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthStore } from '@app/core/store';
import { IClientRoute, ResourceAuthorizations } from '@optisaas/opti-saas-lib';

export const PermissionCanActivateGuard: CanActivateFn = (
  next: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): boolean => checkPermission(state.url);

export const PermissionCanActivateChildGuard: CanActivateChildFn = (
  next: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): boolean => checkPermission(state.url);

/**
 * Recherche une route dans l'arbre de navigation de manière récursive
 */
const findRouteByPath = (routes: IClientRoute[], path: string): IClientRoute | null => {
  const cleanPath = path.replace(/^\/+/, '').replace(/^p\//, '');

  for (const route of routes) {
    // Vérifier si le path correspond
    const routePath = route.path?.replace(/^\/+/, '');
    if (routePath === cleanPath) {
      return route;
    }

    // Rechercher récursivement dans les enfants
    if (route.children?.length) {
      const found = findRouteByPath(route.children, cleanPath);
      if (found) return found;
    }
  }

  return null;
};

const checkPermission = (url: string): boolean => {
  const router = inject(Router);
  const authStore = inject(AuthStore);
  const routes = authStore.navigation();
  const userPermissions = authStore.userPermissions();

  // Rechercher la route demandée
  const route = findRouteByPath(routes, url);

  // Si la route n'existe pas dans availableRoutes, accès refusé
  // (le backend a déjà filtré les routes selon les permissions globales)
  if (!route) {
    void router.navigate(['page-not-found']);
    return false;
  }

  // Double vérification : si la route nécessite des permissions spécifiques,
  // vérifier que l'utilisateur les possède toutes
  const routePermissions = (route as IClientRoute & { authorizations_needed?: ResourceAuthorizations[] }).authorizations_needed;
  if (routePermissions && routePermissions.length > 0) {
    const hasAllPermissions = routePermissions.every((permission: ResourceAuthorizations) =>
      userPermissions.includes(permission)
    );

    if (!hasAllPermissions) {
      void router.navigate(['page-not-found']);
      return false;
    }
  }

  return true;
};
