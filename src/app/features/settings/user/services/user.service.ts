import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Sort } from '@angular/material/sort';
import { USERS_API_URL } from '@app/config';
import { getQuery } from '@app/helpers';
import { PaginatedApiResponse } from '@app/models';
import { Observable, of } from 'rxjs';
import { IUser, IUserSearch, IUserSearchForm } from '../models';

@Injectable({ providedIn: 'root' })
export class UserService {
  readonly #http = inject(HttpClient);

  /**
   * Recherche utilisateurs via formulaire avancé.
   * @param {IUserSearch} searchForm
   * @param {number} page
   * @param {number} pageSize
   * @param {Sort} sort
   */
  searchUsers(
    searchForm: IUserSearch,
    page: number,
    pageSize: number,
    sort: Sort = null
  ): Observable<PaginatedApiResponse<IUser>> {
    return of({
      data: [
        {
          id: 2738,
          last_name: 'ABDOU',
          first_name: 'Sounouhadji',
          email: 'SECTA-DEV@autosur.com',
          civilite_id: null,
          mobile: '0765445566',
          centres: [
            { id: 5905, role_id: 68 },
            { id: 150134, role_id: 3 },
          ],
          actif: true,
          login: 'testsssagaion',
        } satisfies IUser,
        {
          id: 2740,
          last_name: 'ADOLFF',
          first_name: 'Fr\u00e9d\u00e9ric',
          email: 'SECTA-DEV@autosur.com',
          civilite_id: 8,
          mobile: null,
          centres: [{ id: 5905, role_id: 3 }],
          actif: true,
          login: 'test789456',
        } satisfies IUser,
      ],
      links: {
        first: 'http://websur-gestion-api-sprint.secta.fr/api/utilisateurs?page=1',
        last: 'http://websur-gestion-api-sprint.secta.fr/api/utilisateurs?page=1',
        prev: null,
        next: null,
      },
      meta: {
        current_page: 1,
        from: 1,
        last_page: 1,
        links: [
          {
            url: null,
            label: '&laquo; Previous',
            active: false,
          },
          {
            url: 'http://websur-gestion-api-sprint.secta.fr/api/utilisateurs?page=1',
            label: '1',
            active: true,
          },
          {
            url: null,
            label: 'Next &raquo;',
            active: false,
          },
        ],
        path: 'http://websur-gestion-api-sprint.secta.fr/api/utilisateurs',
        per_page: 20,
        to: 11,
        total: 11,
      },
    });
    const params: HttpParams = getQuery(searchForm, page, pageSize, sort);
    return this.#http.get<PaginatedApiResponse<IUser>>(`${USERS_API_URL}`, {
      params,
    });
  }

  /**
   * Récupérer le detail d'un utilisateur
   * @param {number} id
   * @return {Observable<IUser>}
   */
  getUser(id: number): Observable<IUser> {
    return this.#http.get<IUser>(`${USERS_API_URL}/${id}`);
  }

  /**
   * Ajouter un utilisateur
   * @param {IUser} user
   * @return {Observable<IUser>}
   */
  addUser(user: IUser): Observable<IUser> {
    return this.#http.post<IUser>(`${USERS_API_URL}`, user);
  }

  /**
   * Modifier un utilisateur
   * @param {number} id
   * @param {Partial<IUser>} user
   * @return {Observable<IUser>}
   */
  updateUser(id: number, user: Partial<IUser>): Observable<IUser> {
    return this.#http.patch<IUser>(`${USERS_API_URL}/${id}`, user);
  }

  /**
   * supprimer un utilisateur
   * @param {number} id
   * @return {Observable<void>}
   */
  deleteUser(id: number): Observable<void> {
    return this.#http.delete<void>(`${USERS_API_URL}/${id}`);
  }
}
