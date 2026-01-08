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
    route: 'advanced-search',
  },
  {
    label: 'Statistiques Avancées',
    icon: 'query_stats',
    type: 'link',
    route: 'stats',
    // roles: [4, 3, 2],
  },
  {
    label: 'Paiements en ligne',
    icon: 'credit_card',
    type: 'link',
    route: 'online-payments',
  },
  {
    label: 'Finance',
    icon: 'account_balance_wallet', // ou 'attach_money'
    type: 'sub',
    route: 'finance',
    children: [
      {
        label: 'Caisse',
        icon: 'point_of_sale',
        type: 'subchild',
        route: 'finance/caisse',
      },

      {
        label: 'Trésorerie',
        icon: 'savings',
        type: 'subchild',
        route: 'finance/dashboard',
      },
      {
        label: 'Contrôle des Ventes',
        icon: 'policy',
        type: 'subchild',
        route: 'finance/sales-control',
      },
      {
        label: 'Portefeuille',
        icon: 'wallet',
        type: 'subchild',
        route: 'finance/portfolio',
      },
      {
        label: "Demandes d'alimentation",
        icon: 'request_quote',
        type: 'subchild',
        route: 'finance/funding-requests',
      }
    ]
  },
  {
    label: 'Gestion de Stock',
    icon: 'inventory_2',
    type: 'sub',
    route: 'stock-management', // Keeping route generic or strictly semantic, 'logistics' was arbitrary
    children: [
      {
        label: 'Liste des produits',
        icon: 'inventory_2',
        type: 'subchild',
        route: 'stock',
      },
      {
        label: 'Mouvements de Stock',
        icon: 'swap_vert',
        type: 'subchild',
        route: 'stock/entry-v2',
      },
      {
        label: 'Historique des Entrées',
        icon: 'history',
        type: 'subchild',
        route: 'stock/history',
      },
      {
        label: 'Transferts Inter-Centres',
        icon: 'swap_horiz',
        type: 'subchild',
        route: 'stock/transfers',
      },
    ]
  },
  {
    label: 'Commercial',
    icon: 'people',
    type: 'sub',
    route: 'commercial',
    children: [
      {
        label: 'Gestion Clients',
        icon: 'edit_note',
        type: 'subchild',
        route: 'clients',
      },
      {
        label: 'Gestion Dépenses',
        icon: 'payments',
        type: 'subchild',
        route: 'finance/payments',
      },
      {
        label: 'Gestion Fournisseurs',
        icon: 'local_shipping',
        type: 'subchild',
        route: 'finance/suppliers',
      },
      {
        label: 'Gestion BL',
        icon: 'description',
        type: 'subchild',
        route: 'finance/invoices',
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
    label: 'RH & Personnel',
    icon: 'badge',
    type: 'sub',
    route: 'personnel',
    children: [
      {
        label: 'Liste du Personnel',
        icon: 'group',
        type: 'subchild',
        route: 'personnel/employees',
      },
      {
        label: 'Gestion des Salaires',
        icon: 'payments',
        type: 'subchild',
        route: 'personnel/payroll',
      },
      {
        label: 'Gestion Commissions',
        icon: 'percent',
        type: 'subchild',
        route: 'personnel/commissions',
      },
      {
        label: 'Tableau de bord RH',
        icon: 'analytics',
        type: 'subchild',
        route: 'personnel/dashboard',
      },
    ],
  },
  {
    label: 'Historique',
    icon: 'history',
    type: 'link',
    route: 'historique',
    roles: [4, 3, 2],
  },
  {
    label: 'Agendas',
    icon: 'event_note',
    type: 'link',
    route: 'agenda',
  },
  {
    label: 'Accès',
    icon: 'vpn_key',
    type: 'link',
    route: 'acces',
    roles: [4, 3],
  },
  {
    label: 'Mails et SMS',
    icon: 'mail',
    type: 'sub',
    children: [
      {
        label: 'Templates Mails',
        icon: 'article',
        type: 'subchild',
        route: 'communication/mails/templates',
        roles: [4, 3],
      },
      {
        label: 'Templates SMS',
        icon: 'sms',
        type: 'subchild',
        route: 'communication/sms/templates',
        roles: [4, 3],
      },
      {
        label: 'Statistiques SMS',
        icon: 'bar_chart',
        type: 'subchild',
        route: 'communication/sms/statistiques',
        roles: [4, 3],
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
        icon: 'people',
        type: 'subchild',
        route: 'users',
      },
      {
        label: 'Paramétrage Fidelio',
        icon: 'loyalty',
        type: 'subchild',
        route: 'settings/loyalty',
      },
      {
        label: 'Groupes & Entrepôts',
        icon: 'warehouse',
        type: 'subchild',
        route: 'groups',
      },
      {
        label: 'Gestion des Caisses',
        icon: 'point_of_sale',
        type: 'subchild',
        route: 'settings/caisses',
      },
      {
        label: 'Configuration Envoi',
        icon: 'settings',
        type: 'subchild',
        route: 'settings/marketing',
      },
      {
        label: 'Agenda contrôleur',
        icon: 'supervisor_account',
        type: 'link',
        route: 'settings/controllers',
      },
      {
        label: 'Congés et jours Fériés',
        icon: 'calendar_month',
        type: 'link',
        route: 'settings/holiday',
      },
      {
        label: 'Champs supplémentaires',
        icon: 'settings',
        type: 'subchild',
        route: 'settings/fields',
      },
      {
        label: 'Liste noire',
        icon: 'do_not_touch',
        type: 'subchild',
        route: 'settings/black-list',
      },
      {
        label: 'Configuration agenda',
        icon: 'settings',
        type: 'subchild',
        route: 'settings/configuration-agenda',
      },
    ],
  },
  {
    label: 'Modules',
    icon: 'extension',
    type: 'link',
    route: 'modules',
    roles: [4, 3],
  },
  {
    label: 'External Link 1',
    icon: 'credit_card',
    type: 'extLink',
    externalUrl: 'https://www.youtube.com',
  },
  {
    label: 'External Link 2',
    icon: 'local_offer',
    type: 'extLink',
    externalUrl: 'https://www.google.com',
  },
  {
    label: 'Mes préférences',
    icon: 'person_outline',
    type: 'footer',
    route: 'preferences',
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
