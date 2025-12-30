import { ResourceAuthorizations } from '@optisaas/opti-saas-lib';

/**
 * Configuration centralisée de toutes les routes de l'application.
 * SOURCE UNIQUE DE VÉRITÉ pour les routes et leurs permissions.
 *
 * - Chaque route doit avoir une entrée ici
 * - [] = accessible à tous les utilisateurs authentifiés
 * - TypeScript force l'ajout de toute nouvelle route (via AppRoute)
 */
export const APP_ROUTES = {
  // ===== MENU PRINCIPAL =====
  dashboard: ['SUPPLIERS_CREATE'],
  appointments: [],
  stats: [],
  'commercial/client': ['CLIENTS_READ'],
  'commercial/code-promo': [],
  'commercial/promotions': [],
  'communication/mails/parametres': [],
  'communication/mails/templates': [],
  'communication/sms/parametres': [],
  'communication/sms/templates': [],
  'communication/sms/statistiques': [],
  'settings/users': ['USERS_READ'],
  'settings/holiday': [],
  aide: [],
  'a-propos': [],
  'settings/users/add': ['USERS_CREATE'],
  'settings/users/:id': ['USERS_READ'],
  'settings/warehouses': [],
  'settings/warehouses/add': [],
  'settings/warehouses/:id': [],
} as const satisfies Record<string, readonly ResourceAuthorizations[]>;

/**
 * Type union de toutes les routes de l'application.
 * Utilisé pour typer MenuItem.route et garantir la cohérence.
 */
export type AppRoute = keyof typeof APP_ROUTES;

/**
 * Récupère les permissions requises pour une route donnée.
 * @param route - La route (doit être une clé de APP_ROUTES)
 * @returns Les permissions requises (tableau vide si accessible à tous)
 */
export function getRoutePermissions(route: AppRoute): readonly ResourceAuthorizations[] {
  return APP_ROUTES[route];
}

/**
 * Vérifie si une route existe dans la configuration.
 * Utile pour les guards et le type narrowing.
 */
export function isValidAppRoute(route: string): route is AppRoute {
  return route in APP_ROUTES;
}
