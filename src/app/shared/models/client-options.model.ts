import { IClientRoute, ResourceAuthorizations } from '@optisaas/opti-saas-lib';

/**
 * Réponse de l'API GET /client/options
 * Contient les routes de navigation et les permissions de l'utilisateur
 */
export interface IClientOptions {
  /**
   * Routes de navigation filtrées selon les permissions de l'utilisateur
   */
   routes: IClientRoute[];

  /**
   * Liste des permissions/autorisations de l'utilisateur
   */
  userPermissions: ResourceAuthorizations[];
  // authorizations: ResourceAuthorizations[];
}
