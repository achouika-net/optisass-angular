import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AuthState } from './auth.reducer';

export const selectAuth = createFeatureSelector<AuthState>('auth');

export const IsAuthenticatedSelector = createSelector(
  selectAuth,
  (state: AuthState) =>
    !!state.user?.id && !!state.jwtTokens?.token && !!state.jwtTokens?.refresh_token
);
export const UserSelector = createSelector(selectAuth, (state: AuthState) => state.user);

export const UserRoleSelector = createSelector(
  selectAuth,
  (state: AuthState) => state.currentCenter?.role_id
);

export const UserErrorSelector = createSelector(selectAuth, (state: AuthState) => state.errors);

export const JwtTokensSelector = createSelector(selectAuth, (state: AuthState) => state.jwtTokens);

export const RefreshTokenInProgressSelector = createSelector(
  selectAuth,
  (state: AuthState) => state.refreshTokenInProgress
);
export const MenuFavorisSelector = createSelector(
  selectAuth,
  (state: AuthState) => state.user?.menu_favoris
);
export const TenantSelector = createSelector(
  selectAuth,
  (state: AuthState) => state.currentCenter?.numero_affaire
);
export const UserCentresSelector = createSelector(
  selectAuth,
  (state: AuthState) => state.user?.centers || []
);
export const UserCurrentCentreSelector = createSelector(
  selectAuth,
  (state: AuthState) => state.currentCenter
);
