export interface IUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  civilite_id: number;
  centres: { id: number; role_id: number }[];
  actif: boolean;
  login: string;
}
