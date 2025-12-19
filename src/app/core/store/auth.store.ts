import { computed, effect, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { pipe, switchMap, tap } from 'rxjs';
import {
  createWsErrorWithMessage,
  CurrentUserState,
  ICenter,
  ICurrentUser,
  IJwtTokens,
  ILoginRequest,
  INITIAL_CURRENT_USER,
  INITIAL_JWT_TOKENS,
  INITIAL_WS_ERROR,
  isValidUser,
  JwtTokensState,
  WsErrorState,
} from '@app/models';
import { AuthService } from '../../features/authentication/services/auth.service';
import { StatePersistenceService } from '../services';
import { refreshTokenSubject, cancelAllPendingRequests } from '../interceptors/jwt.interceptor';

interface AuthState {
  jwtTokens: JwtTokensState;
  user: CurrentUserState;
  currentCenter: ICenter | null;
  error: WsErrorState;
  refreshTokenInProgress: boolean;
}

const initialState: AuthState = {
  jwtTokens: INITIAL_JWT_TOKENS,
  user: INITIAL_CURRENT_USER,
  currentCenter: null,
  error: INITIAL_WS_ERROR,
  refreshTokenInProgress: false,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed((store) => ({
    isAuthenticated: computed(
      () => isValidUser(store.user()) && store.jwtTokens() !== null && !!store.jwtTokens()?.token
    ),
    userRole: computed(() => store.currentCenter()?.role_id ?? null),
    tenant: computed(() => store.currentCenter()?.numero_affaire ?? null),
    menuFavoris: computed(() => store.user()?.menu_favoris ?? null),
    userCenters: computed(() => store.user()?.centers ?? []),
  })),

  withMethods(
    (
      store,
      authService = inject(AuthService),
      router = inject(Router),
      translate = inject(TranslateService)
    ) => ({
      /**
       * Authentifie l'utilisateur avec email et mot de passe
       * @param request - Les identifiants de connexion (email et password)
       * @returns Observable qui émet lors de la réussite ou l'échec de l'authentification
       */
      login: rxMethod<ILoginRequest>(
        pipe(
          tap(() => patchState(store, { error: null })),
          switchMap((request) =>
            authService.login(request).pipe(
              tapResponse({
                next: (jwtTokens: IJwtTokens) => {
                  patchState(store, { jwtTokens, error: null });
                  methods.getCurrentUser();
                },
                error: (error: HttpErrorResponse) => {
                  const message =
                    error.status === 401
                      ? translate.instant('authentication.loginError')
                      : translate.instant('authentication.unexpectedLoginError');

                  patchState(store, {
                    error: createWsErrorWithMessage(error, message),
                  });
                },
              })
            )
          )
        )
      ),

      /**
       * Déconnecte l'utilisateur et redirige vers la page de connexion
       * @param redirect - Indique si une redirection vers la page de connexion doit être effectuée (défaut: true)
       */
      logout(redirect = true): void {
        patchState(store, initialState);

        if (redirect) {
          const currentUrl = router.url;
          const shouldRedirect = !currentUrl.includes('/auth/login');

          if (shouldRedirect) {
            authService.redirectToAuthPath({
              redirectUrl: !currentUrl.includes('redirectUrl') ? currentUrl : undefined,
            });
          }
        }
      },

      /**
       * Récupère les informations de l'utilisateur connecté
       * @returns Observable qui émet les informations utilisateur
       */
      getCurrentUser: rxMethod<void>(
        pipe(
          switchMap(() =>
            authService.getCurrentUser().pipe(
              tapResponse({
                next: (user: ICurrentUser) => {
                  const currentCenter =
                    user.centers.find((c: ICenter) => c.active) ?? user.centers[0];

                  patchState(store, {
                    user,
                    currentCenter,
                    error: null,
                  });

                  void router.navigate(['/p']);
                },
                error: (error: HttpErrorResponse) => {
                  patchState(store, {
                    error: createWsErrorWithMessage(
                      error,
                      translate.instant('authentication.getCurrentUserError')
                    ),
                  });
                },
              })
            )
          )
        )
      ),

      /**
       * Rafraîchit le token JWT
       * @param refresh_token - Le refresh token à utiliser pour obtenir un nouveau token
       * @returns Observable qui émet le nouveau token JWT
       */
      refreshToken: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { refreshTokenInProgress: true })),
          switchMap((refresh_token) =>
            authService.refreshToken(refresh_token).pipe(
              tapResponse({
                next: (jwtTokens: IJwtTokens) => {
                  patchState(store, {
                    jwtTokens,
                    error: null,
                    refreshTokenInProgress: false,
                  });

                  refreshTokenSubject.next(jwtTokens.token);
                },
                error: (error: HttpErrorResponse) => {
                  patchState(store, {
                    error: createWsErrorWithMessage(
                      error,
                      translate.instant('authentication.refreshTokenError')
                    ),
                    refreshTokenInProgress: false,
                  });

                  cancelAllPendingRequests();
                  methods.logout(true);
                },
              })
            )
          )
        )
      ),

      /**
       * Définit le centre courant de l'utilisateur
       * @param currentCenter - Le centre à définir comme courant
       */
      setCurrentCenter(currentCenter: ICenter): void {
        patchState(store, { currentCenter });
      },

      /**
       * Réinitialise les erreurs
       */
      resetError(): void {
        patchState(store, { error: null });
      },
    })
  ),

  withHooks({
    onInit(store, persistenceService = inject(StatePersistenceService)) {
      const stored = persistenceService.get<AuthState>('AUTH');

      if (stored) {
        patchState(store, {
          jwtTokens: stored.jwtTokens,
          user: stored.user,
          currentCenter: stored.currentCenter,
        });
      }

      effect(() => {
        const state: Partial<AuthState> = {
          jwtTokens: store.jwtTokens(),
          user: store.user(),
          currentCenter: store.currentCenter(),
        };
        persistenceService.set('AUTH', state);
      });
    },
  })
);

const methods = AuthStore.prototype as any;
