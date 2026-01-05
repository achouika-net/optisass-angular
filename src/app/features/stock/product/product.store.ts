import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';
import { Router } from '@angular/router';
import { DEFAULT_PAGE_SIZE } from '@app/config';
import { PaginatedApiResponse, Product } from '@app/models';
import { ErrorService } from '@app/services';
import { patchState, signalState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { catchError, of, pipe, switchMap, tap } from 'rxjs';
import {
  IProductSearch,
  ProductCreateRequest,
  ProductSearch,
  ProductUpdateRequest,
} from './models';
import { ProductService } from './services/product.service';

interface IProductState {
  products: PaginatedApiResponse<Product> | null;
  product: Product | null;
  searchForm: IProductSearch;
  sort: Sort;
  pageEvent: PageEvent;
}

const initialState: IProductState = {
  products: null,
  product: null,
  searchForm: new ProductSearch(),
  sort: { active: 'designation', direction: 'asc' },
  pageEvent: {
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
    length: 0,
  },
};

@Injectable()
export class ProductStore {
  readonly state = signalState(initialState);
  readonly #router = inject(Router);
  readonly #productService = inject(ProductService);
  readonly #errorService = inject(ErrorService);
  readonly #toastr = inject(ToastrService);
  readonly #translate = inject(TranslateService);

  readonly #setWsError = (error: HttpErrorResponse, errorMessage: string) => {
    this.#errorService.getError(error, `stock.errors.${errorMessage}`, true);
    return of(error);
  };

  setSort = (sort: Sort) =>
    patchState(this.state, ({ pageEvent }) => ({
      sort,
      pageEvent: { ...pageEvent, pageIndex: 0 },
    }));

  setPageEvent = (pageEvent: PageEvent) => patchState(this.state, { pageEvent });

  setSearchForm = (searchForm: IProductSearch) =>
    patchState(this.state, ({ pageEvent }) => ({
      searchForm,
      pageEvent: { ...pageEvent, pageIndex: 0 },
    }));

  resetSearchForm = () => patchState(this.state, { searchForm: new ProductSearch() });

  resetProduct = () => patchState(this.state, { product: null });

  goToSearchPage = rxMethod<void>(
    pipe(tap(() => void this.#router.navigate(['/p/stock/products']))),
  );

  searchProducts = rxMethod<void>(
    pipe(
      switchMap(() =>
        this.#productService
          .search(
            this.state.searchForm(),
            this.state.pageEvent().pageIndex + 1,
            this.state.pageEvent().pageSize,
            this.state.sort(),
          )
          .pipe(
            tap((products: PaginatedApiResponse<Product>) => {
              patchState(this.state, { products });
            }),
            catchError((error: HttpErrorResponse) => this.#setWsError(error, 'searchProducts')),
          ),
      ),
    ),
  );

  getProduct = rxMethod<string>(
    pipe(
      switchMap((id: string) =>
        this.#productService.getById(id).pipe(
          tap((product: Product) => patchState(this.state, { product })),
          catchError((error: HttpErrorResponse) => {
            this.goToSearchPage();
            return this.#setWsError(error, 'getProduct');
          }),
        ),
      ),
    ),
  );

  addProduct = rxMethod<ProductCreateRequest>(
    pipe(
      switchMap((request: ProductCreateRequest) =>
        this.#productService.create(request).pipe(
          tap(() => {
            this.#toastr.success(this.#translate.instant('commun.operationTerminee'));
            this.goToSearchPage();
          }),
          catchError((error: HttpErrorResponse) => this.#setWsError(error, 'addProduct')),
        ),
      ),
    ),
  );

  updateProduct = rxMethod<{ id: string; request: ProductUpdateRequest }>(
    pipe(
      switchMap(({ id, request }) =>
        this.#productService.update(id, request).pipe(
          tap((product: Product) => {
            patchState(this.state, { product });
            this.#toastr.success(this.#translate.instant('commun.operationTerminee'));
          }),
          catchError((error: HttpErrorResponse) => this.#setWsError(error, 'updateProduct')),
        ),
      ),
    ),
  );

  deleteProduct = rxMethod<string>(
    pipe(
      switchMap((id: string) =>
        this.#productService.delete(id).pipe(
          tap(() => {
            this.#toastr.success(this.#translate.instant('commun.operationTerminee'));
            this.searchProducts();
          }),
          catchError((error: HttpErrorResponse) => this.#setWsError(error, 'deleteProduct')),
        ),
      ),
    ),
  );
}
