import { ICenter } from './center.model';

export interface ICurrentUser {
  id: number;
  first_name: string;
  last_name: string;
  address: string;
  mobile: string;
  email: string;
  is_callcenter: boolean;
  remember_token: string;
  menu_favoris: string;
  centers: ICenter[];
  avatar?: string | null;
}

export type CurrentUserState = ICurrentUser | null;

export const INITIAL_CURRENT_USER: CurrentUserState = null;

/**
 * Vérifie si l'utilisateur est valide et non-null
 * @param user - L'utilisateur à vérifier
 * @returns true si l'utilisateur est valide, false sinon
 */
export function isValidUser(user: CurrentUserState): user is ICurrentUser {
  return user !== null && typeof user.id === 'number' && user.id > 0;
}
