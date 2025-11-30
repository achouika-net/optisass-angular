import { routerReducer, RouterReducerState } from '@ngrx/router-store';
import { ActionReducerMap, MetaReducer } from '@ngrx/store';
import { authReducer, AuthState } from './auth/auth.reducer';
import { authPersistenceMetaReducer } from './meta-reducers/auth-persistence.metareducer';
import { initStateFromLocalStorage } from './meta-reducers/initStateFromLocalStorage.metareducer';
import { resourcesReducer, ResourcesState } from './resources/resources.reducer';
import { CustomRouterState } from './router/custom-router-serializer';
import { settingsReducer, SettingsState } from './settings/settings.reducers';

export interface AppState {
  router: RouterReducerState<CustomRouterState>;
  resources: ResourcesState;
  settings: SettingsState;
  auth: AuthState;
}

export const appReducers: ActionReducerMap<AppState> = {
  router: routerReducer,
  resources: resourcesReducer,
  settings: settingsReducer,
  auth: authReducer,
};

export const metaReducers: MetaReducer<AppState>[] = [
  initStateFromLocalStorage,
  authPersistenceMetaReducer,
];
