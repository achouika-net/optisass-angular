import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenu, MatMenuModule } from '@angular/material/menu';
import { AuthStore } from '@app/core/store';
import { AvatarComponent } from '../../shared/components/avatar/avatar.component';

@Component({
  selector: 'app-topbar-actions',
  templateUrl: './topbar-actions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatDividerModule, AvatarComponent],
})
export class TopbarActionsComponent {
  readonly #authStore = inject(AuthStore);
  isMobile = input.required<boolean>();

  // Référence au menu pour le fermer avant logout
  userMenu = viewChild<MatMenu>('userMenu');

  // Utiliser linkedSignal pour éviter les erreurs pendant le logout
  user = linkedSignal(() => this.#authStore.user());

  /**
   * Déconnecte l'utilisateur
   */
  logout(): void {
    // Fermer le menu pour éviter les erreurs de template
    this.userMenu()?.closed.emit();

    // Utiliser setTimeout pour laisser le menu se fermer proprement
    setTimeout(() => {
      this.#authStore.logout();
    }, 50);
  }
}
