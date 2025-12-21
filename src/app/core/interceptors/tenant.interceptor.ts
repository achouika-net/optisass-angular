import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthStore } from '@app/core/store';

export const TenantInterceptor: HttpInterceptorFn = (request, next) => {
  const authStore = inject(AuthStore);
  const tenant = authStore.tenant()?.toString();

  if(request.url.includes('login') || request.url.includes('refresh_token')) {
    return next(request);
  }

  const reqClone = request.clone({
    headers: request.headers.set('Tenant', tenant || ''),
  });

  return next(reqClone);
};
