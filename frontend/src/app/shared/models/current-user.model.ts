import { ITenant } from './tenant.model';

export interface ICurrentUser {
  id: string;              // UUID
  email: string;
  firstName: string;
  lastName: string;
  isOwner: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  tenants: ITenant[];      // Remplace "tenants"

  // Propriétés optionnelles (pas encore dans le backend NestJS)
  avatar?: string;         // Base64 image
  is_callcenter?: boolean; // Legacy field
}

export type CurrentUserState = ICurrentUser | null;

export const INITIAL_CURRENT_USER: CurrentUserState = null;

/**
 * Vérifie si l'utilisateur est valide et non-null
 * @param user - L'utilisateur à vérifier
 * @returns true si l'utilisateur est valide, false sinon
 */
export function isValidUser(user: CurrentUserState): user is ICurrentUser {
  return user !== null && typeof user.id === 'string' && user.id.length > 0;
}
