import { MenuItem } from '@app/models';

/**
 * Configuration du menu de l'application.
 * Les routes sont typées avec AppRoute (via MenuItem).
 * Les permissions sont gérées centralement dans APP_ROUTES.
 */
export const MENU: MenuItem[] = [
  {
    label: 'nav.dashboard',
    icon: 'dashboard',
    type: 'link',
    route: 'dashboard',
  },
  {
    label: 'nav.advancedSearch',
    icon: 'search',
    type: 'link',
    route: 'appointments',
  },
  {
    label: 'nav.advancedStats',
    icon: 'query_stats',
    type: 'link',
    route: 'stats',
  },
  {
    label: 'nav.commercial',
    icon: 'people',
    type: 'sub',
    children: [
      {
        label: 'nav.clients',
        icon: 'person',
        type: 'link',
        route: 'commercial/client',
      },
      {
        label: 'nav.codePromo',
        icon: 'confirmation_number',
        type: 'subchild',
        route: 'commercial/code-promo',
      },
      {
        label: 'nav.promotions',
        icon: 'loyalty',
        type: 'subchild',
        route: 'commercial/promotions',
      },
    ],
  },
  {
    label: 'nav.mailsAndSms',
    icon: 'mail',
    type: 'sub',
    children: [
      {
        label: 'nav.mailsParams',
        icon: 'settings',
        type: 'subchild',
        route: 'communication/mails/parametres',
      },
      {
        label: 'nav.mailsTemplates',
        icon: 'article',
        type: 'subchild',
        route: 'communication/mails/templates',
      },
      {
        label: 'nav.smsParams',
        icon: 'settings',
        type: 'subchild',
        route: 'communication/sms/parametres',
      },
      {
        label: 'nav.smsTemplates',
        icon: 'sms',
        type: 'subchild',
        route: 'communication/sms/templates',
      },
      {
        label: 'nav.smsStats',
        icon: 'bar_chart',
        type: 'subchild',
        route: 'communication/sms/statistiques',
      },
    ],
  },
  {
    label: 'nav.settings',
    icon: 'settings',
    type: 'sub',
    children: [
      {
        label: 'nav.users',
        icon: 'person',
        type: 'link',
        route: 'settings/users',
      },
      {
        label: 'nav.holidays',
        icon: 'calendar_month',
        type: 'link',
        route: 'settings/holiday',
      },
      {
        label: 'nav.warehouses',
        icon: 'warehouse',
        type: 'link',
        route: 'settings/warehouses',
      },
    ],
  },
  {
    label: 'nav.externalLink1',
    icon: 'credit_card',
    type: 'extLink',
    externalUrl: 'https://www.youtube.com',
  },
  {
    label: 'nav.help',
    icon: 'help_outline',
    type: 'footer',
    route: 'aide',
  },
  {
    label: 'nav.about',
    icon: 'info',
    type: 'footer',
    route: 'a-propos',
  },
];
