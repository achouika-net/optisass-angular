import { CalledRessources, ICalledRessources, IWsError } from '@app/models';
import { Action, createReducer, on } from '@ngrx/store';
import * as featureActions from './resources.actions';

export interface ResourcesState {
  errors?: IWsError;
  calledRessources: ICalledRessources;
}

export const initialResourcesState: ResourcesState = {
  errors: null,
  calledRessources: new CalledRessources(),
};

const featureReducer = createReducer(
  initialResourcesState,
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
