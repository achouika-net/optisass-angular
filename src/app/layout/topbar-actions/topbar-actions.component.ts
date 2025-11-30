import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Store } from '@ngrx/store';
import { Logout } from '../../core/store/auth/auth.actions';

@Component({
  selector: 'app-topbar-actions',
  templateUrl: './topbar-actions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatDivider],
})
export class TopbarActionsComponent {
  private readonly store = inject(Store);
  isMobile = input.required<boolean>();

  logout() {
    this.store.dispatch(Logout({}));
  }
}
