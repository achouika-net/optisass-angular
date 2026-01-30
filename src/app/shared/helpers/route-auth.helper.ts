import { ResourceAuthorizations } from '@app/models';
import { APP_ROUTES, isValidAppRoute } from '@app/config';

/**
 * Vérifie si l'utilisateur a toutes les permissions requises pour une route.
 * Les permissions sont récupérées depuis APP_ROUTES (source unique de vérité).
 *
 * @param route - La route à vérifier (format APP_ROUTES: 'settings/users')
 * @param userAuthorizations - Les permissions de l'utilisateur
 * @returns true si l'utilisateur a toutes les permissions requises
 *
 * @example
 * isRouteAuthorized('settings/users', ['USERS_READ']) // true
 * isRouteAuthorized('settings/users', []) // false
 * isRouteAuthorized('appointments', []) // true (pas de permission requise)
 */
export function isRouteAuthorized(
  route: string | undefined,
  userAuthorizations: ResourceAuthorizations[],
): boolean {
  // Pas de route = accessible à tous (ex: extLink)
  if (!route) return true;

  // Route non configurée dans APP_ROUTES = accessible à tous
  if (!isValidAppRoute(route)) return true;

  const required = APP_ROUTES[route];

  // Pas de permission requise = accessible à tous
  if (!required.length) return true;

  // L'utilisateur doit avoir TOUTES les permissions requises
  return required.every((auth) => userAuthorizations.includes(auth as ResourceAuthorizations));
}

/**
 * Normalise une URL Angular vers une clé APP_ROUTES.
 * Cherche la route correspondante dans APP_ROUTES en matchant les segments dynamiques.
 *
 * @param url - L'URL courante (ex: '/p/settings/users/123')
 * @returns La clé APP_ROUTES correspondante (ex: 'settings/users/:id') ou null si invalide
 *
 * @example
 * normalizeUrlToAppRoute('/p/settings/users/123') // 'settings/users/:id'
 * normalizeUrlToAppRoute('/p/settings/users') // 'settings/users'
 * normalizeUrlToAppRoute('/p/dashboard') // 'dashboard'
 */
export function normalizeUrlToAppRoute(url: string): string | null {
  if (!url) return null;

  // Supprimer le préfixe '/p/' et les query params
  let path = url.split('?')[0];
  path = path.replace(/^\/p\//, '').replace(/^\//, '');

  if (!path) return null;

  // Chercher une route correspondante dans APP_ROUTES
  return findMatchingAppRoute(path);
}

/**
 * Cherche dans APP_ROUTES la route qui correspond au path donné.
 * Supporte les paramètres dynamiques avec n'importe quel nom (:id, :userId, :orderId, etc.)
 *
 * @param path - Le path sans préfixe (ex: 'settings/users/123')
 * @returns La clé APP_ROUTES correspondante ou null
 */
function findMatchingAppRoute(path: string): string | null {
  const pathSegments = path.split('/');
  const appRoutes = Object.keys(APP_ROUTES);

  // Chercher une route exacte d'abord
  if (isValidAppRoute(path)) {
    return path;
  }

  // Chercher une route avec paramètres dynamiques
  for (const route of appRoutes) {
    if (routeMatchesPath(route, pathSegments)) {
      return route;
    }
  }

  return null;
}

/**
 * Vérifie si une route APP_ROUTES correspond au path donné.
 * Les segments commençant par ':' matchent n'importe quelle valeur.
 */
function routeMatchesPath(route: string, pathSegments: string[]): boolean {
  const routeSegments = route.split('/');

  if (routeSegments.length !== pathSegments.length) {
    return false;
  }

  return routeSegments.every((routeSegment, index) => {
    // Segment dynamique (ex: :id, :userId) → match tout
    if (routeSegment.startsWith(':')) {
      return true;
    }
    // Segment statique → doit être identique
    return routeSegment === pathSegments[index];
  });
}

/**
 * Obtient la route par défaut du module (sans les paramètres dynamiques).
 * Utilisé pour trouver le fallback quand l'utilisateur perd accès à une route avec param.
 *
 * @param appRoute - La route APP_ROUTES (ex: 'settings/users/:id', 'clients/:clientId')
 * @returns La route module (ex: 'settings/users', 'clients')
 *
 * @example
 * getModuleDefaultRoute('settings/users/:id') // 'settings/users'
 * getModuleDefaultRoute('settings/users/:userId') // 'settings/users'
 * getModuleDefaultRoute('settings/users/add') // 'settings/users'
 * getModuleDefaultRoute('settings/users') // 'settings'
 * getModuleDefaultRoute('dashboard') // ''
 */
export function getModuleDefaultRoute(appRoute: string): string {
  const segments = appRoute.split('/');

  // Supprimer le dernier segment (param dynamique ou segment final)
  segments.pop();

  return segments.join('/');
}

/**
 * Calcule la route de fallback quand l'utilisateur n'a pas accès à la route courante.
 * Remonte dans la hiérarchie des routes jusqu'à trouver une route autorisée.
 *
 * @param currentUrl - L'URL courante (ex: '/p/settings/users/123')
 * @param userAuthorizations - Les nouvelles permissions de l'utilisateur
 * @returns La route de fallback (ex: '/p/settings') ou null si la route courante est autorisée
 *
 * @example
 * // Utilisateur sur /p/settings/users/123, perd USERS_READ
 * calculateFallbackRoute('/p/settings/users/123', []) // '/p/settings'
 *
 * // Utilisateur sur /p/settings/users/123, garde USERS_READ
 * calculateFallbackRoute('/p/settings/users/123', ['USERS_READ']) // null
 */
export function calculateFallbackRoute(
  currentUrl: string,
  userAuthorizations: ResourceAuthorizations[],
): string | null {
  const appRoute = normalizeUrlToAppRoute(currentUrl);

  // URL invalide → pas de fallback
  if (!appRoute) return null;

  // Route courante autorisée → pas de fallback
  if (isRouteAuthorized(appRoute, userAuthorizations)) {
    return null;
  }

  // Remonter dans la hiérarchie des routes
  let parentRoute = getModuleDefaultRoute(appRoute);

  while (parentRoute) {
    // Vérifier si la route parent est autorisée
    if (isRouteAuthorized(parentRoute, userAuthorizations)) {
      return `/p/${parentRoute}`;
    }

    // Remonter d'un niveau
    parentRoute = getModuleDefaultRoute(parentRoute);
  }

  // Fallback ultime : page d'accueil authentifiée
  return '/p';
}
