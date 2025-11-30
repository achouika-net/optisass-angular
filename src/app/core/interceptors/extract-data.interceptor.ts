/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const noExtractTypes = ['blob', 'arraybuffer'];
const noExtractUrl: string[] = [];
const allowUrl = (url: string): boolean => {
  return !noExtractUrl.some((blockedUrl) => url.includes(blockedUrl));
};

export const ExtractDataInterceptor: HttpInterceptorFn = (
  request: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> => {
  return next(request).pipe(
    map((event: HttpEvent<any>) => {
      if (
        event instanceof HttpResponse &&
        noExtractTypes.indexOf(request.responseType) === -1 &&
        allowUrl(request.url)
      ) {
        if (
          event?.body &&
          // eslint-disable-next-line no-prototype-builtins
          event.body.hasOwnProperty('data') &&
          !event.body['meta']
        ) {
          // change the response body here
          const eventClone: HttpEvent<any> = event.clone({
            body: event.body['data'],
          });
          return eventClone;
        }
      }
      return event;
    })
  );
};
