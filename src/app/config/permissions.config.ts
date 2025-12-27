import { ResourceAuthorizations } from '@optisaas/opti-saas-lib';

/**
 * Mapping centralisé des routes vers leurs permissions requises.
 * Utilisé par les routes (guards) et le menu (filtrage).
 * Single source of truth pour éviter la duplication.
 */
export const ROUTE_PERMISSIONS: Record<string, ResourceAuthorizations[]> = {
  // Dashboard - accessible à tous les utilisateurs authentifiés
  'dashboard': ["SUPPLIERS_CREATE"],

  // Recherche avancée
  // 'appointments': ['APPOINTMENTS_READ'],

  // Statistiques
  // 'stats': ['STATS_READ'],

  // Commercial
  'commercial/client': ['CLIENTS_READ'],
  // 'commercial/code-promo': ['PROMOTIONS_READ'],
  // 'commercial/promotions': ['PROMOTIONS_READ'],

  // Communication - Mails
  // 'communication/mails/parametres': ['MAILS_READ'],
  // 'communication/mails/templates': ['MAILS_READ'],

  // Communication - SMS
  // 'communication/sms/parametres': ['SMS_READ'],
  // 'communication/sms/templates': ['SMS_READ'],
  // 'communication/sms/statistiques': ['SMS_READ'],

  // Paramétrage - Users
  'settings/users': ['USERS_READ'],
  'settings/users/add': ['USERS_CREATE'],
  'settings/users/:id': ['USERS_READ'],

  // Paramétrage - Holidays
  // 'settings/holiday': ['HOLIDAYS_READ'],
};
