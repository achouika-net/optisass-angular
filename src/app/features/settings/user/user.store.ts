import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, Signal } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { Sort } from '@angular/material/sort';
import { Params, Router } from '@angular/router';
import { DEFAULT_PAGE_SIZE } from '@app/config';
import { IRole, PaginatedApiResponse } from '@app/models';
import { ErrorService, RoleService } from '@app/services';
import { patchState, signalState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { catchError, of, pipe, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { selectRouteParams } from '../../../core/store/router/router.selector';
import { IUser, IUserSearch, UserSearch } from './models';
import { UserService } from './services/user.service';

interface UserState {
  users: PaginatedApiResponse<IUser>;
  user: IUser;
  searchForm: IUserSearch;
  sort: Sort;
  pageEvent: PageEvent;
  roles: IRole[];
}
const initialState: UserState = {
  users: null,
  user: null,
  searchForm: new UserSearch(),
  sort: { active: 'first_name', direction: 'desc' },
  pageEvent: {
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
    length: 0,
  },
  roles: [],
};
@Injectable()
export class UserStore {
  readonly state = signalState(initialState);
  readonly #router = inject(Router);
  readonly #userService = inject(UserService);
  readonly #errorService = inject(ErrorService);
  readonly #toastr = inject(ToastrService);
  readonly #translate = inject(TranslateService);
  readonly #roleService = inject(RoleService);
  readonly #store = inject(Store);
  #id = computed<number>(() => +this.#store.selectSignal<Params>(selectRouteParams)()['id']);

  constructor() {
    this.#getRoles();
  }

  readonly #setWsError = (error: HttpErrorResponse, errorMessage: string) => {
    this.#errorService.getError(error, `user.errors.${errorMessage}`, true);
    return of(error);
  };
  setSort = (sort: Sort) =>
    patchState(this.state, ({ pageEvent }) => ({
      sort,
      pageEvent: { ...pageEvent, pageIndex: 0 },
    }));

  setPageEvent = (pageEvent: PageEvent) => patchState(this.state, { pageEvent });
  setSearchForm = (searchForm: IUserSearch) =>
    patchState(this.state, ({ pageEvent }) => ({
      searchForm,
      pageEvent: { ...pageEvent, pageIndex: 0 },
    }));

  resetSearchForm = () => patchState(this.state, { searchForm: new UserSearch() });
  resetUser = () => patchState(this.state, { user: null });

  goToSearchPage = rxMethod<void>(
    pipe(tap(() => void this.#router.navigate(['/p/settings/users'])))
  );
  #getRoles = rxMethod<void>(
    pipe(
      switchMap(() =>
        this.#roleService.getRoles().pipe(
          tap((roles: PaginatedApiResponse<IRole>) =>
            patchState(this.state, { roles: roles.data })
          ),
          catchError((error: HttpErrorResponse) => {
            return this.#setWsError(error, 'getRoles');
          })
        )
      )
    )
  );
  searchUsers = rxMethod<void>(
    pipe(
      switchMap(() => {
        return this.#userService
          .searchUsers(
            this.state.searchForm(),
            this.state.pageEvent().pageIndex + 1,
            this.state.pageEvent().pageSize,
            this.state.sort()
          )
          .pipe(
            tap((users: PaginatedApiResponse<IUser>) => {
              patchState(this.state, { users });
            }),
            catchError((error: HttpErrorResponse) => this.#setWsError(error, 'searchUsers'))
          );
      })
    )
  );
  getUser = rxMethod<void>(
    pipe(
      switchMap(() =>
        this.#userService.getUser(this.#id()).pipe(
          tap((user: IUser) => patchState(this.state, { user })),
          catchError((error: HttpErrorResponse) => {
            this.goToSearchPage();
            return this.#setWsError(error, 'getUser');
          })
        )
      )
    )
  );

  addUser = rxMethod<IUser>(
    pipe(
      switchMap((user: IUser) =>
        this.#userService.addUser(user).pipe(
          tap(() => {
            this.#toastr.success(this.#translate.instant('commun.operationTerminee'));
            this.goToSearchPage();
          }),
          catchError((errorResponse: HttpErrorResponse) => {
            return this.#setWsError(
              errorResponse,
              errorResponse.status === 422 && 'email' in errorResponse.error.errors
                ? 'emailError'
                : 'addUser'
            );
          })
        )
      )
    )
  );
  updateUser = rxMethod<Partial<IUser>>(
    pipe(
      switchMap((user: Partial<IUser>) =>
        this.#userService.updateUser(this.#id(), user).pipe(
          tap((user: IUser) => {
            patchState(this.state, { user });
            this.#toastr.success(this.#translate.instant('commun.operationTerminee'));
          }),
          catchError((errorResponse: HttpErrorResponse) =>
            this.#setWsError(
              errorResponse,
              errorResponse.status === 422 && 'email' in errorResponse.error.errors
                ? 'emailError'
                : 'updateUser'
            )
          )
        )
      )
    )
  );
  deleteUser = rxMethod<number>(
    pipe(
      switchMap((id: number) =>
        this.#userService.deleteUser(id).pipe(
          tap(() => {
            this.#toastr.success(this.#translate.instant('commun.operationTerminee'));
            this.searchUsers();
          }),
          catchError((error: HttpErrorResponse) => this.#setWsError(error, 'deleteUser'))
        )
      )
    )
  );
}
