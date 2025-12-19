import { ICivilite, IWsError } from '@app/models';
import { createAction, props } from '@ngrx/store';

export const GetCivilites = createAction('[ Resources ] - Get civilites');
export const GetCivilitesSuccess = createAction(
  '[ Resources ] - Get civilites success',
  props<{ civilites: ICivilite[] }>()
);
export const GetCivilitesError = createAction(
  '[ Resources ] - Get civilites error',
  props<{ civilites?: ICivilite[]; error: IWsError }>()
);

export const SetCalledRessources = createAction(
  '[ Resources ] - SetCalledRessources',
  props<{ ressource: string; value: boolean }>()
);
