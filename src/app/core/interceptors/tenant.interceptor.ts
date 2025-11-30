import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { TenantSelector } from '../store/auth/auth.selectors';
export const TenantInterceptor: HttpInterceptorFn = (request, next) => {
  const store = inject(Store);
  const tenant = store.selectSignal(TenantSelector)()?.toString();
  const reqClone = request.clone({
    headers: request.headers.set('Tenant', tenant || ''),
  });
  return next(reqClone);
};
