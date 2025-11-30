import { LOCAL_STORAGE_KEYS } from '@app/config';
import { getLocalStorageItem } from '@app/helpers';
import { Action, ActionReducer, INIT, UPDATE } from '@ngrx/store';
import { AppState } from '../app.reducers';
import { SettingsState } from '../settings/settings.reducers';
import { AuthState } from '../auth/auth.reducer';
export function initStateFromLocalStorage(
  reducer: ActionReducer<AppState>
): ActionReducer<AppState> {
  return (state: AppState | undefined, action: Action) => {
    let newState = reducer(state, action);
    if ([INIT.toString(), UPDATE.toString()].includes(action.type)) {
      const storedSettings: SettingsState | null = getLocalStorageItem(
        LOCAL_STORAGE_KEYS.STORE.SETTINGS
      );
      const storedAuth: AuthState | null = getLocalStorageItem(
        LOCAL_STORAGE_KEYS.STORE.AUTH
      );
      newState = {
        ...newState,
        settings: {
          ...newState.settings,
          ...(storedSettings ?? {}),
        },
        auth: {
          ...newState.auth,
          ...(storedAuth ?? {}),
        },
      };
    }
    return newState;
  };
}
