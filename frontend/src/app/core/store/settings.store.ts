import { effect, inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { TranslateService } from '@ngx-translate/core';
import { StatePersistenceService } from '../services';

interface SettingsState {
  language: string;
  theme: string;
  logo: string | null;
  smallLogo: string | null;
  backgrounds: string[];
}

const initialState: SettingsState = {
  language: 'fr',
  theme: 'default',
  logo: 'logos/autosur-logo-transparent.png', // Logo par défaut
  smallLogo: 'logos/autosur-logo-transparent-small.png', // Logo petit par défaut pour sidebar
  backgrounds: ['background/auth-bg-1.jpg', 'background/auth-bg-2.jpg'],
};

export const SettingsStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withMethods((store, translate = inject(TranslateService)) => ({
    /**
     * Change la langue de l'application
     * @param language - Code de la langue à appliquer (ex: 'fr', 'en')
     */
    setLanguage(language: string): void {
      patchState(store, { language });
      translate.use(language);
    },

    /**
     * Change le thème de l'application et l'applique au DOM
     * @param theme - Nom du thème à appliquer (ex: 'default', 'dark')
     */
    setTheme(theme: string): void {
      patchState(store, { theme });

      const classList = document.documentElement.classList;
      const toRemove = Array.from(classList).filter((item) => item.includes('-theme'));

      if (toRemove.length > 0) {
        classList.remove(...toRemove);
      }

      classList.add(`${theme}-theme`);
    },

    /**
     * Définit les logos de l'application en fonction du nom
     * @param logoName - Nom de base du logo (sans extension ni suffixe)
     */
    setLogo(logoName: string): void {
      patchState(store, {
        logo: `/logos/${logoName}.png`,
        smallLogo: `/logos/${logoName}-small.png`,
      });
    },
  })),

  withHooks({
    onInit(store, persistenceService = inject(StatePersistenceService), translate = inject(TranslateService)) {
      const stored = persistenceService.get<SettingsState>('SETTINGS');

      if (stored) {
        // Migration : remplacer les logos null/undefined par les valeurs par défaut
        const migratedSettings: SettingsState = {
          ...stored,
          logo: stored.logo ?? initialState.logo,
          smallLogo: stored.smallLogo ?? initialState.smallLogo,
        };

        patchState(store, migratedSettings);
        store.setTheme(migratedSettings.theme);
        store.setLanguage(migratedSettings.language);
      } else {
        translate.use(store.language());
      }

      effect(() => {
        const state: SettingsState = {
          language: store.language(),
          theme: store.theme(),
          logo: store.logo(),
          smallLogo: store.smallLogo(),
          backgrounds: store.backgrounds(),
        };
        persistenceService.set('SETTINGS', state);
      });
    },
  })
);
