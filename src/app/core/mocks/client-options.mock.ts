import { IClientOptions } from '@app/models';
import { MOCK_NAVIGATION_OPTIONS } from './navigation-options.mock';

/**
 * Mock des options client complètes (navigation + permissions)
 * TODO: À supprimer quand l'API backend GET /client/options sera disponible
 */
export const MOCK_CLIENT_OPTIONS: IClientOptions = {
  routes: MOCK_NAVIGATION_OPTIONS,
  userPermissions: [
    'CLIENTS_READ',
    'USERS_READ',
    'USERS_CREATE',
    'USERS_UPDATE',
  ],
};
