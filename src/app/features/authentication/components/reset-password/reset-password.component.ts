import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  OnDestroy,
  untracked,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatError, MatInput } from '@angular/material/input';
import { FieldControlLabelDirective } from '@app/directives';
import { IResetPasswordConfirmRequest } from '@app/models';
import { TranslateModule } from '@ngx-translate/core';
import { IResetPasswordFormGroupModel } from './models/reset-password-form-group.model';
import {
  validatePasswordPattern,
  validateSamePasswords,
} from '../../../../core/validators';
import { FormControlErrorComponent } from '@app/components';
import { AuthenticationStore } from '../../authentication.store';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    ReactiveFormsModule,
    FieldControlLabelDirective,
    MatFormField,
    MatInput,
    MatLabel,
    MatButton,
    MatError,
    FormControlErrorComponent,
  ],
})
export class ResetPasswordComponent implements OnDestroy {
  readonly #authenticationStore = inject(AuthenticationStore);
  readonly #fb = inject(FormBuilder);
  token = input.required<string>();
  protected form: FormGroup<IResetPasswordFormGroupModel> = this.#fb.group({
    password: ['', [Validators.required, validatePasswordPattern]],
    confirmPassword: ['', [Validators.required, validateSamePasswords]],
    token: ['', Validators.required],
  });
  protected error = this.#authenticationStore.state.errors;

  constructor() {
    effect(() => {
      const token = this.token();
      untracked(() => {
        if (token) {
          untracked(() => {
            this.form.controls.token.setValue(token);
            this.#authenticationStore.verifyResetPasswordToken(token);
          });
        }
      });
    });
  }

  /**
   * Récupération des deux mots de passe et changement du mot de passe de l'utilisateur
   */
  resetPassword() {
    const request: IResetPasswordConfirmRequest = {
      password: this.form.controls.password.value,
      password_confirmation: this.form.controls.confirmPassword.value,
      token: this.form.controls.token.value,
    };
    this.#authenticationStore.resetPassword(request);
  }

  ngOnDestroy() {
    this.#authenticationStore.resetError();
  }
}
