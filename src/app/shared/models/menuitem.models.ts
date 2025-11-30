import { MenuItemType, UserRole } from '@app/types';

export interface MenuItem {
  label: string;
  icon: string;
  type: MenuItemType;
  route?: string;
  externalUrl?: string;
  children?: MenuItem[];
  roles?: UserRole[];
  disabled?: boolean;
}
