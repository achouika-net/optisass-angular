import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';
import { Router } from '@angular/router';
import { DEFAULT_PAGE_SIZE } from '@app/config';
import { PaginatedApiResponse } from '@app/models';
import { ErrorService } from '@app/services';
import { patchState, signalState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { catchError, of, pipe, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IWarehouse, IWarehouseSearch, WarehouseSearch } from './models';
import { WarehouseService } from './services/warehouse.service';

interface WarehouseState {
  warehouses: PaginatedApiResponse<IWarehouse> | null;
  warehouse: IWarehouse | null;
  searchForm: IWarehouseSearch;
  sort: Sort;
  pageEvent: PageEvent;
}

const initialState: WarehouseState = {
  warehouses: null,
  warehouse: null,
  searchForm: new WarehouseSearch(),
  sort: { active: 'name', direction: 'asc' },
  pageEvent: {
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
    length: 0,
  },
};

@Injectable()
export class WarehouseStore {
  readonly state = signalState(initialState);
  readonly #router = inject(Router);
  readonly #warehouseService = inject(WarehouseService);
  readonly #errorService = inject(ErrorService);
  readonly #toastr = inject(ToastrService);
  readonly #translate = inject(TranslateService);

  readonly #setWsError = (error: HttpErrorResponse, errorMessage: string) => {
    this.#errorService.getError(error, `warehouse.errors.${errorMessage}`, true);
    return of(error);
  };

  setSort = (sort: Sort) =>
    patchState(this.state, ({ pageEvent }) => ({
      sort,
      pageEvent: { ...pageEvent, pageIndex: 0 },
    }));

  setPageEvent = (pageEvent: PageEvent) => patchState(this.state, { pageEvent });

  setSearchForm = (searchForm: IWarehouseSearch) =>
    patchState(this.state, ({ pageEvent }) => ({
      searchForm,
      pageEvent: { ...pageEvent, pageIndex: 0 },
    }));

  resetSearchForm = () => patchState(this.state, { searchForm: new WarehouseSearch() });

  resetWarehouse = () => patchState(this.state, { warehouse: null });

  goToSearchPage = rxMethod<void>(
    pipe(tap(() => void this.#router.navigate(['/p/settings/warehouses'])))
  );

  searchWarehouses = rxMethod<void>(
    pipe(
      switchMap(() => {
        return this.#warehouseService
          .searchWarehouses(
            this.state.searchForm(),
            this.state.pageEvent().pageIndex + 1,
            this.state.pageEvent().pageSize,
            this.state.sort()
          )
          .pipe(
            tap((warehouses: PaginatedApiResponse<IWarehouse>) => {
              patchState(this.state, { warehouses });
            }),
            catchError((error: HttpErrorResponse) => this.#setWsError(error, 'searchWarehouses'))
          );
      })
    )
  );

  getWarehouse = rxMethod<number>(
    pipe(
      switchMap((id: number) =>
        this.#warehouseService.getWarehouse(id).pipe(
          tap((warehouse: IWarehouse) => patchState(this.state, { warehouse })),
          catchError((error: HttpErrorResponse) => {
            this.goToSearchPage();
            return this.#setWsError(error, 'getWarehouse');
          })
        )
      )
    )
  );

  addWarehouse = rxMethod<Omit<IWarehouse, 'id'>>(
    pipe(
      switchMap((warehouse: Omit<IWarehouse, 'id'>) =>
        this.#warehouseService.addWarehouse(warehouse).pipe(
          tap(() => {
            this.#toastr.success(this.#translate.instant('commun.operationTerminee'));
            this.goToSearchPage();
          }),
          catchError((error: HttpErrorResponse) => this.#setWsError(error, 'addWarehouse'))
        )
      )
    )
  );

  updateWarehouse = rxMethod<{ id: number; warehouse: Partial<IWarehouse> }>(
    pipe(
      switchMap(({ id, warehouse }) =>
        this.#warehouseService.updateWarehouse(id, warehouse).pipe(
          tap((updatedWarehouse: IWarehouse) => {
            patchState(this.state, { warehouse: updatedWarehouse });
            this.#toastr.success(this.#translate.instant('commun.operationTerminee'));
          }),
          catchError((error: HttpErrorResponse) => this.#setWsError(error, 'updateWarehouse'))
        )
      )
    )
  );

  deleteWarehouse = rxMethod<number>(
    pipe(
      switchMap((id: number) =>
        this.#warehouseService.deleteWarehouse(id).pipe(
          tap(() => {
            this.#toastr.success(this.#translate.instant('commun.operationTerminee'));
            this.searchWarehouses();
          }),
          catchError((error: HttpErrorResponse) => this.#setWsError(error, 'deleteWarehouse'))
        )
      )
    )
  );
}
