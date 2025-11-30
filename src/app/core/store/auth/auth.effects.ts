import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { LOCAL_STORAGE_KEYS } from '@app/config';
import { isLoginUrl, removeLocalStorageItem } from '@app/helpers';
import { ICurrentUser, IJwtTokens, IWsError, WsErrorClass } from '@app/models';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { catchError, exhaustMap, finalize, map, tap, withLatestFrom } from 'rxjs/operators';
import { AuthService } from '../../../features/authentication/services/auth.service';
import { refreshTokenSubject } from '../../interceptors/jwt.interceptor';
import { selectCurrentUrl } from '../router/router.selector';
import {
  GetCurrentUser,
  GetCurrentUserError,
  GetCurrentUserSuccess,
  GetUserOptions,
  InitializeAuthState,
  Login,
  LoginError,
  LoginSuccess,
  Logout,
  RefreshToken,
  RefreshTokenError,
  RefreshTokenSuccess,
  SetCurrentCenter,
  SetRefreshTokenInProgress,
} from './auth.actions';
import { UserSelector } from './auth.selectors';

@Injectable()
export class AuthEffects {
  readonly #actions$ = inject<Actions>(Actions);
  readonly #store = inject(Store);
  readonly #router = inject(Router);
  readonly #authService = inject(AuthService);
  readonly #translate = inject(TranslateService);

  logout$ = createEffect(() =>
    this.#actions$.pipe(
      ofType(Logout),
      map((action) => {
        const currentUrl = this.#store.selectSignal(selectCurrentUrl)();
        removeLocalStorageItem(LOCAL_STORAGE_KEYS.STORE.AUTH);
        removeLocalStorageItem(LOCAL_STORAGE_KEYS.STORE.SETTINGS);
        removeLocalStorageItem(LOCAL_STORAGE_KEYS.APP.NAVIGATION_HISTORY);
        if (!isLoginUrl(currentUrl)) {
          const hasRedirect = action?.redirect && !currentUrl.includes('redirectUrl');

          this.#authService.redirectToAuthPath({
            redirectUrl: hasRedirect ? currentUrl : undefined,
          });
        }
        return InitializeAuthState();
      })
    )
  );

  login$ = createEffect(() => {
    return this.#actions$.pipe(
      ofType(Login),
      exhaustMap((action) =>
        this.#authService.login(action.request).pipe(
          map((jwtTokens: IJwtTokens) => {
            this.#store.dispatch(LoginSuccess({ jwtTokens }));
            return GetCurrentUser();
          }),
          catchError((error: HttpErrorResponse) => {
            const iWsError: IWsError = new WsErrorClass(error);
            const message =
              iWsError.status === 401
                ? 'authentication.loginError'
                : 'authentication.unexpectedLoginError';
            return of(
              LoginError({
                errors: {
                  ...iWsError,
                  messageToShow: this.#translate.instant(message),
                },
              })
            );
          })
        )
      )
    );
  });
  getCurrentUser$ = createEffect(() =>
    this.#actions$.pipe(
      ofType(GetCurrentUser),
      exhaustMap(() =>
        this.#authService.getCurrentUser().pipe(
          map((user: ICurrentUser) => {
            void this.#router.navigate(['/p']);
            const currentCenter = user.centers.filter((c) => c.active)[0];
            this.#store.dispatch(GetCurrentUserSuccess({ user }));
            return SetCurrentCenter({ currentCenter });
          }),
          catchError((error: HttpErrorResponse) => {
            return of(
              GetCurrentUserError({
                errors: {
                  ...new WsErrorClass(error),
                  messageToShow: this.#translate.instant('authentication.getCurrentUserError'),
                },
              })
            );
          })
        )
      )
    )
  );

  RefreshTokenEffect = createEffect(() =>
    this.#actions$.pipe(
      ofType(RefreshToken),
      tap(() =>
        this.#store.dispatch(
          SetRefreshTokenInProgress({
            refreshTokenInProgress: true,
          })
        )
      ),
      exhaustMap((action) =>
        this.#authService.refreshToken(action.refresh_token).pipe(
          map((jwtTokens: IJwtTokens) => {
            refreshTokenSubject.next(jwtTokens.token);
            return RefreshTokenSuccess({ jwtTokens });
          }),
          catchError((error: HttpErrorResponse) => {
            this.#store.dispatch(Logout({ redirect: true }));
            refreshTokenSubject.next(null);
            return of(
              RefreshTokenError({
                errors: {
                  ...new WsErrorClass(error),
                  messageToShow: this.#translate.instant('authentication.refreshTokenError'),
                },
              })
            );
          }),
          finalize(() => {
            this.#store.dispatch(
              SetRefreshTokenInProgress({
                refreshTokenInProgress: false,
              })
            );
          })
        )
      )
    )
  );

  setCurrentCenter$ = createEffect(() =>
    this.#actions$.pipe(
      ofType(SetCurrentCenter),
      withLatestFrom(this.#store.select(UserSelector)),
      map(([action, user]) =>
        GetUserOptions({
          userId: user.id,
          triggerNavigation: action.isManualChange || false,
        })
      )
    )
  );
}
