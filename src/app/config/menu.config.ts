import { MenuItem } from '@app/models';

export const MENU: MenuItem[] = [
  {
    label: 'Tableau de bord',
    icon: 'dashboard',
    type: 'link',
    route: 'dashboard',
  },
  {
    label: 'Recherche Avancée',
    icon: 'search',
    type: 'link',
    route: 'appointments',
  },
  {
    label: 'Statistiques Avancées',
    icon: 'query_stats',
    type: 'link',
    route: 'stats',
  },
  {
    label: 'Commercial',
    icon: 'people',
    type: 'sub',
    route: 'commercial',
    children: [
      {
        label: 'Clients',
        icon: 'person',
        type: 'link',
        route: 'commercial/client',
      },
      {
        label: 'Code Promotion',
        icon: 'confirmation_number',
        type: 'subchild',
        route: 'commercial/code-promo',
      },
      {
        label: 'Promotions',
        icon: 'loyalty',
        type: 'subchild',
        route: 'commercial/promotions',
      },
    ],
  },
  {
    label: 'Mails et SMS',
    icon: 'mail',
    type: 'sub',
    children: [
      {
        label: 'Paramètres Mails',
        icon: 'settings',
        type: 'subchild',
        route: 'communication/mails/parametres',
      },
      {
        label: 'Templates Mails',
        icon: 'article',
        type: 'subchild',
        route: 'communication/mails/templates',
      },
      {
        label: 'Paramètres SMS',
        icon: 'settings',
        type: 'subchild',
        route: 'communication/sms/parametres',
      },
      {
        label: 'Templates SMS',
        icon: 'sms',
        type: 'subchild',
        route: 'communication/sms/templates',
      },
      {
        label: 'Statistiques SMS',
        icon: 'bar_chart',
        type: 'subchild',
        route: 'communication/sms/statistiques',
      },
    ],
  },
  {
    label: 'Paramétrage',
    icon: 'settings',
    type: 'sub',
    route: 'settings',
    children: [
      {
        label: 'Gestion des utilisateurs',
        icon: 'Person',
        type: 'link',
        route: 'settings/users',
      },
      {
        label: 'Congés et jours Fériés',
        icon: 'calendar_month',
        type: 'link',
        route: 'settings/holiday',
      }
    ],
  },
  {
    label: 'External Link 1',
    icon: 'credit_card',
    type: 'extLink',
    externalUrl: 'https://www.youtube.com',
  },
  {
    label: 'Aide',
    icon: 'help_outline',
    type: 'footer',
    route: 'aide',
  },
  {
    label: 'À propos',
    icon: 'info',
    type: 'footer',
    route: 'a-propos',
  },
];
