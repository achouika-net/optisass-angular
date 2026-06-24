import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, timeout, catchError, throwError } from 'rxjs';
import { API_URL } from '../../../config/api.config';

import { GlassParameters } from '../../../core/models/glass-parameters.model';

@Injectable({
  providedIn: 'root'
})
export class GlassParametersService {
  private apiUrl = `${API_URL}/glass-parameters`;
  private cache$?: Observable<GlassParameters>;

  constructor(private http: HttpClient) {}

  getAll(forceRefresh = false): Observable<GlassParameters> {
    if (!this.cache$ || forceRefresh) {
      this.cache$ = this.http.get<GlassParameters>(`${this.apiUrl}/all`).pipe(
        timeout(10000),
        catchError(err => {
          console.error('[GlassParametersService] Request failed:', err);
          this.cache$ = undefined;
          return throwError(() => err);
        }),
        shareReplay(1)
      );
    }
    console.log('[GlassParametersService] Returning observable for all parameters');
    return this.cache$;
  }

  // Individual methods can be added here if needed for CRUD from components
  createBrand(name: string, margeDefaut?: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/brands`, { name, margeDefaut });
  }

  createMaterial(name: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/materials`, { name });
  }

  createIndex(materialId: string, value: string, label?: string, price?: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/indices`, { materialId, value, label: label || value, price: price || 0 });
  }

  createTreatment(name: string, price?: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/treatments`, { name, price: price || 0 });
  }
}
