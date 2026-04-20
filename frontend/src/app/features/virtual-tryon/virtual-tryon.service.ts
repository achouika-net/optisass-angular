import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class VirtualTryonService {
    private baseUrl = '/api/virtual-tryon';

    constructor(private http: HttpClient) { }

    /**
     * Create new virtual try-on session
     */
    createTryon(data: any): Observable<any> {
        return this.http.post(`${this.baseUrl}`, data);
    }

    /**
     * Get client try-on history
     */
    getClientHistory(clientId: string): Observable<any> {
        return this.http.get(`${this.baseUrl}/history/${clientId}`);
    }

    /**
     * Get try-on analytics
     */
    getAnalytics(): Observable<any> {
        return this.http.get(`${this.baseUrl}/analytics`);
    }

    /**
     * Delete try-on session
     */
    deleteTryon(id: string): Observable<any> {
        return this.http.delete(`${this.baseUrl}/${id}`);
    }

    /**
     * Get products available for try-on
     */
    getProducts(): Observable<any[]> {
        return this.http.get<any[]>('/api/products?type=GLASSES,SUNGLASSES');
    }
}
