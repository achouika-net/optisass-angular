import { Route } from '@angular/router';
import { ResourceAuthorizations } from '@optisaas/opti-saas-lib';

/**
 * Type pour les données de route (route.data)
 * Permet de typer breadcrumb et authorizationsNeeded
 */
export interface RouteData {
  /** Clé i18n pour le breadcrumb (ex: 'breadcrumb.users') */
  breadcrumb: string;
  /** Liste des autorisations requises pour accéder à la route */
  authorizationsNeeded?: ResourceAuthorizations[];
}

/**
 * Type Route avec data typé
 * Force le typage de data avec RouteData
 */
export type TypedRoute = Omit<Route, 'data' | 'children'> & {
  data?: RouteData;
  children?: TypedRoute[];
};
