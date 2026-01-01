import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Sort } from '@angular/material/sort';
import { CLIENTS_API_URL } from '@app/config';
import { getQuery } from '@app/helpers';
import { IClient, IClientSearch, PaginatedApiResponse } from '@app/models';
import { Observable } from 'rxjs';

@Injectable()
export class ClientService {
  readonly #http = inject(HttpClient);

  /**
   * Recherche clients via formulaire avancé.
   * @param {IClientSearch} searchForm
   * @param {number} page
   * @param {number} pageSize
   * @param {Sort} sort
   */
  searchClients(
    searchForm: IClientSearch,
    page: number,
    pageSize: number,
    sort: Sort = null
  ): Observable<PaginatedApiResponse<IClient>> {
    const params: HttpParams = getQuery(searchForm, page, pageSize, sort);
    return this.#http.get<PaginatedApiResponse<IClient>>(`${CLIENTS_API_URL}`, { params });
  }

  /**
   * Récupérer le detail d'un client
   * @param {number} id
   * @return {Observable<IClient>}
   */
  getClient(id: number): Observable<IClient> {
    return this.#http.get<IClient>(`${CLIENTS_API_URL}/${id}`);
  }

  /**
   * Ajouter un client
   * @param {IClient} client
   * @return {Observable<IClient>}
   */
  addClient(client: IClient): Observable<IClient> {
    return this.#http.post<IClient>(`${CLIENTS_API_URL}`, client);
  }

  /**
   * Modifier un client
   * @param {number} id
   * @param {Partial<IClient>} client
   * @return {Observable<IClient>}
   */
  updateClient(id: number, client: Partial<IClient>): Observable<IClient> {
    return this.#http.patch<IClient>(`${CLIENTS_API_URL}/${id}`, client);
  }

  /**
   * supprimer un client
   * @param {number} id
   * @return {Observable<void>}
   */
  deleteClient(id: number): Observable<void> {
    return this.#http.delete<void>(`${CLIENTS_API_URL}/${id}`);
  }
}
