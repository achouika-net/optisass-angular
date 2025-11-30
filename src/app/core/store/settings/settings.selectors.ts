import { createFeatureSelector, createSelector } from '@ngrx/store';
import { SettingsState } from './settings.reducers';

export const selectSettings = createFeatureSelector<SettingsState>('settings');

export const SettingsLanguageSelector = createSelector(
  selectSettings,
  (settingSelector: SettingsState) => settingSelector.language
);

export const LogoSettingsSelector = createSelector(
  selectSettings,
  (settingSelector: SettingsState) => settingSelector.logo
);
export const CircleLogoSettingsSelector = createSelector(
  selectSettings,
  (settingSelector: SettingsState) => settingSelector.smallLogo
);

export const ThemeSettingsSelector = createSelector(
  selectSettings,
  (settings) => settings.theme
);

export const BackgroundsSelector = createSelector(
  selectSettings,
  (settings) => settings.backgrounds
);
