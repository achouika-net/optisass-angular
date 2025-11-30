import { Action, createReducer, on } from '@ngrx/store';
import { IWsError } from '@app/models';
import { environment } from '../../../../environments/environment';
import { SetLanguageAction, SetLogoAction, SetThemeAction } from './settings.actions';

export const WS_THEME = 'default';

export interface SettingsState {
  language: string;
  theme: string;
  logo: string;
  smallLogo: string;
  backgrounds: string[];
  error: IWsError | null;
}

export const initialResourcesState: SettingsState = {
  language: environment.defaultLanguage,
  theme: WS_THEME,
  logo: null,
  smallLogo: null,
  backgrounds: ['background/auth-bg-1.jpg', 'background/auth-bg-2.jpg'],
  error: null,
};

const featureReducer = createReducer(
  initialResourcesState,
  on(SetLogoAction, (state, action) => ({
    ...state,
    logo: `/logos/${action.logo}.png`,
    smallLogo: `/logos/${action.logo}-small.png`,
  })),
  on(SetLanguageAction, SetThemeAction, (state, action) => ({
    ...state,
    ...action,
  }))
);

export function settingsReducer(state: SettingsState | undefined, action: Action): SettingsState {
  return featureReducer(state, action);
}
