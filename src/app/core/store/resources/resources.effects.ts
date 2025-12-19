import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ICivilite, IWsError, PaginatedApiResponse, WsErrorClass } from '@app/models';
import { ResourcesService } from '@app/services';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { catchError, finalize, map, of, switchMap } from 'rxjs';
import {
  GetCivilites,
  GetCivilitesError,
  GetCivilitesSuccess,
  SetCalledRessources,
} from './resources.actions';

@Injectable()
export class ResourcesEffects {
  #actions$ = inject(Actions);
  #store = inject(Store);
  #resourcesService = inject(ResourcesService);
  #toastr = inject(ToastrService);
  #translate = inject(TranslateService);

  GetCivilites$ = createEffect(() =>
    this.#actions$.pipe(
      ofType(GetCivilites),
      switchMap(() =>
        this.#resourcesService.getCivilites().pipe(
          map((response: PaginatedApiResponse<ICivilite>) =>
            GetCivilitesSuccess({ civilites: response.data })
          ),
          catchError((error: HttpErrorResponse) => {
            const iWsError: IWsError = new WsErrorClass(error);
            this.#toastr.error(
              this.#translate.instant('error.resources', {
                value: 'civilites',
              })
            );
            return of(GetCivilitesError({ error: { ...iWsError } }));
          }),
          finalize(() =>
            this.#store.dispatch(SetCalledRessources({ ressource: 'civilites', value: true }))
          )
        )
      )
    )
  );
}
