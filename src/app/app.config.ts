import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideRouterStore, RouterStateSerializer } from '@ngrx/router-store';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { environment } from 'environments/environment';
import { provideToastr } from 'ngx-toastr';
import { routes } from './app.routes';
import { ExtractDataInterceptor } from './core/interceptors/extract-data.interceptor';
import { JwtInterceptor } from './core/interceptors/jwt.interceptor';
import { TenantInterceptor } from './core/interceptors/tenant.interceptor';
import { WithCredentialsInterceptor } from './core/interceptors/withCredentials.interceptor';
import { appReducers, metaReducers } from './core/store/app.reducers';
import { AuthEffects } from './core/store/auth/auth.effects';
import { ResourcesEffects } from './core/store/resources/resources.effects';
import { CustomRouterSerializer } from './core/store/router/custom-router-serializer';
import { SettingsEffects } from './core/store/settings/settings.effects';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';

export const appConfig: ApplicationConfig = {
  providers: [
    // Global Error Handling
    provideBrowserGlobalErrorListeners(),
    // Router Configuration
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
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
    // NgRx Store Configuration
    provideStore(appReducers, {
      metaReducers,
      runtimeChecks: {
        strictStateImmutability: true,
        strictActionImmutability: true,
      },
    }),
    provideEffects([SettingsEffects, AuthEffects, ResourcesEffects]),
    provideRouterStore(),
    { provide: RouterStateSerializer, useClass: CustomRouterSerializer },
    provideStoreDevtools({
      maxAge: 25,
      logOnly: environment.production,
      name: environment.appName,
    }),
    // Translate Module Configuration
    provideTranslateService({ loader: provideTranslateHttpLoader() }),
    // Toastr Module Configuration
    provideToastr({ preventDuplicates: true }),
    //Material Design Options
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { appearance: 'outline' },
    },
  ],
};
