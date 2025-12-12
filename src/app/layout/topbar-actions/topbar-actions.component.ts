import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Store } from '@ngrx/store';
import { Logout } from '../../core/store/auth/auth.actions';
import { UserSelector } from '../../core/store/auth/auth.selectors';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-topbar-actions',
  templateUrl: './topbar-actions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatDividerModule, AvatarComponent],
})
export class TopbarActionsComponent {
  private readonly store = inject(Store);
  isMobile = input.required<boolean>();
  
  user = this.store.selectSignal(UserSelector);

  logout() {
    this.store.dispatch(Logout({}));
  }
}
