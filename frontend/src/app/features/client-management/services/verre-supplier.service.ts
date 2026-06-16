import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../../config/api.config';

@Injectable({
  providedIn: 'root'
})
export class VerreSupplierService {
  #http = inject(HttpClient);
  private apiUrl = `${API_URL}/verre-supplier`;

  findAll(filters?: { fournisseurId?: string; glassIndexId?: string; actif?: boolean }): Observable<any[]> {
    const params: any = {};
    if (filters?.fournisseurId) params.fournisseurId = filters.fournisseurId;
    if (filters?.glassIndexId) params.glassIndexId = filters.glassIndexId;
    if (filters?.actif !== undefined) params.actif = String(filters.actif);
    return this.#http.get<any[]>(this.apiUrl, { params });
  }

  compareByGlassIndex(glassIndexId: string): Observable<any> {
    return this.#http.get<any>(`${this.apiUrl}/by-glass/${glassIndexId}`);
  }

  findByFournisseur(fournisseurId: string): Observable<any[]> {
    return this.#http.get<any[]>(`${this.apiUrl}/by-supplier/${fournisseurId}`);
  }

  create(dto: any): Observable<any> {
    return this.#http.post<any>(this.apiUrl, dto);
  }

  update(id: string, dto: any): Observable<any> {
    return this.#http.patch<any>(`${this.apiUrl}/${id}`, dto);
  }

  remove(id: string): Observable<any> {
    return this.#http.delete<any>(`${this.apiUrl}/${id}`);
  }

  recalcMarge(fournisseurId: string, marge: number): Observable<any> {
    return this.#http.post<any>(`${this.apiUrl}/recalc-marge/${fournisseurId}`, { marge });
  }

  ajusterStock(id: string, delta: number, motif: string): Observable<any> {
    return this.#http.post<any>(`${this.apiUrl}/${id}/stock`, { delta, motif });
  }

  getHistoriqueStock(id: string): Observable<any[]> {
    return this.#http.get<any[]>(`${this.apiUrl}/${id}/history`);
  }
}
