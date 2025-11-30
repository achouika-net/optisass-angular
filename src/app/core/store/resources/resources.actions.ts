import { createAction, props } from '@ngrx/store';

export const SetCalledRessources = createAction(
  '[ Resources ] - SetCalledRessources',
  props<{ ressource: string; value: boolean }>()
);
