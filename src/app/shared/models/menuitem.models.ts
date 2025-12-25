import { MenuItemType } from '@app/types';

export interface MenuItem {
  label: string;
  icon: string;
  type: MenuItemType;
  route?: string;
  externalUrl?: string;
  children?: MenuItem[];
  disabled?: boolean;
}
