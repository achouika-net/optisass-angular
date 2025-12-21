import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthStore } from '@app/core/store';
import { AuthService } from '../authentication/services/auth.service';
import { ErrorPageData } from './models';

@Component({
  selector: 'app-error-page',
  templateUrl: './error-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatIconModule, TranslateModule],
})
export default class ErrorPageComponent {
  readonly #authStore = inject(AuthStore);
  readonly #route = inject(ActivatedRoute);
  readonly #authService = inject(AuthService);
  
  data = this.#route.snapshot.data as ErrorPageData;
  message = `authentication.${this.data?.message || 'pageNotFound'}`;
  code = this.data?.code || 404;
  isAuthenticated = this.#authStore.isAuthenticated;

  /**
   * Déconnecte l'utilisateur
   */
  logout(): void {
    this.#authStore.logout();
  }

  /**
   * Redirige vers la page de connexion
   */
  goToLogin(): void {
    this.#authService.redirectToAuthPath();
  }
}
