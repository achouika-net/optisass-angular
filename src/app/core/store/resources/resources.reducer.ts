import { CalledRessources, ICalledRessources, IWsError, ICivilite } from '@app/models';
import { Action, createReducer, on } from '@ngrx/store';
import * as featureActions from './resources.actions';

export interface ResourcesState {
  civilites: ICivilite[];
  errors?: IWsError;
  calledRessources: ICalledRessources;
}

export const initialResourcesState: ResourcesState = {
  civilites: [],
  errors: null,
  calledRessources: new CalledRessources(),
};

const featureReducer = createReducer(
  initialResourcesState,
  on(featureActions.GetCivilitesSuccess, featureActions.GetCivilitesError, (state, action) => ({
    ...state,
    ...action,
  })),
  on(featureActions.SetCalledRessources, (state, action) => ({
    ...state,
    calledRessources: {
      ...state.calledRessources,
      [action.ressource]: action.value,
    },
  }))
);
export function resourcesReducer(
  state: ResourcesState | undefined,
  action: Action
): ResourcesState {
  return featureReducer(state, action);
}
