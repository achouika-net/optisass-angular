export interface IUserSearch {
  last_name: string;
  first_name: string;
  actif: number;
  role_id: number;
  is_export?: boolean;
}
export class UserSearch implements IUserSearch {
  constructor(
    public last_name: string = null,
    public first_name: string = null,
    public actif = -1,
    public role_id = -1,
  ) {}
}
