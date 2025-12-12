import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UserService } from '../services/user.service';
import { UserStore } from '../user.store';

@Component({
  selector: 'app-user',
  imports: [RouterOutlet],
  template: ` <router-outlet /> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [UserService, UserStore],
})
export default class UserComponent {}
