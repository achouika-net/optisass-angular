import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthStore } from '@app/core/store';

/**
 * URLs qui ne doivent pas avoir le header Tenant
 * Généralement les endpoints d'authentification où le tenant n'est pas encore connu
 */
const TENANT_EXCLUDED_URLS = [
  '/client/auth/login',
  '/client/auth/refresh',
  '/client/auth/me',
  '/password_reset',
  '/password_reset/verify',
] as const;

/**
 * Vérifie si une URL doit être exclue du header Tenant
 * @param url - L'URL à vérifier
 * @returns true si l'URL doit être exclue
 */
const shouldExcludeTenant = (url: string): boolean => {
  return TENANT_EXCLUDED_URLS.some((excludedUrl) => url.includes(excludedUrl));
};

export const TenantInterceptor: HttpInterceptorFn = (request, next) => {
  // Skip tenant header pour certaines URLs
  if (shouldExcludeTenant(request.url)) {
    return next(request);
  }

  const authStore = inject(AuthStore);
  const tenant = authStore.tenant()?.toString();

  // Ajouter le header Tenant seulement si le tenant existe
  if (!tenant) {
    return next(request);
  }

  const reqClone = request.clone({
    headers: request.headers.set('Tenant', tenant),
  });

  return next(reqClone);
};
