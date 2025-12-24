import { IClientRoute } from '@optisaas/opti-saas-lib';

/**
 * Mock temporaire simplifié des options de navigation client
 * TODO: À supprimer quand l'API backend GET /client/options sera disponible
 *
 * Version simplifiée pour tests initiaux
 */
export const MOCK_NAVIGATION_OPTIONS: IClientRoute[] = [
  {
    id: 'dashboard',
    label: 'Tableau de bord',
    type: 'link',
    path: 'dashboard',
    authorizations_needed: [],
  },
  {
    id: 'stats',
    label: 'Statistiques Avancées',
    type: 'link',
    path: 'stats',
    authorizations_needed: [],
  },
  {
    id: 'commercial',
    label: 'Commercial',
    type: 'collapse',
    icon: 'people',
    children: [
      {
        id: 'commercial-client',
        label: 'Clients',
        type: 'link',
        path: 'commercial/client',
        authorizations_needed: ['CLIENTS_READ'],
      },
      {
        id: 'commercial-promotions',
        label: 'Promotions',
        type: 'link',
        path: 'commercial/promotions',
        authorizations_needed: [],
      },
    ],
  },
  {
    id: 'settings',
    label: 'Paramétrage',
    type: 'collapse',
    icon: 'settings',
    children: [
      {
        id: 'settings-users',
        label: 'Gestion des utilisateurs',
        type: 'link',
        path: 'settings/users',
        authorizations_needed: ['USERS_READ'],
      },
    ],
  },
  {
    id: 'external-link-2',
    label: 'External Link 2',
    type: 'collapse-link',
    path: 'https://www.google.com',
    authorizations_needed: [],
  },
  {
    id: 'a-propos',
    label: 'À propos',
    type: 'link',
    path: 'a-propos',
    authorizations_needed: [],
  },
  // Route de test : nécessite une permission que l'utilisateur n'a PAS
  {
    id: 'admin-test',
    label: 'Administration (TEST)',
    type: 'link',
    path: 'admin-test',
    authorizations_needed: ['USERS_DELETE'], // Permission non accordée dans le mock
  },
];
