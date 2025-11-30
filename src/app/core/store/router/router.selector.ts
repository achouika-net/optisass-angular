import { createFeatureSelector, createSelector } from '@ngrx/store';
import { RouterReducerState } from '@ngrx/router-store';
import { CustomRouterState } from './custom-router-serializer';

// 🔥 Sélecteur principal du Router Store
export const selectRouterState =
  createFeatureSelector<RouterReducerState<CustomRouterState>>('router');

// 🔥 Sélecteur général pour obtenir `state` complet du routeur
export const selectRouter = createSelector(
  selectRouterState,
  (router) => router?.state
);

// 🔥 Sélecteur pour récupérer l’URL actuelle
export const selectCurrentUrl = createSelector(
  selectRouter,
  (state) => state?.url
);

// 🔥 Sélecteur pour récupérer tous les paramètres de route
export const selectRouteParams = createSelector(
  selectRouter,
  (state) => state?.params
);

// 🔥 Sélecteur pour récupérer tous les query params
export const selectQueryParams = createSelector(
  selectRouter,
  (state) => state?.queryParams
);

// 🔥 Sélecteur pour récupérer `data` de la route
export const selectRouteData = createSelector(
  selectRouter,
  (state) => state?.data
);

// 🔥 Sélecteur pour récupérer un Paramètre Dynamique de la Route
export const selectRouteParam = (param: string) =>
  createSelector(selectRouteParams, (params) => params?.[param]);

// 🔥 Sélecteur pour récupérer un Query Param Dynamique
export const selectQueryParam = (param: string) =>
  createSelector(selectQueryParams, (queryParams) => queryParams?.[param]);
