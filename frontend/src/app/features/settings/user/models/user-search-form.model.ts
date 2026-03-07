import { FormControl } from '@angular/forms';
import { IUserSearch, UserSearch } from '.';

export interface IUserSearchForm {
  last_name: FormControl<string>;
  first_name: FormControl<string>;
  actif: FormControl<number>;
  role_id: FormControl<number>;
}

export class UserSearchForm implements IUserSearchForm {
  last_name: FormControl<string>;
  first_name: FormControl<string>;
  actif: FormControl<number>;
  role_id: FormControl<number>;
  constructor(userSearch: IUserSearch = new UserSearch()) {
    this.last_name = new FormControl(userSearch.last_name);
    this.first_name = new FormControl(userSearch.first_name);
    this.actif = new FormControl(userSearch.actif);
    this.role_id = new FormControl(userSearch.role_id);
  }
}
