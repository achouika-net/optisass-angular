import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../../config/api.config';
// Remove environment import if unused
// import { environment } from '../../../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class AccountingService {
    private apiUrl = `${API_URL}/accounting`;

    constructor(private http: HttpClient) { }

    exportSage(startDate: string, endDate: string, centreId?: string): Observable<Blob> {
        return this.http.get(`${this.apiUrl}/export/sage`, {
            params: { startDate, endDate, centreId: centreId || '' },
            responseType: 'blob'
        });
    }

    exportPdf(startDate: string, endDate: string, centreId?: string): Observable<Blob> {
        return this.http.get(`${this.apiUrl}/export/pdf`, {
            params: { startDate, endDate, centreId: centreId || '' },
            responseType: 'blob'
        });
    }

    exportBalance(startDate: string, endDate: string, centreId?: string): Observable<Blob> {
        return this.http.get(`${this.apiUrl}/export/balance`, {
            params: { startDate, endDate, centreId: centreId || '' },
            responseType: 'blob'
        });
    }

    exportBilan(startDate: string, endDate: string, centreId?: string): Observable<Blob> {
        return this.http.get(`${this.apiUrl}/export/bilan`, {
            params: { startDate, endDate, centreId: centreId || '' },
            responseType: 'blob'
        });
    }
}
