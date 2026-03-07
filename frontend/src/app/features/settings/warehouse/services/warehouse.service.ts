// TODO: Uncomment when backend is ready
// import { HttpClient, HttpParams } from '@angular/common/http';
// import { inject } from '@angular/core';
// import { WAREHOUSES_API_URL } from '@app/config';
// import { getQuery } from '@app/helpers';
import { Injectable } from '@angular/core';
import { Sort } from '@angular/material/sort';
import { PaginatedApiResponse } from '@app/models';
import { Observable } from 'rxjs';
import { IWarehouse, IWarehouseSearch } from '../models';
import {
  mockAddWarehouse,
  mockDeleteWarehouse,
  mockGetWarehouse,
  mockSearchWarehouses,
  mockUpdateWarehouse,
} from './warehouse.mock';

@Injectable({ providedIn: 'root' })
export class WarehouseService {
  // TODO: Uncomment when backend is ready
  // readonly #http = inject(HttpClient);

  /**
   * Recherche des entrepôts avec pagination et tri.
   * @param searchForm - Critères de recherche
   * @param page - Numéro de page
   * @param pageSize - Taille de page
   * @param sort - Tri
   */
  searchWarehouses(
    searchForm: IWarehouseSearch,
    page: number,
    pageSize: number,
    sort: Sort | null = null,
  ): Observable<PaginatedApiResponse<IWarehouse>> {
    // TODO: Remplacer par appel API réel quand backend prêt
    // const params: HttpParams = getQuery(searchForm, page, pageSize, sort);
    // return this.#http.get<PaginatedApiResponse<IWarehouse>>(WAREHOUSES_API_URL, { params });

    return mockSearchWarehouses(searchForm, page, pageSize, sort);
  }

  /**
   * Récupère un entrepôt par son ID.
   * @param id - ID de l'entrepôt
   */
  getWarehouse(id: number): Observable<IWarehouse> {
    // TODO: Remplacer par appel API réel
    // return this.#http.get<IWarehouse>(`${WAREHOUSES_API_URL}/${id}`);

    return mockGetWarehouse(id);
  }

  /**
   * Ajoute un nouvel entrepôt.
   * @param warehouse - Données de l'entrepôt
   */
  addWarehouse(warehouse: Omit<IWarehouse, 'id'>): Observable<IWarehouse> {
    // TODO: Remplacer par appel API réel
    // return this.#http.post<IWarehouse>(WAREHOUSES_API_URL, warehouse);

    return mockAddWarehouse(warehouse);
  }

  /**
   * Met à jour un entrepôt existant.
   * @param id - ID de l'entrepôt
   * @param warehouse - Données partielles à mettre à jour
   */
  updateWarehouse(id: number, warehouse: Partial<IWarehouse>): Observable<IWarehouse> {
    // TODO: Remplacer par appel API réel
    // return this.#http.patch<IWarehouse>(`${WAREHOUSES_API_URL}/${id}`, warehouse);

    return mockUpdateWarehouse(id, warehouse);
  }

  /**
   * Supprime un entrepôt.
   * @param id - ID de l'entrepôt
   */
  deleteWarehouse(id: number): Observable<void> {
    // TODO: Remplacer par appel API réel
    // return this.#http.delete<void>(`${WAREHOUSES_API_URL}/${id}`);

    return mockDeleteWarehouse(id);
  }
}
