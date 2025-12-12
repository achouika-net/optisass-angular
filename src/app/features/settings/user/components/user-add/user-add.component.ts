import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-user-add',
  imports: [],
  template: ` <!-- <app-user-form /> --> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class UserAddComponent {}
