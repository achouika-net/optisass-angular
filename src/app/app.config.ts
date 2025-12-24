import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideToastr } from 'ngx-toastr';
import { routes } from './app.routes';
import { ExtractDataInterceptor } from './core/interceptors/extract-data.interceptor';
import { JwtInterceptor } from './core/interceptors/jwt.interceptor';
import { TenantInterceptor } from './core/interceptors/tenant.interceptor';
import { WithCredentialsInterceptor } from './core/interceptors/withCredentials.interceptor';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';

export const appConfig: ApplicationConfig = {
  providers: [
    // Global Error Handling
    provideBrowserGlobalErrorListeners(),

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
