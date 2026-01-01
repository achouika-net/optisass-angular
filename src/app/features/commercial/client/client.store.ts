import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';
import { Router } from '@angular/router';
import { DEFAULT_PAGE_SIZE } from '@app/config';
import { ClientSearch, IClient, IClientSearch, PaginatedApiResponse } from '@app/models';
import { ClientService, ErrorService } from '@app/services';
import { patchState, signalState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { catchError, of, pipe, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';

interface ClientState {
  clients: PaginatedApiResponse<IClient>;
  client: IClient;
  searchForm: IClientSearch;
  sort: Sort;
  pageEvent: PageEvent;
}

const initialState: ClientState = {
  clients: null,
  client: null,
  searchForm: new ClientSearch(),
  sort: { active: 'lastName', direction: 'desc' },
  pageEvent: {
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
    length: 0,
  },
};

@Injectable()
export class ClientStore {
  readonly state = signalState(initialState);
  readonly #router = inject(Router);
  readonly #clientService = inject(ClientService);
  readonly #errorService = inject(ErrorService);
  readonly #toastr = inject(ToastrService);
  readonly #translate = inject(TranslateService);

  readonly #setWsError = (error: HttpErrorResponse, errorMessage: string) => {
    this.#errorService.getError(error, `client.errors.${errorMessage}`, true);
    return of(error);
  };

  setSort = (sort: Sort) =>
    patchState(this.state, ({ pageEvent }) => ({
      sort,
      pageEvent: { ...pageEvent, pageIndex: 0 },
    }));

  setPageEvent = (pageEvent: PageEvent) => patchState(this.state, { pageEvent });

  setSearchForm = (searchForm: IClientSearch) =>
    patchState(this.state, ({ pageEvent }) => ({
      searchForm,
      pageEvent: { ...pageEvent, pageIndex: 0 },
    }));

  resetSearchForm = () => patchState(this.state, { searchForm: new ClientSearch() });

  resetClient = () => patchState(this.state, { client: null });

  goToSearchPage = rxMethod<void>(
    pipe(tap(() => void this.#router.navigate(['/p/commercial/clients'])))
  );

  searchClients = rxMethod<void>(
    pipe(
      switchMap(() => {
        return this.#clientService
          .searchClients(
            this.state.searchForm(),
            this.state.pageEvent().pageIndex + 1,
            this.state.pageEvent().pageSize,
            this.state.sort()
          )
          .pipe(
            tap((clients: PaginatedApiResponse<IClient>) => {
              patchState(this.state, { clients });
            }),
            catchError((error: HttpErrorResponse) => {
              return this.#setWsError(error, 'searchClients');
            })
          );
      })
    )
  );

  getClient = rxMethod<number>(
    pipe(
      switchMap((id) => {
        return this.#clientService.getClient(id).pipe(
          tap((client: IClient) => {
            patchState(this.state, { client });
          }),
          catchError((error: HttpErrorResponse) => {
            return this.#setWsError(error, 'getClient');
          })
        );
      })
    )
  );

  addClient = rxMethod<IClient>(
    pipe(
      switchMap((client: IClient) => {
        return this.#clientService.addClient(client).pipe(
          tap(() => {
            this.#toastr.success(this.#translate.instant('client.messages.add_success'));
            this.goToSearchPage();
          }),
          catchError((error: HttpErrorResponse) => {
            return this.#setWsError(error, 'addClient');
          })
        );
      })
    )
  );

  updateClient = rxMethod<{ id: number; client: Partial<IClient> }>(
    pipe(
      switchMap(({ id, client }) => {
        return this.#clientService.updateClient(id, client).pipe(
          tap(() => {
            this.#toastr.success(this.#translate.instant('client.messages.update_success'));
            this.goToSearchPage();
          }),
          catchError((error: HttpErrorResponse) => {
            return this.#setWsError(error, 'updateClient');
          })
        );
      })
    )
  );

  deleteClient = rxMethod<number>(
    pipe(
      switchMap((id: number) => {
        return this.#clientService.deleteClient(id).pipe(
          tap(() => {
            this.#toastr.success(this.#translate.instant('client.messages.delete_success'));
            this.searchClients();
          }),
          catchError((error: HttpErrorResponse) => {
            return this.#setWsError(error, 'deleteClient');
          })
        );
      })
    )
  );
}
