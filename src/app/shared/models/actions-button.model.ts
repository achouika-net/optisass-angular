import { DirectionTypeValues } from './direction-type.model';
import { PermissionTypeValues } from './permission-type.model';

export interface ActionsButton {
  libelle: string;
  icon?: string;
  action: string;
  color?: 'primary' | 'tertiary' | 'error';
  customColor?: string;
  direction: DirectionTypeValues;
  permissions: PermissionTypeValues[];
  url?: string;
  display?: boolean;
  disabled?: boolean;
  tooltip?: string;
  badge?: string | number;
}
