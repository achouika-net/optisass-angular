import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Sort } from '@angular/material/sort';
import { USERS_API_URL } from '@app/config';
import { getQuery } from '@app/helpers';
import { PaginatedApiResponse } from '@app/models';
import { Observable } from 'rxjs';
import { IUser, IUserSearch } from '../models';

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
    sort: Sort = null,
  ): Observable<PaginatedApiResponse<IUser>> {
    const params: HttpParams = getQuery(searchForm, page, pageSize, sort);
    return this.#http.get<PaginatedApiResponse<IUser>>(`${USERS_API_URL}`, { params });
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
