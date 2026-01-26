import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';

export interface BulkAlimentationPayload {
    numeroFacture: string;
    dateEmission: string;
    type: string;
    fournisseurId: string;
    centreId?: string;
    base64File?: string;
    fileName?: string;
    dateEcheance?: string;
    allocations: {
        productId?: string;
        reference: string;
        nom: string;
        marque?: string;
        categorie: string;
        warehouseId: string;
        quantite: number;
        prixAchat: number;
        prixVente: number;
        tva: number;
        couleur?: string;
        materiau?: string;
        forme?: string;
        genre?: string;
        calibre?: string;
        pont?: string;
    }[];
}

@Injectable({
    providedIn: 'root'
})
export class StockAlimentationService {
    private apiUrl = `${environment.apiUrl}/api/stock-movements`;

    constructor(private http: HttpClient) { }

    bulkAlimentation(payload: BulkAlimentationPayload): Observable<any> {
        return this.http.post(`${this.apiUrl}/bulk-alimentation`, payload);
    }
}
