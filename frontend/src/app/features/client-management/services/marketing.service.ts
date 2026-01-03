import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../../config/api.config';

@Injectable({
    providedIn: 'root'
})
export class MarketingService {
    private apiUrl = `${API_URL}/marketing`;

    constructor(private http: HttpClient) { }

    launchCampaign(data: {
        clientIds: string[],
        productIds: string[],
        template: string,
        promoName?: string,
        promoDescription?: string,
        channel?: string
    }): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/campaign/launch`, data);
    }

    getStats(): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/stats`);
    }

    getConfig(): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/config`);
    }

    updateConfig(data: any): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/config`, data);
    }
}
