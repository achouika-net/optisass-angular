import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Sort } from '@angular/material/sort';
import { CLIENTS_API_URL } from '@app/config';
import { getQuery } from '@app/helpers';
import {
  IClient,
  IClientSearchRequest,
  IClientSearchResponse,
  PaginatedApiResponse,
} from '@app/models';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ClientService {
  #http = inject(HttpClient);

  /**
   * récupérer la liste des client
   * @return Observable<PaginatedApiResponse<IClient>>
   * @param {IClientSearchRequest} searchForm
   * @param { number} page
   * @param { number} pageSize
   * @param {Sort} sort
   */
  searchClients(
    searchForm: Partial<IClientSearchRequest>,
    page: number,
    pageSize: number,
    sort: Sort = null
  ): Observable<PaginatedApiResponse<IClientSearchResponse>> {
    const params: HttpParams = getQuery(searchForm, page, pageSize, sort);
    return this.#http.get<PaginatedApiResponse<IClientSearchResponse>>(
      `${CLIENTS_API_URL}`,
      {
        params,
      }
    );
  }

  /**
   * Récupérer le client
   * @param idclient number
   * @return Observable<IClient>
   */
  getClient(idclient: number): Observable<IClient> {
    return this.#http.get<IClient>(`${CLIENTS_API_URL}/${idclient}`);
  }

  /**
   * Ajouter un client
   * @param {client} client
   * @return {Observable<IClient>}
   */
  addClient(client: Partial<IClient>): Observable<IClient> {
    return this.#http.post<IClient>(`${CLIENTS_API_URL}`, client);
  }

  /**
   * Modifier le client
   * @param {number} id
   * @param {Partial<IClient>} data
   * @return {Observable<IClient>}
   */
  updateClient(id: number, data: Partial<IClient>): Observable<IClient> {
    return this.#http.patch<IClient>(`${CLIENTS_API_URL}/${id}`, data);
  }

  /**
   * supprimer un client
   * @param {number} id
   * @return {Observable<void>}
   */
  deleteClient(id: number): Observable<void> {
    return this.#http.delete<void>(`${CLIENTS_API_URL}/${id}`);
  }

  /**
   * Export a xls of clients.
   * @param {IClientSearchRequest} searchForm
   * @returns {Observable<HttpResponse<Blob>>}
   */
  public exportClientXsl(
    searchForm: IClientSearchRequest
  ): Observable<HttpResponse<Blob>> {
    const params: HttpParams = getQuery(searchForm);
    return this.#http.get<Blob>(`${CLIENTS_API_URL}/export`, {
      responseType: 'blob' as 'json',
      observe: 'response',
      params,
    });
  }
}
