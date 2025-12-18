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
import { LOGIN_FORM_INITIAL_VALUE, LoginFormModel } from './models/login-form.model';

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

  protected readonly loginModel = signal<LoginFormModel>(LOGIN_FORM_INITIAL_VALUE);

  protected readonly loginForm = form(this.loginModel, (fieldPath) => {
    required(fieldPath.email);
    pattern(fieldPath.email, EMAIL_PATTERN);
    required(fieldPath.password);
  });

  protected readonly errorMessage = this.#store.selectSignal<IWsError>(UserErrorSelector);

  /**
   * Soumet le formulaire de connexion et redirige l'utilisateur vers l'espace privé
   * Version MOCK actuellement active
   */
  login(): void {
    if (this.loginForm().invalid()) {
      return;
    }

    console.log('🔓 MOCK LOGIN - Bypassing authentication');
    void this.#router.navigate(['/p']);
  }

  /**
   * Redirige vers la page de récupération du mot de passe
   */
  gotToForgotPath(): void {
    this.#authService.redirectToAuthPath({
      path: 'forgot',
      redirectUrl: this.#route.snapshot.queryParams['redirectUrl'],
    });
  }

  /**
   * Nettoie les erreurs du store lors de la destruction du composant
   */
  ngOnDestroy(): void {
    this.#store.dispatch(ResetError());
  }
}
