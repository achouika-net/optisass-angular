import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideToastr } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { routes } from './app.routes';
import { ExtractDataInterceptor } from './core/interceptors/extract-data.interceptor';
import { JwtInterceptor } from './core/interceptors/jwt.interceptor';
import { TenantInterceptor } from './core/interceptors/tenant.interceptor';
import { WithCredentialsInterceptor } from './core/interceptors/withCredentials.interceptor';
import { AuthStore, ResourceStore } from './core/store';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';

export const appConfig: ApplicationConfig = {
  providers: [
    // Global Error Handling
    provideBrowserGlobalErrorListeners(),

    // App Initialization - Bloque le bootstrap jusqu'à la fin du chargement
    provideAppInitializer(() => {
      const authStore = inject(AuthStore);
      const resourceStore = inject(ResourceStore);

      // Lancer le chargement des resources
      resourceStore.loadAllResources();

      // Attendre que les resources soient initialisées
      const resourcesReady = firstValueFrom(
        toObservable(resourceStore.initialized).pipe(
          filter((initialized) => initialized),
          take(1),
        ),
      );

      // Restaurer la session si tokens présents
      let sessionReady: Promise<unknown> = Promise.resolve();
      if (authStore.jwtTokens()?.accessToken) {
        authStore.getCurrentUser({ isRestoreSession: true });
        sessionReady = firstValueFrom(
          toObservable(authStore.isSessionRestoring).pipe(
            filter((isRestoring) => !isRestoring || !authStore.jwtTokens()?.accessToken),
            take(1),
          ),
        );
      }

      // Attendre les deux en parallèle
      return Promise.all([resourcesReady, sessionReady]).then((): void => undefined);
    }),

    // Router Configuration
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),

    // Animations (requis pour Material Design & ngx-toastr)
    provideAnimations(),

    // HTTP Client Configuration
    provideHttpClient(
      withFetch(),
      withInterceptors([
        JwtInterceptor,
        TenantInterceptor,
        ExtractDataInterceptor,
        WithCredentialsInterceptor,
      ]),
    ),

    // Translate Module Configuration
    provideTranslateService({ loader: provideTranslateHttpLoader() }),

    // Toastr Module Configuration
    provideToastr({ preventDuplicates: true }),

    // Material Design Options
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { appearance: 'outline' },
    },
    {
      provide: MAT_ICON_DEFAULT_OPTIONS,
      useValue: { fontSet: 'material-symbols-outlined' },
    },
  ],
};
