import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { ICalledRessources, INITIAL_CALLED_RESSOURCES } from '@app/models';

interface ResourcesState {
  calledRessources: ICalledRessources;
}

const initialState: ResourcesState = {
  calledRessources: INITIAL_CALLED_RESSOURCES,
};

export const ResourcesStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed((store) => ({
    isMarquesCalled: computed(() => store.calledRessources().marques),
    isTaxesCalled: computed(() => store.calledRessources().taxes),
    areAllResourcesCalled: computed(() => {
      const resources = store.calledRessources();
      return (
        resources.marques &&
        resources.taxes
      );
    }),
  })),

  withMethods((store) => ({
    /**
     * Marque une ressource comme appelée
     * @param resource - Nom de la ressource à marquer
     * @param value - État d'appel de la ressource (true = appelée, false = non appelée)
     */
    setResourceCalled(resource: keyof ICalledRessources, value: boolean): void {
      patchState(store, {
        calledRessources: {
          ...store.calledRessources(),
          [resource]: value,
        },
      });
    },

    /**
     * Réinitialise toutes les ressources à leur état initial (non appelées)
     */
    resetResources(): void {
      patchState(store, { calledRessources: INITIAL_CALLED_RESSOURCES });
    },
  }))
);
