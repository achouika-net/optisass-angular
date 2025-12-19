import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ALL_DATA_PAGINATION, API_URL } from '@app/config';
import { ICivilite, PaginatedApiResponse } from '@app/models';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ResourcesService {
  #http = inject(HttpClient);

  getCivilites(): Observable<PaginatedApiResponse<ICivilite>> {
    return this.#http.get<PaginatedApiResponse<ICivilite>>(
      `${API_URL}civilites?${ALL_DATA_PAGINATION}`
    );
  }
}
