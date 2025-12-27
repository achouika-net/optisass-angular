import { MenuItemType } from '@app/types';
import { ResourceAuthorizations } from '@optisaas/opti-saas-lib';

export interface MenuItem {
  label: string;
  icon: string;
  type: MenuItemType;
  route?: string;
  externalUrl?: string;
  children?: MenuItem[];
  disabled?: boolean;
  /**
   * Permissions requises pour afficher cet item.
   * Si non défini ou vide, l'item est visible par tous les utilisateurs authentifiés.
   * L'utilisateur doit avoir TOUTES les permissions listées (logique AND).
   */
  authorizationsNeeded?: ResourceAuthorizations[];
}
