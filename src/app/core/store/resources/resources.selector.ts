import { createFeatureSelector, createSelector } from '@ngrx/store';
import { ResourcesState } from './resources.reducer';

export const ResourcesSelector = createFeatureSelector<ResourcesState>('resources');

export const CalledRessourcesSelector = createSelector(
  ResourcesSelector,
  (state: ResourcesState) => state.calledRessources
);
