import { inject, Injectable } from '@angular/core';
import { LOCAL_STORAGE_KEYS } from '@app/config';
import { setLocalStorageItem } from '@app/helpers';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { INIT, select, Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';
import { distinctUntilChanged, map, tap } from 'rxjs/operators';
import { AppState } from '../app.reducers';
import { selectCurrentUrl } from '../router/router.selector';
import { SetLanguageAction, SetLogoAction, SetThemeAction } from './settings.actions';
import { SettingsState } from './settings.reducers';
import {
  selectSettings,
  SettingsLanguageSelector,
  ThemeSettingsSelector,
} from './settings.selectors';

@Injectable()
export class SettingsEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject<Store<AppState>>(Store);
  private readonly translate = inject(TranslateService);

  persistSettings$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(SetLanguageAction),
        tap(() =>
          setLocalStorageItem(
            LOCAL_STORAGE_KEYS.STORE.SETTINGS,
            this.store.selectSignal<SettingsState>(selectSettings)()
          )
        )
      ),
    { dispatch: false }
  );
  setTranslateServiceLanguage$ = createEffect(
    () =>
      this.store.pipe(
        select(SettingsLanguageSelector),
        distinctUntilChanged(),
        tap((language) => this.translate.use(language))
      ),
    { dispatch: false }
  );

  setThemeEffect = createEffect(
    () =>
      merge(INIT, this.actions$.pipe(ofType(SetThemeAction))).pipe(
        tap(() => {
          const theme = this.store.selectSignal<string>(ThemeSettingsSelector);
          const classList = document.documentElement.classList;
          const toRemove = Array.from(classList).filter((item: string) => item.includes('-theme'));
          if (toRemove.length) {
            classList.remove(...toRemove);
          }
          document.documentElement.classList.add(`${theme()}-theme`);
        })
      ),
    { dispatch: false }
  );

  setLogoEffect$ = createEffect(() =>
    this.store.pipe(
      select(selectCurrentUrl),
      map(() => {
        switch (window.location.hostname) {
          case 'www.autosur.com':
            return SetLogoAction({
              logo: 'autosur-logo-transparent',
            });
          case 'www.diagnosur.com':
            return SetLogoAction({
              logo: 'diagnosur-logo-transparent',
            });
          default:
            return SetLogoAction({
              logo: 'autosur-logo-transparent',
            });
        }
      })
    )
  );
}
