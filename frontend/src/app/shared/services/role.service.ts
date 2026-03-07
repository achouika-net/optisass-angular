import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { IRole, PaginatedApiResponse } from '@app/models';
import { ALL_DATA_PAGINATION, ROLES_API_URL } from '@app/config';

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  readonly #http = inject(HttpClient);

  /**
   * Récupérer la liste des roles
   * @return Observable<PaginatedApiResponse<IRole>>
   */
  getRoles(): Observable<PaginatedApiResponse<IRole>> {
    return of({
      data: [
        { id: 2, name: 'G\u00e9rant', is_reference: true, groupe_id: null },
        { id: 3, name: 'Centre', is_reference: true, groupe_id: null },
        { id: 6, name: 'Secr\u00e9taire', is_reference: true, groupe_id: null },
        { id: 7, name: 'Comptable', is_reference: true, groupe_id: null },
        { id: 68, name: 'Centre_GF', is_reference: false, groupe_id: 513 },
        { id: 73, name: 'testactu', is_reference: false, groupe_id: 513 },
        { id: 69, name: 'test333', is_reference: false, groupe_id: 513 },
        { id: 70, name: 'tesiooo', is_reference: false, groupe_id: 513 },
        { id: 75, name: 'testthib', is_reference: false, groupe_id: 513 },
        { id: 76, name: 'abcdfe', is_reference: false, groupe_id: 513 },
        { id: 77, name: 'testtt', is_reference: false, groupe_id: 513 },
        { id: 79, name: 'centre22', is_reference: false, groupe_id: 513 },
        { id: 4, name: 'Chef de centre', is_reference: true, groupe_id: null },
        { id: 5, name: 'Responsable qualit\u00e9', is_reference: true, groupe_id: null },
        { id: 80, name: 'test33', is_reference: false, groupe_id: 513 },
      ] as IRole[],
      links: {
        first: 'http://websur-gestion-api-sprint.secta.fr/api/roles?page=1',
        last: 'http://websur-gestion-api-sprint.secta.fr/api/roles?page=1',
        prev: null,
        next: null,
      },
      meta: {
        current_page: 1,
        from: 1,
        last_page: 1,
        links: [
          { url: null, label: '&laquo; Previous', active: false },
          {
            url: 'http://websur-gestion-api-sprint.secta.fr/api/roles?page=1',
            label: '1',
            active: true,
          },
          { url: null, label: 'Next &raquo;', active: false },
        ],
        path: 'http://websur-gestion-api-sprint.secta.fr/api/roles',
        per_page: -1,
        to: 15,
        total: 15,
      },
    });
    return this.#http.get<PaginatedApiResponse<IRole>>(`${ROLES_API_URL}?${ALL_DATA_PAGINATION}`);
  }
}
