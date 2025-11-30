import { inject, Injectable } from '@angular/core';
import {
  IResetPasswordConfirmRequest,
  IWsError,
  PasswordRetryTimer,
  WsErrorClass,
} from '@app/models';
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
  errors: IWsError;
}
const initialAuthenticationState: AuthenticationState = {
  resetPasswordRetryTimer:
    getLocalStorageItem(LOCAL_STORAGE_KEYS.STORE.RESET_PASSWORD_RETRY_TIMER) || [],
  errors: new WsErrorClass(),
};
@Injectable()
export class AuthenticationStore {
  readonly state = signalState(initialAuthenticationState);
  readonly #authService = inject(AuthService);
  readonly #translate = inject(TranslateService);
  readonly #toastr = inject(ToastrService);

  /********************* UPDATERS **********************/
  resetError = () => patchState(this.state, { errors: null });
  saveResetPasswordRetryTimer = () => {
    setLocalStorageItem(
      LOCAL_STORAGE_KEYS.STORE.RESET_PASSWORD_RETRY_TIMER,
      this.state.resetPasswordRetryTimer()
    );
  };
  startRetryTimer = (duration: number, email: string) =>
    patchState(this.state, ({ resetPasswordRetryTimer }) => ({
      resetPasswordRetryTimer: [
        ...resetPasswordRetryTimer,
        {
          endTime: Date.now() + duration * 1000,
          email,
        },
      ],
    }));

  stopRetryTimer = (email: string) =>
    patchState(this.state, ({ resetPasswordRetryTimer }) => ({
      resetPasswordRetryTimer: resetPasswordRetryTimer.filter(
        (e: PasswordRetryTimer) => e.email !== email
      ),
    }));

  /********************* EFFECTS **********************/
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
              patchState(this.state, {
                errors: {
                  ...new WsErrorClass(error),
                  messageToShow: this.#translate.instant(
                    error.status === 404
                      ? 'authentication.userNotFound'
                      : 'authentication.forgotResetPasswordError'
                  ),
                },
              });
            }
            return of(error);
          })
        )
      )
    )
  );

  verifyResetPasswordToken = rxMethod<string>(
    pipe(
      exhaustMap((token: string) =>
        this.#authService.verifyResetPasswordToken(token).pipe(
          catchError((error: HttpErrorResponse) => {
            patchState(this.state, {
              errors: {
                ...new WsErrorClass(error),
                messageToShow: this.#translate.instant('authentication.tokenExpiredError'),
              },
            });
            return of(null).pipe(
              tap(() => this.#authService.redirectToAuthPath({ path: 'forgot' }))
            );
          })
        )
      )
    )
  );

  resetPassword = rxMethod<IResetPasswordConfirmRequest>(
    pipe(
      exhaustMap((request: IResetPasswordConfirmRequest) =>
        this.#authService.resetPassword(request).pipe(
          tap(() => {
            this.#toastr.success(this.#translate.instant('authentication.resetPasswordSuccess'));
            this.#authService.redirectToAuthPath();
          }),
          catchError((error: HttpErrorResponse) => {
            patchState(this.state, {
              errors: {
                ...new WsErrorClass(error),
                messageToShow:
                  error.status === 400
                    ? this.#translate.instant('authentication.tokenExpiredError')
                    : this.#translate.instant('authentication.forgotResetPasswordError'),
              },
            });
            return of(error);
          })
        )
      )
    )
  );
}
