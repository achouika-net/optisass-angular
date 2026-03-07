import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  OnDestroy,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatError, MatInput } from '@angular/material/input';
import { FieldControlLabelDirective } from '@app/directives';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { debounceTime, interval, tap } from 'rxjs';
import { map } from 'rxjs/operators';
import { PasswordRetryTimer } from '@app/models';
import { displayRemainingTime } from '@app/helpers';
import { FormControlErrorComponent } from '@app/components';
import { AuthenticationStore } from '../../authentication.store';
import { EMAIL_PATTERN } from '@app/config';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    FieldControlLabelDirective,
    FormControlErrorComponent,
    MatError,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatInput,
    MatButton,
  ],
})
export class ForgotPasswordComponent implements OnDestroy {
  readonly #fb = inject(FormBuilder);
  readonly #authenticationStore = inject(AuthenticationStore);
  readonly #authService = inject(AuthService);
  readonly #route = inject(ActivatedRoute);
  readonly #translate = inject(TranslateService);
  protected form: FormGroup<{ email: FormControl<string> }> = this.#fb.group({
    email: ['', [Validators.required, Validators.pattern(EMAIL_PATTERN)]],
  });
  protected errorMessage = this.#authenticationStore.state.errors;
  protected successMessage = signal<string>('');
  #resetPasswordRetryTimer = this.#authenticationStore.state.resetPasswordRetryTimer;
  #emailValueChanges = toSignal(
    this.form.controls.email.valueChanges.pipe(
      tap(() => this.#resetMessages()),
      debounceTime(400)
    )
  );
  #retryTimer = linkedSignal(() =>
    this.#resetPasswordRetryTimer().find(
      (element: PasswordRetryTimer) => element.email === this.form.controls.email.value
    )
  );
  #currentTimestamp = toSignal<number>(interval(1000).pipe(map(() => Date.now())));
  protected remainingTime = computed<number>(
    () => this.#retryTimer()?.endTime - this.#currentTimestamp() || 0
  );
  protected displayRemainingTime = computed<string>(() =>
    displayRemainingTime(this.remainingTime())
  );
  constructor() {
    effect(() => {
      const typedEmail = this.#emailValueChanges();
      const resetPasswordRetryTimer = this.#resetPasswordRetryTimer();
      untracked(() => {
        this.#retryTimer.set(resetPasswordRetryTimer.find(({ email }) => email === typedEmail));
      });
    });
    effect(() => {
      const remainingTime = this.remainingTime();
      const retryTimer = this.#retryTimer();
      untracked(() => {
        if (!!retryTimer && remainingTime <= 0) {
          this.#authenticationStore.stopRetryTimer(retryTimer?.email);
          this.#authenticationStore.saveResetPasswordRetryTimer();
        }
      });
    });
  }

  /**
   * Récupération du login de réinitialisation de mot de passe et envoi de mail
   */
  forgotPassword() {
    this.#resetMessages();
    this.#authenticationStore.forgotPassword({
      email: this.form.controls.email.value,
      onSuccess: () => {
        this.successMessage.set(this.#translate.instant('authentication.forgotPasswordSuccess'));
      },
    });
  }

  /**
   * reset Messages
   */
  #resetMessages() {
    this.successMessage.set('');
    this.#authenticationStore.resetError();
  }

  /**
   * Go to Login page
   */
  goToLogin() {
    this.#authService.redirectToAuthPath({
      redirectUrl: this.#route.snapshot.queryParams['redirectUrl'],
    });
  }

  ngOnDestroy() {
    this.#resetMessages();
  }
}
