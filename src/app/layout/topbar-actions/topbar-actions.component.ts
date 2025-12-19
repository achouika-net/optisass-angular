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
import { AuthStore } from '@app/core/store';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-topbar-actions',
  templateUrl: './topbar-actions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatDividerModule, AvatarComponent],
})
export class TopbarActionsComponent {
  private readonly authStore = inject(AuthStore);
  isMobile = input.required<boolean>();
  
  user = this.authStore.user;

  /**
   * Déconnecte l'utilisateur
   */
  logout(): void {
    this.authStore.logout();
  }
}
