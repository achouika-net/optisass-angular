import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Centre } from '../../../shared/interfaces/warehouse.interface';
import { API_URL } from '../../../config/api.config';

@Injectable({
    providedIn: 'root'
})
export class CentersService {
    private apiUrl = `${API_URL}/centers`;

    constructor(private http: HttpClient) { }

    create(centre: Partial<Centre>): Observable<Centre> {
        return this.http.post<Centre>(this.apiUrl, centre);
    }

    findAll(groupeId?: string): Observable<Centre[]> {
        let params = new HttpParams();
        if (groupeId) {
            params = params.set('groupeId', groupeId);
        }
        return this.http.get<Centre[]>(this.apiUrl, { params });
    }

    findOne(id: string): Observable<Centre> {
        return this.http.get<Centre>(`${this.apiUrl}/${id}`);
    }

    update(id: string, centre: Partial<Centre>): Observable<Centre> {
        return this.http.patch<Centre>(`${this.apiUrl}/${id}`, centre);
    }

    delete(id: string): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
    }
}
