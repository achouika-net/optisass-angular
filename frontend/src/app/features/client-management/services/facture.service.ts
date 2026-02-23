import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LigneFacture {
    description: string;
    qte: number;
    prixUnitaireTTC: number;
    remise: number;
    totalTTC: number;
}

export type FactureStatus = 'BROUILLON' | 'VALIDE' | 'PAYEE' | 'ANNULEE' | 'PARTIEL' | 'DEVIS_EN_COURS' | 'DEVIS_SANS_PAIEMENT' | 'VENTE_EN_INSTANCE' | 'ARCHIVE' | 'BON_DE_COMMANDE';

export interface Facture {
    id: string;
    numero: string;
    type: 'FACTURE' | 'DEVIS' | 'AVOIR' | 'BL' | 'BON_COMM' | 'BON_COMMANDE';
    dateEmission: Date;

    dateEcheance?: Date;
    statut: FactureStatus;
    clientId: string;
    ficheId?: string;
    totalHT: number;
    totalTVA: number;
    totalTTC: number;
    resteAPayer: number;
    lignes: LigneFacture[];
    paiements?: import('./paiement.service').Paiement[];  // Array of payments
    proprietes?: any; // For custom properties like nomenclature, discount details
    montantLettres?: string;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
    client?: any;
    centreId?: string;
}

import { API_URL } from '../../../config/api.config';

@Injectable({
    providedIn: 'root'
})
export class FactureService {
    private apiUrl = `${API_URL}/factures`;

    constructor(private http: HttpClient) { }

    findAll(filters?: { clientId?: string, type?: string, statut?: string, ficheId?: string }): Observable<Facture[]> {
        let params = new HttpParams();
        if (filters?.clientId) params = params.set('clientId', filters.clientId);
        if (filters?.ficheId) params = params.set('ficheId', filters.ficheId);
        if (filters?.type) params = params.set('type', filters.type);
        if (filters?.statut) params = params.set('statut', filters.statut);

        return this.http.get<Facture[]>(this.apiUrl, { params });
    }

    findOne(id: string): Observable<Facture> {
        return this.http.get<Facture>(`${this.apiUrl}/${id}`);
    }

    create(facture: Partial<Facture>): Observable<Facture> {
        return this.http.post<Facture>(this.apiUrl, facture);
    }

    update(id: string, facture: Partial<Facture>): Observable<Facture> {
        return this.http.patch<Facture>(`${this.apiUrl}/${id}`, facture);
    }

    delete(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    exchangeInvoice(id: string, itemsToReturn: { lineIndex: number, quantiteRetour: number, reason: string }[]): Observable<any> {
        return this.http.post(`${this.apiUrl}/${id}/exchange`, { itemsToReturn });
    }

    checkAvailability(id: string): Observable<any> {
        return this.http.get(`${this.apiUrl}/${id}/check-availability`);
    }
}

