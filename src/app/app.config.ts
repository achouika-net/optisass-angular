import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
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
import { AuthStore } from './core/store';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';

export const appConfig: ApplicationConfig = {
  providers: [
    // Global Error Handling
    provideBrowserGlobalErrorListeners(),

    // Session Restoration - Bloque le bootstrap jusqu'à la fin de la restauration
    provideAppInitializer(() => {
      const authStore = inject(AuthStore);
      // Les tokens sont déjà restaurés par le onInit du store
      if (authStore.jwtTokens()?.accessToken) {
        // Appeler getCurrentUser qui enchaîne avec getUserOptions
        authStore.getCurrentUser({ isRestoreSession: true });

        // Attendre que isSessionRestoring devienne false (session complètement restaurée)
        // ou que les tokens soient vidés (échec de restauration)
        return firstValueFrom(
          toObservable(authStore.isSessionRestoring).pipe(
            filter((isRestoring) => !isRestoring || !authStore.jwtTokens()?.accessToken),
            take(1)
          )
        );
      }
      return Promise.resolve();
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
      ])
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
