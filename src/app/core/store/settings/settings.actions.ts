import { createAction, props } from '@ngrx/store';

export const SetLanguageAction = createAction(
  '[Settings] Set Language',
  props<{ language: string }>()
);

export const SetLogoAction = createAction(
  '[Settings] Set logo',
  props<{ logo: string }>()
);

export const SetThemeAction = createAction(
  '[Settings] Set Theme',
  props<{ theme: string }>()
);
