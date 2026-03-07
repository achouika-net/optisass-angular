import { HttpErrorResponse } from '@angular/common/http';
import { ErrorService } from '@app/services';
import { catchError, Observable, of } from 'rxjs';

/**
 * Creates an error-handled observable that returns a fallback value on error.
 * @param {Observable<T>} source$ - The source observable
 * @param {T} fallback - The fallback value to return on error
 * @param {ErrorService} errorService - The error service to handle the error
 * @returns {Observable<T>} Observable that emits the source value or fallback on error
 */
export function withErrorHandler<T>(
  source$: Observable<T>,
  fallback: T,
  errorService: ErrorService,
): Observable<T> {
  return source$.pipe(
    catchError((error: HttpErrorResponse) => {
      errorService.getError(error);
      return of(fallback);
    }),
  );
}
