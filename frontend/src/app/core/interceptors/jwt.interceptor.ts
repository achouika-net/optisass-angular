/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { IJwtTokens } from '@app/models';
import { Store } from '@ngrx/store';
import { BehaviorSubject, Subject, throwError } from 'rxjs';
import { catchError, filter, switchMap, take, takeUntil, timeout } from 'rxjs/operators';
import { RefreshToken } from '../store/auth/auth.actions';
import { JwtTokensSelector, RefreshTokenInProgressSelector } from '../store/auth/auth.selectors';

export const refreshTokenSubject = new BehaviorSubject<string | null>(null);
const takeUntilSubject = new Subject<boolean>();

const PUBLIC_URLS = ['/login', '/refresh_token', '/password_reset', '/password_reset/verify'];

/* Ajout du token dans le header de la request
 * @param request
 * @param token
 * @return HttpRequest<any>
 * @private
 */
const addAuthHeader = (request: HttpRequest<any>, token: string): HttpRequest<any> => {
  return request.clone({
    headers: request.headers.set('Authorization', `Bearer ${token}`),
  });
};

/**
 * Vérifie si l'URL est publique
 * @param url
 * @return boolean
 */
const isPublicUrl = (url: string): boolean =>
  PUBLIC_URLS.some((publicUrl) => url.includes(publicUrl));

export const JwtInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  const store = inject<Store>(Store);
  const refreshTokenInProgress = store.selectSignal(RefreshTokenInProgressSelector);
  const tokens = store.selectSignal<IJwtTokens>(JwtTokensSelector);
  const accessToken = tokens().token;
  const refreshToken = tokens().refresh_token;

  let authReq = req;
  if (!!accessToken && !isPublicUrl(authReq.url)) {
    authReq = addAuthHeader(req, accessToken);
  }
  return next(authReq).pipe(
    catchError((error) => {
      if (!isPublicUrl(authReq.url) && error instanceof HttpErrorResponse && error.status === 401) {
        // mise à jour du accessToken à l'aide du refreshToken lors de la réception d'une HttpResponse avec le code d'erreur 401
        if (!refreshTokenInProgress()) {
          refreshTokenSubject.next(null);
          store.dispatch(RefreshToken({ refresh_token: refreshToken }));
        }

        // On attend que le nouveau token soit émis via le BehaviorSubject
        return refreshTokenSubject.pipe(
          filter((newToken: string) => !!newToken),
          take(1),
          takeUntil(takeUntilSubject),
          timeout(15000), // Timeout after 15s if no new token
          switchMap((newToken: string) => next(addAuthHeader(authReq, newToken)))
        );
      }

      // Si l'appel au /refresh_token échoue on stoppe tout
      if (authReq.url.includes('refresh_token')) {
        takeUntilSubject.next(true);
      }

      return throwError(error);
    })
  );
};
