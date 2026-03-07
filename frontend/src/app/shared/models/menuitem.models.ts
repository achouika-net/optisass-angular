import { MenuItemType } from '@app/types';
import { AppRoute } from '@app/config';

export interface MenuItem {
  label: string;
  icon: string;
  type: MenuItemType;
  /**
   * Route de l'item, typée avec AppRoute pour garantir
   * que chaque route a une entrée dans APP_ROUTES.
   */
  route?: AppRoute;
  externalUrl?: string;
  children?: MenuItem[];
  disabled?: boolean;
}
