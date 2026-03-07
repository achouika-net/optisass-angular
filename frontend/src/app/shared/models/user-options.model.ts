import { ResourceAuthorizations } from '@optisaas/opti-saas-lib';

/**
 * Réponse de l'API GET /auth/options
 * Contient uniquement les autorisations de l'utilisateur
 * Les routes de navigation sont gérées statiquement via menu.config.ts
 */
export interface IUserOptions {
  /**
   * Liste des autorisations de l'utilisateur
   */
  authorizations: ResourceAuthorizations[];
}
