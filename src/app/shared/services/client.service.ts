import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Sort } from '@angular/material/sort';
import { CLIENTS_API_URL } from '@app/config';
import { IClient, IClientSearch, PaginatedApiResponse } from '@app/models';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { IClientStatistics, MOCK_CLIENT, MOCK_CLIENTS, MOCK_CLIENT_STATISTICS } from '../mocks';

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    searchForm: IClientSearch,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    page: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    pageSize: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    sort?: Sort,
  ): Observable<PaginatedApiResponse<IClient>> {
    // Mock data with a small delay to simulate API call
    const mockResponse = new PaginatedApiResponse<IClient>(MOCK_CLIENTS);
    return of(mockResponse).pipe(delay(300));
  }

  /**
   * Récupérer le detail d'un client
   * @param {number} id
   * @return {Observable<IClient>}
   */
  getClient(id: number): Observable<IClient> {
    // Mock data with a small delay to simulate API call
    return of({ ...MOCK_CLIENT, id }).pipe(delay(300));
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

  /**
   * Récupérer les statistiques des clients
   * @return {Observable<IClientStatistics>}
   */
  getClientsStatistics(): Observable<IClientStatistics> {
    // Mock data with a small delay to simulate API call
    return of(MOCK_CLIENT_STATISTICS).pipe(delay(300));
  }
}
