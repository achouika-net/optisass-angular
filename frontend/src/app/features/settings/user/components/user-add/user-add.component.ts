import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UserFormComponent } from '../user-form/user-form.component';

@Component({
  selector: 'app-user-add',
  imports: [UserFormComponent],
  template: ` <app-user-form /> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class UserAddComponent {}
