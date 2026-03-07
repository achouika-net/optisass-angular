import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UserStore } from '../user.store';

@Component({
  selector: 'app-user',
  imports: [RouterOutlet],
  template: ` <router-outlet /> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [UserStore],
})
export default class UserComponent {}
