import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface StockMovement {
    id: string;
    type: string;
    quantite: number;
    dateMovement: string;
    motif: string;
    utilisateur: string;
    entrepotSource?: { nom: string };
    entrepotDestination?: { nom: string };
}

import { API_URL } from '../../../config/api.config';

@Injectable({
    providedIn: 'root'
})
export class StockMovementsService {
    private apiUrl = `${API_URL}/stock-movements`;

    constructor(private http: HttpClient) { }

    getHistory(productId: string): Observable<StockMovement[]> {
        return this.http.get<StockMovement[]>(`${this.apiUrl}/product/${productId}`);
    }
}
