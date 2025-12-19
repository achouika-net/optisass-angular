import { createFeatureSelector, createSelector } from '@ngrx/store';
import { ResourcesState } from './resources.reducer';
import { ICivilite } from '@app/models';

export const CiviliteByTypeAndStateSelector = (type: number = null, actif: boolean = true) =>
  createSelector(ResourcesSelector, (state: ResourcesState) =>
    state.civilites
      ?.filter((civilite: ICivilite) =>
        type !== null
          ? civilite.type === type && (actif !== null ? civilite.actif === actif : true)
          : actif !== null
          ? civilite.actif === actif
          : true
      )
      .sort((c1, c2) => c1.type - c2.type)
  );

export const ResourcesSelector = createFeatureSelector<ResourcesState>('resources');

export const CalledRessourcesSelector = createSelector(
  ResourcesSelector,
  (state: ResourcesState) => state.calledRessources
);
