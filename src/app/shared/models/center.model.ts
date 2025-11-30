import { UserRole } from '@app/types';

export interface ICenter {
  active: boolean;
  address: string;
  agenda_name: string;
  center_type_id: number;
  city: string;
  email: string;
  group_id: number;
  id: number;
  migrated: boolean;
  name: string;
  numero_affaire: number;
  phone: string;
  zipcode: string;
  role_id: UserRole;
}
