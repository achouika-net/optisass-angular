import { FormControl } from '@angular/forms';

export interface IResetPasswordFormGroupModel {
  password: FormControl<string>;
  confirmPassword: FormControl<string>;
  token: FormControl<string>;
}
