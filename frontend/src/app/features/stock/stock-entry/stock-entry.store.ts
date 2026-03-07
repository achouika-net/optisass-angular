import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { patchState, signalState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { ErrorService, ProductMatchingService } from '@app/services';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { catchError, forkJoin, map, Observable, of, pipe, switchMap, tap } from 'rxjs';
import { createNoMatchResult, IProductMatchResult } from '@app/models';
import { IStockEntryRequest } from './models';
import { StockEntryService } from './services';

interface IMatchProductsResult {
  readonly rowId: string;
  readonly result: IProductMatchResult;
}

interface IStockEntryState {
  readonly isSubmitting: boolean;
  readonly isMatching: boolean;
}

const initialState: IStockEntryState = {
  isSubmitting: false,
  isMatching: false,
};

/**
 * Lightweight store for stock entry API operations.
 * Uses signalState for state management and rxMethod for async operations.
 */
@Injectable()
export class StockEntryStore {
  readonly #router = inject(Router);
  readonly #service = inject(StockEntryService);
  readonly #errorService = inject(ErrorService);
  readonly #toastr = inject(ToastrService);
  readonly #translate = inject(TranslateService);
  readonly #productMatching = inject(ProductMatchingService);

  readonly #state = signalState<IStockEntryState>(initialState);

  readonly isSubmitting = this.#state.isSubmitting;
  readonly isMatching = this.#state.isMatching;

  /**
   * Submits a stock entry request to the API.
   */
  readonly submitEntry = rxMethod<IStockEntryRequest>(
    pipe(
      tap(() => patchState(this.#state, { isSubmitting: true })),
      switchMap((request) =>
        this.#service.createEntry(request).pipe(
          tap(() => {
            patchState(this.#state, { isSubmitting: false });
            this.#toastr.success(this.#translate.instant('commun.operationTerminee'));
            void this.#router.navigate(['/p/stock/products']);
          }),
          catchError((error: HttpErrorResponse) => {
            patchState(this.#state, { isSubmitting: false });
            this.#errorService.getError(error, 'stock.entry.errors.createEntry', true);
            return of(null);
          }),
        ),
      ),
    ),
  );

  /**
   * Matches a single product against the database.
   * @param designation Product designation to match
   * @param supplierId Optional supplier ID for context
   * @returns Observable of match result
   */
  matchProduct(
    designation: string | null,
    supplierId: string | null,
  ): ReturnType<ProductMatchingService['matchProduct']> {
    return this.#productMatching.matchProduct(null, designation, supplierId);
  }

  /**
   * Matches multiple products in parallel.
   * @param products Products to match (array of {rowId, designation})
   * @param supplierId Optional supplier ID for context
   * @returns Observable of array with rowId and matchResult
   */
  matchProducts(
    products: readonly { rowId: string; designation: string | null }[],
    supplierId: string | null,
  ): Observable<readonly IMatchProductsResult[]> {
    const productsToMatch = products.filter((p) => p.designation);
    if (productsToMatch.length === 0) {
      return of([]);
    }

    patchState(this.#state, { isMatching: true });

    const matchObservables = productsToMatch.map((product) =>
      this.#productMatching.matchProduct(null, product.designation, supplierId).pipe(
        catchError(() => of(createNoMatchResult())),
        map((result): IMatchProductsResult => ({ rowId: product.rowId, result })),
      ),
    );

    return forkJoin(matchObservables).pipe(
      tap(() => patchState(this.#state, { isMatching: false })),
      catchError(() => {
        patchState(this.#state, { isMatching: false });
        return of([]);
      }),
    );
  }
}
