import { Injectable } from '@angular/core';
import { SUPPLIERS_API_URL } from '@app/config';
import { PaginatedApiResponse, ISupplier, ISupplierSearchRequest } from '@app/models';
import { delay, Observable, of } from 'rxjs';
import { MOCK_SUPPLIERS } from './resource.service.mock';

let nextSupplierId = 100;

// TODO: Inject HttpClient when backend is ready

@Injectable({ providedIn: 'root' })
export class SupplierService {
  /**
   * Retrieves all active suppliers.
   * @returns Observable of active suppliers array
   */
  getActiveSuppliers(): Observable<ISupplier[]> {
    // TODO: Uncomment when backend is ready
    // return this.#http.get<ISupplier[]>(`${SUPPLIERS_API_URL}?active=true`);
    return of(MOCK_SUPPLIERS.filter((s) => s.active));
  }

  /**
   * Searches suppliers with pagination.
   * @param request The search request
   * @returns Observable of paginated suppliers
   */
  search(request: ISupplierSearchRequest): Observable<PaginatedApiResponse<ISupplier>> {
    // TODO: Uncomment when backend is ready
    // return this.#http.get<PaginatedApiResponse<Supplier>>(SUPPLIERS_API_URL, { params: request as unknown as Record<string, string> });
    const filtered = MOCK_SUPPLIERS.filter((s) => {
      if (request.query && !s.name.toLowerCase().includes(request.query.toLowerCase()))
        return false;
      if (request.active !== null && s.active !== request.active) return false;
      return true;
    });
    return of({
      data: filtered,
      meta: {
        current_page: 1,
        from: 1,
        last_page: 1,
        path: SUPPLIERS_API_URL,
        per_page: 10,
        to: filtered.length,
        total: filtered.length,
      },
      links: { first: '', last: '', prev: null, next: null },
    });
  }

  /**
   * Retrieves a supplier by ID.
   * @param id The supplier ID
   * @returns Observable of the supplier
   */
  getById(id: string): Observable<ISupplier> {
    // TODO: Uncomment when backend is ready
    // return this.#http.get<ISupplier>(`${SUPPLIERS_API_URL}/${id}`);
    const supplier = MOCK_SUPPLIERS.find((s) => s.id === id);
    return of(supplier!);
  }

  /**
   * Creates a new supplier.
   * If supplier.id is null, backend creates a new supplier.
   * @param supplier The supplier data
   * @returns Observable of the created supplier with assigned ID
   */
  create(supplier: ISupplier): Observable<ISupplier> {
    // TODO: Replace mock with HTTP call when backend is ready
    // return this.#http.post<ISupplier>(SUPPLIERS_API_URL, supplier);
    const newSupplier: ISupplier = {
      ...supplier,
      id: String(nextSupplierId++),
      code: `SUP${String(nextSupplierId).padStart(4, '0')}`,
      createdAt: new Date(),
      updatedAt: null,
    };
    return of(newSupplier).pipe(delay(200));
  }
}
