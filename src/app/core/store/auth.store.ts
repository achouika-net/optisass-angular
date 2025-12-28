import { computed, effect, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { catchError, EMPTY, pipe, switchMap, tap } from 'rxjs';
import {
  createWsErrorWithMessage,
  CurrentUserState,
  ICurrentUser,
  IJwtTokens,
  ILoginRequest,
  ILoginResponse,
  IUserOptions,
  INITIAL_CURRENT_USER,
  INITIAL_JWT_TOKENS,
  INITIAL_WS_ERROR,
  isValidUser,
  JwtTokensState,
  MenuItem,
  WsErrorState, ITenant,
} from '@app/models';
import { filterMenuByAuthorizations } from '@app/helpers';
import { MENU } from '../../config/menu.config';
import { ResourceAuthorizations } from '@optisaas/opti-saas-lib';
import { AuthService } from '../../features/authentication/services/auth.service';
import { RouteAuthService, StatePersistenceService } from '../services';
import { refreshTokenSubject, cancelAllPendingRequests } from '../interceptors/jwt.interceptor';
import { calculateFallbackRoute } from '@app/helpers';

export interface AuthState {
  jwtTokens: JwtTokensState;
  user: CurrentUserState;
  currentTenant: ITenant | null;
  userAuthorizations: ResourceAuthorizations[];
  error: WsErrorState;
  refreshTokenInProgress: boolean;
  isSessionRestoring: boolean;
}

interface SessionOptions {
  isRestoreSession?: boolean;
}

const initialState: AuthState = {
  jwtTokens: INITIAL_JWT_TOKENS,
  user: INITIAL_CURRENT_USER,
  currentTenant: null,
  userAuthorizations: [],
  error: INITIAL_WS_ERROR,
  refreshTokenInProgress: false,
  isSessionRestoring: false,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed((store) => ({
    isAuthenticated: computed(
      () => isValidUser(store.user()) && store.userAuthorizations().length > 0 && store.jwtTokens() !== null && !!store.jwtTokens()?.accessToken
    ),
    userTenants: computed(() => store.user()?.tenants ?? []),

    // Menu filtré selon les permissions utilisateur
    /**
     * Menu complet filtré selon les permissions utilisateur.
     * Recalculé automatiquement quand userAuthorizations change.
     */
    filteredMenu: computed((): MenuItem[] => filterMenuByAuthorizations(MENU, store.userAuthorizations())),
  })),

  withMethods(
    (
      store,
      authService = inject(AuthService),
      router = inject(Router),
      translate = inject(TranslateService),
      persistenceService = inject(StatePersistenceService),
      routeAuthService = inject(RouteAuthService)
    ) => {
      // Créer une référence aux méthodes pour pouvoir les appeler entre elles
      const methods = {
        /**
         * Authentifie l'utilisateur avec email et mot de passe.
         * Enchaîne : login → getCurrentUser → getUserOptions → redirection vers /p
         * @param request - Les identifiants de connexion (email et password)
         */
        login: rxMethod<ILoginRequest>(
          pipe(
            tap(() => patchState(store, { error: null })),
            switchMap((request) =>
              authService.login(request).pipe(
                tap((loginResponse: ILoginResponse) => {
                  const jwtTokens: IJwtTokens = {
                    accessToken: loginResponse.accessToken,
                    refreshToken: loginResponse.refreshToken,
                  };
                  patchState(store, { jwtTokens, error: null });

                  // Appeler getCurrentUser qui va enchaîner avec getUserOptions
                  // isRestoreSession = false car c'est un login, pas un restore
                  methods.getCurrentUser({ isRestoreSession: false });
                }),
                catchError((error: HttpErrorResponse) => {
                  const message =
                    error.status === 401
                      ? translate.instant('authentication.loginError')
                      : translate.instant('authentication.unexpectedLoginError');

                  patchState(store, {
                    error: createWsErrorWithMessage(error, message),
                  });
                  return EMPTY;
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
          // Nettoyer le localStorage avant de réinitialiser l'état
          persistenceService.remove('AUTH');
          // Réinitialiser l'état du store
          patchState(store, initialState);

          if (redirect) {
            const currentUrl = router.url;
            const shouldRedirect = !currentUrl.includes('/login');

            if (shouldRedirect) {
              authService.redirectToAuthPath({
                redirectUrl: !currentUrl.includes('redirectUrl') ? currentUrl : undefined,
              });
            }
          }
        },

        /**
         * Récupère les informations de l'utilisateur connecté puis appelle getUserOptions
         * @param options.isRestoreSession - Si true, c'est une restauration de session (pas de redirect)
         */
        getCurrentUser: rxMethod<SessionOptions>(
          pipe(
            switchMap((options) =>
              authService.getCurrentUser().pipe(
                tap((user: ICurrentUser) => {
                  const currentTenant = user.tenants[0] ?? null;
                  patchState(store, { user, currentTenant, error: null });

                  // Appeler getUserOptions avec les mêmes options
                  methods.getUserOptions({ isRestoreSession: options.isRestoreSession });
                }),
                catchError((error: HttpErrorResponse) => {
                  // Ignorer les erreurs 401 - l'interceptor gère le refresh token
                  if (error.status === 401) {
                    return EMPTY;
                  }

                  patchState(store, {
                    error: createWsErrorWithMessage(error, translate.instant('authentication.getCurrentUserError')),
                    jwtTokens: INITIAL_JWT_TOKENS,
                    user: INITIAL_CURRENT_USER,
                    isSessionRestoring: false,
                  });

                  methods.logout(true);
                  return EMPTY;
                })
              )
            )
          )
        ),

        /**
         * Récupère les autorisations de l'utilisateur pour le tenant courant
         * @param options.isRestoreSession - Si true, c'est une restauration de session (pas de redirect)
         */
        getUserOptions: rxMethod<SessionOptions>(
          pipe(
            switchMap((options) =>
              authService.getUserOptions().pipe(
                tap((userOptions: IUserOptions) => {
                  patchState(store, {
                    userAuthorizations: userOptions.authorizations,
                    // Mettre isSessionRestoring à false seulement si c'est une restauration de session
                    ...(options.isRestoreSession && { isSessionRestoring: false }),
                  });
                  // Rediriger vers /p seulement après un login (pas après restore)
                  if (!options.isRestoreSession) {
                    void router.navigate(['/p']);
                  }
                }),
                catchError((error: HttpErrorResponse) => {
                  // Ignorer les erreurs 401 - l'interceptor gère le refresh token
                  if (error.status === 401) {
                    return EMPTY;
                  }

                  patchState(store, {
                    error: createWsErrorWithMessage(error, translate.instant('authentication.getUserOptionsError')),
                    isSessionRestoring: false,
                  });

                  methods.logout(true);
                  return EMPTY;
                })
              )
            )
          )
        ),

        /**
         * Rafraîchit le token JWT
         * @param refreshToken - Le refresh token à utiliser pour obtenir un nouveau token
         * @returns Observable qui émet le nouveau token JWT
         */
        refreshToken: rxMethod<string>(
          pipe(
            tap(() => patchState(store, { refreshTokenInProgress: true })),
            switchMap((refreshToken) =>
              authService.refreshToken(refreshToken).pipe(
                tapResponse({
                  next: (jwtTokens: IJwtTokens) => {
                    patchState(store, {
                      jwtTokens,
                      error: null,
                      refreshTokenInProgress: false,
                    });

                    refreshTokenSubject.next(jwtTokens.accessToken);
                  },
                  error: (error: HttpErrorResponse) => {
                    // Message d'erreur selon le type d'erreur
                    const message =
                      error.status === 401 || error.status === 403
                        ? translate.instant('authentication.sessionExpired')
                        : translate.instant('authentication.unexpectedError');

                    patchState(store, {
                      error: createWsErrorWithMessage(error, message),
                      refreshTokenInProgress: false,
                      isSessionRestoring: false,
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
         * Change le tenant courant et recharge les autorisations utilisateur.
         * Gère la redirection vers une route de fallback si l'utilisateur perd
         * l'accès à la route courante.
         *
         * Processus :
         * 1. Met à jour currentTenant (pour que TenantInterceptor utilise le nouveau tenant)
         * 2. Appelle GET /users/options pour récupérer les nouvelles autorisations
         * 3. Calcule la route de fallback AVANT de mettre à jour userAuthorizations
         * 4. Met à jour userAuthorizations (filteredMenu recalculé automatiquement)
         * 5. Si nécessaire, navigue vers le fallback avec toast
         *
         * @param tenant - Le nouveau tenant à activer
         */
        switchTenant: rxMethod<ITenant>(
          pipe(
            switchMap((tenant: ITenant) => {
              // Étape 1 : Capturer l'URL courante et mettre à jour le tenant
              const currentUrl = routeAuthService.getCurrentUrl();
              patchState(store, { currentTenant: tenant, error: null });

              // Étape 2 : Appeler l'API pour récupérer les nouvelles autorisations
              return authService.getUserOptions().pipe(
                tap((userOptions: IUserOptions) => {
                  // Étape 3 : Calculer le fallback AVANT de mettre à jour les autorisations
                  const newAuthorizations = userOptions.authorizations;
                  const fallbackRoute = calculateFallbackRoute(currentUrl, newAuthorizations);

                  // Étape 4 : Mettre à jour les autorisations
                  patchState(store, { userAuthorizations: newAuthorizations });

                  // Étape 5 : Naviguer si nécessaire ou afficher succès
                  if (fallbackRoute) {
                    routeAuthService.navigateToFallbackRoute(fallbackRoute);
                  } else {
                    routeAuthService.showTenantSwitchSuccess();
                  }
                }),
                catchError((error: HttpErrorResponse) => {
                  // Ignorer les erreurs 401 - l'interceptor gère le refresh token
                  if (error.status === 401) {
                    return EMPTY;
                  }

                  patchState(store, {
                    error: createWsErrorWithMessage(error, translate.instant('tenant.switchError')),
                  });
                  routeAuthService.showTenantSwitchError();

                  return EMPTY;
                })
              );
            })
          )
        ),

        /**
         * Réinitialise les erreurs
         */
        resetError(): void {
          patchState(store, { error: null });
        },
      };

      return methods;
    }
  ),

  withHooks({
    onInit(store, persistenceService = inject(StatePersistenceService)) {
      // Restaurer les tokens depuis localStorage (la restauration de session est gérée par provideAppInitializer)
      const stored = persistenceService.get<Pick<AuthState, 'jwtTokens'>>('AUTH');

      if (stored?.jwtTokens?.accessToken) {
        patchState(store, {
          jwtTokens: stored.jwtTokens,
          isSessionRestoring: true,
        });
      }
      // Persister uniquement les tokens dans localStorage
      effect(() => {
        const state: Pick<AuthState, 'jwtTokens'> = {
          jwtTokens: store.jwtTokens(),
        };
        persistenceService.set('AUTH', state);
      });
    },
  })
);
