import { inject } from '@angular/core';
import { withErrorHandler } from '@app/helpers';
import {
  IBrand,
  IColor,
  IFamily,
  ILaboratory,
  IManufacturer,
  IModel,
  IResource,
  ISubFamily,
} from '@app/models';
import { ErrorService, ResourceService } from '@app/services';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { forkJoin, pipe, switchMap, tap } from 'rxjs';

interface IResourceState {
  productTypes: IResource[];
  productStatuses: IResource[];
  frameCategories: IResource[];
  genders: IResource[];
  frameShapes: IResource[];
  frameMaterials: IResource[];
  frameTypes: IResource[];
  hingeTypes: IResource[];
  lensTypes: IResource[];
  lensMaterials: IResource[];
  lensTints: IResource[];
  lensFilters: IResource[];
  lensTreatments: IResource[];
  lensIndices: IResource[];
  contactLensTypes: IResource[];
  contactLensUsages: IResource[];
  accessoryCategories: IResource[];
  civilites: IResource[];
  brands: IBrand[];
  models: IModel[];
  manufacturers: IManufacturer[];
  laboratories: ILaboratory[];
  families: IFamily[];
  subFamilies: ISubFamily[];
  colors: IColor[];
  loading: boolean;
  initialized: boolean;
}

const initialState: IResourceState = {
  productTypes: [],
  productStatuses: [],
  frameCategories: [],
  genders: [],
  frameShapes: [],
  frameMaterials: [],
  frameTypes: [],
  hingeTypes: [],
  lensTypes: [],
  lensMaterials: [],
  lensTints: [],
  lensFilters: [],
  lensTreatments: [],
  lensIndices: [],
  contactLensTypes: [],
  contactLensUsages: [],
  accessoryCategories: [],
  civilites: [],
  brands: [],
  models: [],
  manufacturers: [],
  laboratories: [],
  families: [],
  subFamilies: [],
  colors: [],
  loading: false,
  initialized: false,
};

export const ResourceStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withMethods(
    (store, resourceService = inject(ResourceService), errorService = inject(ErrorService)) => ({
      /**
       * Loads all resources in parallel. Call once on app initialization.
       */
      loadAllResources: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true })),
          switchMap(() =>
            forkJoin({
              simpleResources: withErrorHandler(
                resourceService.loadAllSimpleResources(),
                null,
                errorService,
              ),
              brands: withErrorHandler(resourceService.getBrands(), [], errorService),
              models: withErrorHandler(resourceService.getModels(), [], errorService),
              manufacturers: withErrorHandler(resourceService.getManufacturers(), [], errorService),
              laboratories: withErrorHandler(resourceService.getLaboratories(), [], errorService),
              families: withErrorHandler(resourceService.getFamilies(), [], errorService),
              subFamilies: withErrorHandler(resourceService.getSubFamilies(), [], errorService),
              colors: withErrorHandler(resourceService.getColors(), [], errorService),
            }),
          ),
          tap((resources) =>
            patchState(store, {
              // Flatten simple resources
              ...resources.simpleResources,
              // Complex resources
              brands: resources.brands,
              models: resources.models,
              manufacturers: resources.manufacturers,
              laboratories: resources.laboratories,
              families: resources.families,
              subFamilies: resources.subFamilies,
              colors: resources.colors,
              // State flags
              loading: false,
              initialized: true,
            }),
          ),
        ),
      ),

      /**
       * Loads models filtered by brand ID.
       * @param {string} brandId - The brand ID to filter models
       */
      loadModelsByBrand: rxMethod<string>(
        pipe(
          switchMap((brandId) =>
            withErrorHandler(resourceService.getModelsByBrand(brandId), [], errorService).pipe(
              tap((models) => patchState(store, { models })),
            ),
          ),
        ),
      ),

      /**
       * Loads sub-families filtered by family ID.
       * @param {string} familyId - The family ID to filter sub-families
       */
      loadSubFamiliesByFamily: rxMethod<string>(
        pipe(
          switchMap((familyId) =>
            withErrorHandler(
              resourceService.getSubFamiliesByFamily(familyId),
              [],
              errorService,
            ).pipe(tap((subFamilies) => patchState(store, { subFamilies }))),
          ),
        ),
      ),
    }),
  ),
);
