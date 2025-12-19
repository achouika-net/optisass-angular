import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Entrepot, StockSummary } from '../../../shared/interfaces/warehouse.interface';
import { API_URL } from '../../../config/api.config';

@Injectable({
    providedIn: 'root'
})
export class WarehousesService {
    private apiUrl = `${API_URL}/warehouses`;

    constructor(private http: HttpClient) { }

    create(entrepot: Partial<Entrepot>): Observable<Entrepot> {
        return this.http.post<Entrepot>(this.apiUrl, entrepot);
    }

    findAll(centreId?: string): Observable<Entrepot[]> {
        let params = new HttpParams();
        if (centreId) {
            params = params.set('centreId', centreId);
        }
        return this.http.get<Entrepot[]>(this.apiUrl, { params });
    }

    findOne(id: string): Observable<Entrepot> {
        return this.http.get<Entrepot>(`${this.apiUrl}/${id}`);
    }

    getStockSummary(id: string): Observable<StockSummary> {
        return this.http.get<StockSummary>(`${this.apiUrl}/${id}/stock`);
    }

    update(id: string, entrepot: Partial<Entrepot>): Observable<Entrepot> {
        return this.http.patch<Entrepot>(`${this.apiUrl}/${id}`, entrepot);
    }

    delete(id: string): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
    }
}
