import { createAction, props } from '@ngrx/store';
import { ICenter, ICurrentUser, IJwtTokens, ILoginRequest, IWsError, MenuItem } from '@app/models';

export const Login = createAction('[Auth] Login', props<{ request: ILoginRequest }>());
export const LoginSuccess = createAction(
  '[Auth] Login Success',
  props<{ jwtTokens: IJwtTokens }>()
);
export const LoginError = createAction('[Auth] Login Error', props<{ errors: IWsError }>());
export const Logout = createAction('[Auth] Logout', props<{ redirect?: boolean }>());
export const InitializeAuthState = createAction('[Auth] Initialize Auth State');

export const RefreshToken = createAction('[Auth] RefreshToken', props<{ refresh_token: string }>());
export const RefreshTokenSuccess = createAction(
  '[Auth] RefreshToken Success',
  props<{ jwtTokens: IJwtTokens }>()
);
export const RefreshTokenError = createAction(
  '[Auth] RefreshToken Error',
  props<{ errors: IWsError }>()
);
export const GetCurrentUser = createAction('[Auth] Get Current User');
export const GetCurrentUserSuccess = createAction(
  '[Auth] Get Current User Success',
  props<{
    user: ICurrentUser;
  }>()
);

export const GetCurrentUserError = createAction(
  '[Auth] Get Current User Error',
  props<{ errors: IWsError }>()
);
export const ResetError = createAction('[Auth] Reset Error');
export const UpdateMenuFavoris = createAction(
  '[Auth] Update  Menu Favoris',
  props<{ menuFavoris: MenuItem[]; isAdd: boolean }>()
);
export const UpdateMenuFavorisSuccess = createAction(
  '[Auth] Update  Menu Favoris Success',
  props<{ menuFavoris: MenuItem[] }>()
);
export const UpdateMenuFavorisError = createAction(
  '[Auth] Update  Menu Favoris Error',
  props<{ errors: IWsError }>()
);
export const SetRefreshTokenInProgress = createAction(
  '[Auth] Set RefreshToken In Progress',
  props<{ refreshTokenInProgress: boolean }>()
);
export const SetCurrentCenter = createAction(
  '[Auth] Set Current Center',
  props<{ currentCenter: ICenter; isManualChange?: boolean }>()
);
export const GetUserOptions = createAction(
  '[Auth] Get User Options',
  props<{ userId: number; triggerNavigation?: boolean }>()
);
