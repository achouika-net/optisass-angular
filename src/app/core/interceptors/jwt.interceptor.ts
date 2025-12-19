import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { isValidTokens, JwtTokensState } from '@app/models';
import { BehaviorSubject, Observable, Subject, throwError } from 'rxjs';
import { catchError, filter, switchMap, take, takeUntil } from 'rxjs/operators';
import { AuthStore } from '../store/auth.store';

export const refreshTokenSubject = new BehaviorSubject<string | null>(null);

const cancelPendingRequests$ = new Subject<void>();

const PUBLIC_URLS = [
  '/login',
  '/refresh_token',
  '/password_reset',
  '/password_reset/verify',
] as const;

type PublicUrl = (typeof PUBLIC_URLS)[number];

type AuthStoreInstance = InstanceType<typeof AuthStore>;

/**
 * Vérifie si une URL est publique
 */
function isPublicUrl(url: string): boolean {
  return PUBLIC_URLS.some((publicUrl) => url.includes(publicUrl));
}

/**
 * Ajoute le header Authorization à une requête
 */
function addAuthHeader<T>(request: HttpRequest<T>, token: string): HttpRequest<T> {
  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Gère les erreurs HTTP avec retry automatique pour 401
 */
function handleAuthError<T>(
  request: HttpRequest<T>,
  next: HttpHandlerFn,
  error: unknown,
  authStore: AuthStoreInstance
): Observable<HttpEvent<T>> {
  if (!(error instanceof HttpErrorResponse)) {
    return throwError(() => error);
  }

  if (isPublicUrl(request.url)) {
    return throwError(() => error);
  }

  if (error.status === 401) {
    return handleUnauthorizedError(request, next, authStore);
  }

  return throwError(() => error);
}

/**
 * Gère spécifiquement les erreurs 401 (Unauthorized)
 */
function handleUnauthorizedError<T>(
  request: HttpRequest<T>,
  next: HttpHandlerFn,
  authStore: AuthStoreInstance
): Observable<HttpEvent<T>> {
  const tokens: JwtTokensState = authStore.jwtTokens();

  if (!tokens || !tokens.refresh_token) {
    authStore.logout(true);
    return throwError(() => new Error('No refresh token available'));
  }

  if (authStore.refreshTokenInProgress()) {
    return waitForNewToken(request, next);
  }

  refreshTokenSubject.next(null);
  authStore.refreshToken(tokens.refresh_token);

  return waitForNewToken(request, next);
}

/**
 * Attend qu'un nouveau token soit disponible et relance la requête
 */
function waitForNewToken<T>(
  request: HttpRequest<T>,
  next: HttpHandlerFn
): Observable<HttpEvent<T>> {
  return refreshTokenSubject.pipe(
    filter((token): token is string => token !== null && token.length > 0),
    take(1),
    takeUntil(cancelPendingRequests$),
    switchMap((newToken) => {
      const authRequest = addAuthHeader(request, newToken);
      return next(authRequest) as Observable<HttpEvent<T>>;
    })
  );
}

/**
 * Interceptor JWT principal
 */
export const JwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const tokens: JwtTokensState = authStore.jwtTokens();

  let authRequest = req;
  if (isValidTokens(tokens) && !isPublicUrl(req.url)) {
    authRequest = addAuthHeader(req, tokens.token);
  }

  return next(authRequest).pipe(
    catchError((error) => handleAuthError(authRequest, next, error, authStore))
  );
};

/**
 * Annule toutes les requêtes en attente
 */
export function cancelAllPendingRequests(): void {
  cancelPendingRequests$.next();
}
