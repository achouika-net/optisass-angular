import { UserRole } from '@app/types';

export interface ICenter {
  active: boolean;
  address: string;
  agenda_name: string;
  center_type_id: number;
  city: string;
  email: string;
  group_id: string;
  id: string;
  migrated: boolean;
  name: string;
  nom?: string;
  numero_affaire: string;
  phone: string;
  zipcode: string;
  role_id: UserRole;
}
