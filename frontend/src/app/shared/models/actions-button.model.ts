import { DirectionType } from '../types';
import { PermissionTypeValues } from './permission-type.model';

export interface ActionsButton {
  label: string;
  icon?: string;
  action: string;
  color?: 'primary' | 'tertiary' | 'error';
  customColor?: string;
  direction: DirectionType;
  permissions: PermissionTypeValues[];
  url?: string;
  display?: boolean;
  disabled?: boolean;
  tooltip?: string;
  badge?: string | number;
}
