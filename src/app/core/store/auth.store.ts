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
  ILoginResponse,
  INITIAL_CURRENT_USER,
  INITIAL_JWT_TOKENS,
  INITIAL_WS_ERROR,
  isValidUser,
  JwtTokensState,
  WsErrorState,
} from '@app/models';
import { IClientRoute, ResourceAuthorizations } from '@optisaas/opti-saas-lib';
import { AuthService } from '../../features/authentication/services/auth.service';
import { StatePersistenceService } from '../services';
import { refreshTokenSubject, cancelAllPendingRequests } from '../interceptors/jwt.interceptor';

interface AuthState {
  jwtTokens: JwtTokensState;
  user: CurrentUserState;
  currentCenter: ICenter | null;
  navigation: IClientRoute[];
  userPermissions: ResourceAuthorizations[];
  error: WsErrorState;
  refreshTokenInProgress: boolean;
}

const initialState: AuthState = {
  jwtTokens: INITIAL_JWT_TOKENS,
  user: INITIAL_CURRENT_USER,
  currentCenter: null,
  navigation: [],
  userPermissions: [],
  error: INITIAL_WS_ERROR,
  refreshTokenInProgress: false,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed((store) => ({
    isAuthenticated: computed(
      () => isValidUser(store.user()) && store.jwtTokens() !== null && !!store.jwtTokens()?.accessToken
    ),

    // Nouvelles propriétés alignées avec backend NestJS
    userTenants: computed(() => store.user()?.tenants ?? []),
    currentTenantId: computed(() => store.currentCenter()?.id ?? null),
    currentTenantName: computed(() => store.currentCenter()?.name ?? null),

    // Navigation dynamique
    hasNavigation: computed(() => store.navigation().length > 0),
    // Note: Pour accéder aux routes, utiliser directement authStore.navigation()
    // Note: Pour accéder aux permissions, utiliser directement authStore.userPermissions()
    // Ces propriétés sont déjà des computed signals créés par le Proxy de withState

    // @deprecated - Propriétés de compatibilité (backend NestJS ne retourne plus ces champs)
    // À supprimer progressivement
    userRole: computed((): null => null), // TODO: Implémenter la gestion des rôles dans backend NestJS
    tenant: computed(() => store.currentCenter()?.dbSchema ?? null), // Utilise dbSchema comme fallback
    menuFavoris: computed((): null => null), // TODO: Ajouter au backend NestJS si nécessaire
    userCenters: computed(() => store.user()?.tenants ?? []), // Alias de userTenants
  })),

  withMethods(
    (
      store,
      authService = inject(AuthService),
      router = inject(Router),
      translate = inject(TranslateService),
      persistenceService = inject(StatePersistenceService)
    ) => {
      // Créer une référence aux méthodes pour pouvoir les appeler entre elles
      const methods = {
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
                  next: (loginResponse: ILoginResponse) => {
                    // Extraire les tokens de la réponse
                    const jwtTokens: IJwtTokens = {
                      accessToken: loginResponse.accessToken,
                      refreshToken: loginResponse.refreshToken,
                    };

                    patchState(store, { jwtTokens, error: null });

                    // Appeler getCurrentUser pour récupérer l'utilisateur complet avec tenants
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
         * Récupère les informations de l'utilisateur connecté
         * Chaîne automatiquement avec getClientOptions() si succès
         * @returns Observable qui émet les informations utilisateur
         */
        getCurrentUser: rxMethod<void>(
          pipe(
            switchMap(() =>
              authService.getCurrentUser().pipe(
                tapResponse({
                  next: (user: ICurrentUser) => {
                    // Sélectionne le premier tenant comme tenant actif
                    // Le backend NestJS ne retourne pas de flag "active", on prend le premier
                    const currentCenter = user.tenants[0] ?? null;

                    patchState(store, {
                      user,
                      currentCenter,
                      error: null,
                    });

                    // Chaîner avec getClientOptions() pour récupérer la navigation
                    if (currentCenter) {
                      methods.getClientOptions();
                    } else {
                      // Pas de tenant disponible → erreur
                      patchState(store, {
                        error: createWsErrorWithMessage(
                          { status: 400 } as HttpErrorResponse,
                          translate.instant('authentication.noTenantError')
                        ),
                      });
                      void router.navigate(['/login']);
                    }
                  },
                  error: (error: HttpErrorResponse) => {
                    // Si l'appel /me échoue après un login réussi, l'état d'authentification est corrompu
                    // On déconnecte l'utilisateur et on le redirige vers la page de login
                    patchState(store, {
                      error: createWsErrorWithMessage(
                        error,
                        translate.instant('authentication.getCurrentUserError')
                      ),
                      jwtTokens: INITIAL_JWT_TOKENS,
                      user: INITIAL_CURRENT_USER,
                    });

                    void router.navigate(['/login']);
                  },
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

        /**
         * Récupère les options client (navigation/menu + permissions) pour le tenant courant
         * Note: Le header Tenant est ajouté automatiquement par TenantInterceptor
         * @returns Observable qui émet la structure de navigation et les permissions
         */
        getClientOptions: rxMethod<void>(
          pipe(
            switchMap(() =>
              authService.getClientOptions().pipe(
                tapResponse({
                  next: (clientOptions) => {
                    patchState(store, {
                      navigation: clientOptions.routes,
                      userPermissions: clientOptions.userPermissions,
                      error: null,
                    });

                    // Redirection vers /p uniquement après succès du chargement de la navigation
                    void router.navigate(['/p']);
                  },
                  error: (error: HttpErrorResponse) => {
                    // Sans navigation, l'application est inutilisable
                    // On déconnecte l'utilisateur et on le redirige vers login
                    patchState(store, {
                      error: createWsErrorWithMessage(
                        error,
                        translate.instant('authentication.getOptionsError')
                      ),
                      jwtTokens: INITIAL_JWT_TOKENS,
                      user: INITIAL_CURRENT_USER,
                      currentCenter: null,
                      navigation: [],
                      userPermissions: [],
                    });

                    void router.navigate(['/login']);
                  },
                })
              )
            )
          )
        ),
      };

      return methods;
    }
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

        // Si on a un token en localStorage, appeler /me pour vérifier/rafraîchir la session
        // Cela couvre le cas du refresh de page ou du redémarrage de l'app
        if (stored.jwtTokens?.accessToken) {
          store.getCurrentUser();
        }
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
