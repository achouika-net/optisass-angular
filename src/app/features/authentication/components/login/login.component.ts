import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from '@angular/core';
import { Field, form, pattern, required } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatError, MatInput } from '@angular/material/input';
import { ActivatedRoute, Router } from '@angular/router';
import { FieldErrorComponent } from '@app/components';
import { EMAIL_PATTERN } from '@app/config';
import { FieldControlLabelDirective } from '@app/directives';
import { IWsError } from '@app/models';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import { ResetError } from '../../../../core/store/auth/auth.actions';
import { UserErrorSelector } from '../../../../core/store/auth/auth.selectors';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    Field,
    MatFormField,
    MatInput,
    MatButton,
    MatLabel,
    FieldControlLabelDirective,
    FieldErrorComponent,
    MatError,
  ],
})
export class LoginComponent implements OnDestroy {
  readonly #store = inject(Store);
  readonly #authService = inject(AuthService);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);

  protected loginModel = signal({ email: '', password: '' });

  protected loginForm = form(this.loginModel, (fieldPath) => {
    required(fieldPath.email);
    pattern(fieldPath.email, EMAIL_PATTERN);
    required(fieldPath.password);
  });

  protected errorMessage = this.#store.selectSignal<IWsError>(UserErrorSelector);

  /**
   * Récupération de du login et mot de passe et authentification de l'utilisateur
   */
  login() {
    if (this.loginForm().invalid()) {
      return;
    }

    // MOCK: Bypass authentication and navigate directly to private layout
    console.log('🔓 MOCK LOGIN - Bypassing authentication');
    void this.#router.navigate(['/p']);

    // Real authentication (commented out)
    // const request: ILoginRequest = this.loginModel();
    // this.#store.dispatch(Login({ request }));
  }

  gotToForgotPath() {
    this.#authService.redirectToAuthPath({
      path: 'forgot',
      redirectUrl: this.#route.snapshot.queryParams['redirectUrl'],
    });
  }

  ngOnDestroy() {
    this.#store.dispatch(ResetError());
  }
}
