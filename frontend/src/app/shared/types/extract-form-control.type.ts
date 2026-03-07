import { FormGroup } from '@angular/forms';

export type FormGroupValue<T> = T extends FormGroup
  ? ReturnType<T['getRawValue']>
  : never;
