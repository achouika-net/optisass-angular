import { FormControl } from '@angular/forms';

export interface LoginFormGroup {
  email: FormControl<string>;
  password: FormControl<string>;
}
