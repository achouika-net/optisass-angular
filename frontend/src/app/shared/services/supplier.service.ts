import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { SUPPLIERS_API_URL } from '@app/config';
import { PaginatedApiResponse, ISupplier, ISupplierSearchRequest } from '@app/models';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  #http = inject(HttpClient);

  getActiveSuppliers(): Observable<ISupplier[]> {
    return this.#http.get<any[]>(`${SUPPLIERS_API_URL}?active=true`).pipe(
      map(suppliers => suppliers.map(s => ({ ...s, name: s.nom || s.name })))
    );
  }

  search(request: ISupplierSearchRequest): Observable<PaginatedApiResponse<ISupplier>> {
    let params = new HttpParams();
    if (request.query) params = params.set('query', request.query);
    if (request.active !== undefined && request.active !== null) {
      params = params.set('active', String(request.active));
    }
    return this.#http.get<any[]>(SUPPLIERS_API_URL, { params }).pipe(
      map(suppliers => {
        const mapped = suppliers.map(s => ({ ...s, name: s.nom || s.name }));
        return {
          data: mapped,
          meta: {
            current_page: 1,
            from: 1,
            last_page: 1,
            path: SUPPLIERS_API_URL,
            per_page: mapped.length || 10,
            to: mapped.length,
            total: mapped.length,
          },
          links: { first: '', last: '', prev: null as string | null, next: null as string | null },
        };
      })
    );
  }

  getById(id: string): Observable<ISupplier> {
    return this.#http.get<any>(`${SUPPLIERS_API_URL}/${id}`).pipe(
      map(s => ({ ...s, name: s.nom || s.name }))
    );
  }

  create(supplier: Partial<ISupplier>): Observable<ISupplier> {
    const payload = { ...supplier, nom: supplier.name };
    return this.#http.post<any>(SUPPLIERS_API_URL, payload).pipe(
      map(s => ({ ...s, name: s.nom || s.name }))
    );
  }

  update(id: string, supplier: Partial<ISupplier>): Observable<ISupplier> {
    const payload = { ...supplier, nom: supplier.name };
    return this.#http.put<any>(`${SUPPLIERS_API_URL}/${id}`, payload).pipe(
      map(s => ({ ...s, name: s.nom || s.name }))
    );
  }

  delete(id: string): Observable<void> {
      return this.#http.delete<void>(`${SUPPLIERS_API_URL}/${id}`);
  }
}
