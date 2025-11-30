import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { IsAuthenticatedSelector } from '../../core/store/auth/auth.selectors';
import { Logout } from '../../core/store/auth/auth.actions';
import { AuthService } from '../authentication/services/auth.service';
import { ErrorPageData } from './models';
@Component({
  selector: 'app-error-page',
  templateUrl: './error-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatIconModule, TranslateModule],
})
export default class ErrorPageComponent {
  readonly #store = inject(Store);
  readonly #route = inject(ActivatedRoute);
  readonly #authService = inject(AuthService);
  data = this.#route.snapshot.data as ErrorPageData;
  message = `authentication.${this.data?.message || 'pageNotFound'}`;
  code = this.data?.code || 404;
  isAuthenticated = this.#store.selectSignal<boolean>(IsAuthenticatedSelector);

  logout(): void {
    this.#store.dispatch(Logout({}));
  }

  goToLogin(): void {
    this.#authService.redirectToAuthPath();
  }
}
