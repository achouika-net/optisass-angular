import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatError, MatInput } from '@angular/material/input';
import { MatButton } from '@angular/material/button';
import { FieldControlLabelDirective } from '@app/directives';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute } from '@angular/router';
import { LoginFormGroup } from './models/login-form-group.model';
import { Login, ResetError } from '../../../../core/store/auth/auth.actions';
import { Store } from '@ngrx/store';
import { ILoginRequest, IWsError } from '@app/models';
import { UserErrorSelector } from '../../../../core/store/auth/auth.selectors';
import { FormControlErrorComponent } from '@app/components';
import { EMAIL_PATTERN } from '@app/config';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [
    TranslateModule,
    ReactiveFormsModule,
    MatFormField,
    MatInput,
    MatButton,
    MatLabel,
    FieldControlLabelDirective,
    FormControlErrorComponent,
    MatError,
  ],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnDestroy {
  readonly #store = inject(Store);
  readonly #fb = inject(FormBuilder);
  readonly #authService = inject(AuthService);
  readonly #route = inject(ActivatedRoute);
  protected loginForm: FormGroup<LoginFormGroup> = this.#fb.group({
    email: ['', [Validators.required, Validators.pattern(EMAIL_PATTERN)]],
    password: ['', Validators.required],
  });

  protected errorMessage =
    this.#store.selectSignal<IWsError>(UserErrorSelector);

  /**
   * Récupération de du login et mot de passe et authentification de l'utilisateur
   */
  login() {
    const request: ILoginRequest = {
      email: this.loginForm.controls.email.value,
      password: this.loginForm.controls.password.value,
    };
    this.#store.dispatch(Login({ request }));
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
