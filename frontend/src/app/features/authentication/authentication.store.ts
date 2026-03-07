import { inject, Injectable } from '@angular/core';
import { IResetPasswordConfirmRequest, PasswordRetryTimer } from '@app/models';
import { IWsError, createWsErrorWithMessage, INITIAL_WS_ERROR } from '@app/models';
import { patchState, signalState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { of, pipe } from 'rxjs';
import { AuthService } from './services/auth.service';
import { catchError, exhaustMap, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { getLocalStorageItem, setLocalStorageItem } from '@app/helpers';
import { LOCAL_STORAGE_KEYS } from '@app/config';

interface AuthenticationState {
  resetPasswordRetryTimer: PasswordRetryTimer[];
  errors: IWsError | null;
}

const initialAuthenticationState: AuthenticationState = {
  resetPasswordRetryTimer:
    getLocalStorageItem(LOCAL_STORAGE_KEYS.STORE.RESET_PASSWORD_RETRY_TIMER) || [],
  errors: INITIAL_WS_ERROR,
};

@Injectable()
export class AuthenticationStore {
  readonly state = signalState(initialAuthenticationState);
  readonly #authService = inject(AuthService);
  readonly #translate = inject(TranslateService);
  readonly #toastr = inject(ToastrService);

  /**
   * Réinitialise les erreurs
   */
  resetError = (): void => {
    patchState(this.state, { errors: null });
  };

  /**
   * Sauvegarde le retry timer dans le localStorage
   */
  saveResetPasswordRetryTimer = (): void => {
    setLocalStorageItem(
      LOCAL_STORAGE_KEYS.STORE.RESET_PASSWORD_RETRY_TIMER,
      this.state.resetPasswordRetryTimer()
    );
  };

  /**
   * Démarre un timer de retry
   */
  startRetryTimer = (duration: number, email: string): void => {
    patchState(this.state, ({ resetPasswordRetryTimer }) => ({
      resetPasswordRetryTimer: [
        ...resetPasswordRetryTimer,
        {
          endTime: Date.now() + duration * 1000,
          email,
        },
      ],
    }));
  };

  /**
   * Arrête un timer de retry
   */
  stopRetryTimer = (email: string): void => {
    patchState(this.state, ({ resetPasswordRetryTimer }) => ({
      resetPasswordRetryTimer: resetPasswordRetryTimer.filter(
        (e: PasswordRetryTimer) => e.email !== email
      ),
    }));
  };

  /**
   * Envoie un email de récupération de mot de passe
   */
  forgotPassword = rxMethod<{ email: string; onSuccess: VoidFunction }>(
    pipe(
      exhaustMap(({ email, onSuccess }) =>
        this.#authService.forgotPassword(email).pipe(
          tap(() => {
            onSuccess();
          }),
          catchError((error: HttpErrorResponse) => {
            const retryAfter = error.headers.get('Retry-After');
            const duration = retryAfter ? parseInt(retryAfter, 10) : null;
            if (error.status === 429 && duration) {
              this.startRetryTimer(5000, email);
              this.saveResetPasswordRetryTimer();
            } else {
              const message = this.#translate.instant(
                error.status === 404
                  ? 'authentication.userNotFound'
                  : 'authentication.forgotResetPasswordError'
              );
              patchState(this.state, {
                errors: createWsErrorWithMessage(error, message),
              });
            }
            return of(error);
          })
        )
      )
    )
  );

  /**
   * Vérifie la validité du token de réinitialisation
   */
  verifyResetPasswordToken = rxMethod<string>(
    pipe(
      exhaustMap((token: string) =>
        this.#authService.verifyResetPasswordToken(token).pipe(
          catchError((error: HttpErrorResponse) => {
            const message = this.#translate.instant('authentication.tokenExpiredError');
            patchState(this.state, {
              errors: createWsErrorWithMessage(error, message),
            });
            return of(null).pipe(
              tap(() => this.#authService.redirectToAuthPath({ path: 'forgot' }))
            );
          })
        )
      )
    )
  );

  /**
   * Réinitialise le mot de passe
   */
  resetPassword = rxMethod<IResetPasswordConfirmRequest>(
    pipe(
      exhaustMap((request: IResetPasswordConfirmRequest) =>
        this.#authService.resetPassword(request).pipe(
          tap(() => {
            this.#toastr.success(this.#translate.instant('authentication.resetPasswordSuccess'));
            this.#authService.redirectToAuthPath();
          }),
          catchError((error: HttpErrorResponse) => {
            const message = this.#translate.instant(
              error.status === 400
                ? 'authentication.tokenExpiredError'
                : 'authentication.forgotResetPasswordError'
            );
            patchState(this.state, {
              errors: createWsErrorWithMessage(error, message),
            });
            return of(error);
          })
        )
      )
    )
  );
}
