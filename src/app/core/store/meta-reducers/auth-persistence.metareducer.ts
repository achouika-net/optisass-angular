import { LOCAL_STORAGE_KEYS } from '@app/config';
import { setLocalStorageItem } from '@app/helpers';
import { ActionReducer } from '@ngrx/store';
import { AppState } from '../app.reducers';
import {
  GetCurrentUserSuccess,
  LoginSuccess,
  RefreshTokenSuccess,
  SetCurrentCenter,
} from '../auth/auth.actions';

const AUTH_PERSIST_ACTIONS = [
  LoginSuccess.type,
  RefreshTokenSuccess.type,
  GetCurrentUserSuccess.type,
  SetCurrentCenter.type,
] as readonly string[];
export function authPersistenceMetaReducer(
  reducer: ActionReducer<AppState>
): ActionReducer<AppState> {
  return (state, action) => {
    const nextState = reducer(state, action);
    const isAuthPersistAction = AUTH_PERSIST_ACTIONS.includes(action.type);

    if (isAuthPersistAction) {
      setLocalStorageItem(LOCAL_STORAGE_KEYS.STORE.AUTH, nextState.auth);
    }
    return nextState;
  };
}
