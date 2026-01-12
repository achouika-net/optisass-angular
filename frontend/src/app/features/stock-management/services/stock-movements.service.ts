import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface StockMovement {
    id: string;
    type: string;
    quantite: number;
    dateMovement: string;
    motif: string;
    utilisateur: string;
    prixAchatUnitaire?: number;
    prixVenteUnitaire?: number;
    entrepotSource?: { nom: string };
    entrepotDestination?: { nom: string };
    facture?: {
        numero: string;
        fiche?: {
            id: string;
        };
        client?: {
            nom?: string;
            prenom?: string;
            raisonSociale?: string;
        };
    };
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

    getStockEntryHistory(filters?: { dateFrom?: string; dateTo?: string; supplierId?: string; docType?: string; centreId?: string }): Observable<any[]> {
        const params: any = {};
        if (filters?.dateFrom) params.dateFrom = filters.dateFrom;
        if (filters?.dateTo) params.dateTo = filters.dateTo;
        if (filters?.supplierId) params.supplierId = filters.supplierId;
        if (filters?.docType) params.docType = filters.docType;
        if (filters?.centreId) params.centreId = filters.centreId;

        return this.http.get<any[]>(`${this.apiUrl}/history`, { params });
    }

    getStockOutHistory(filters?: { dateFrom?: string; dateTo?: string; search?: string; centreId?: string }): Observable<any[]> {
        const params: any = {};
        if (filters?.dateFrom) params.dateFrom = filters.dateFrom;
        if (filters?.dateTo) params.dateTo = filters.dateTo;
        if (filters?.search) params.search = filters.search;
        if (filters?.centreId) params.centreId = filters.centreId;

        return this.http.get<any[]>(`${this.apiUrl}/out-history`, { params });
    }

    deleteHistory(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/history/${id}`);
    }
}
