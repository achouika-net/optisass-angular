import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface LigneFacture {
    description: string;
    qte: number;
    prixUnitaireTTC: number;
    remise: number;
    totalTTC: number;
}

export interface Facture {
    id: string;
    numero: string;
    type: 'FACTURE' | 'DEVIS' | 'AVOIR' | 'BL';
    dateEmission: Date;
    dateEcheance?: Date;
    statut: 'BROUILLON' | 'VALIDE' | 'PAYEE' | 'ANNULEE' | 'PARTIEL';
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
}

@Injectable({
    providedIn: 'root'
})
export class FactureService {
    private apiUrl = `${environment.apiUrl}/factures`;

    constructor(private http: HttpClient) { }

    findAll(filters?: { clientId?: string, type?: string, statut?: string }): Observable<Facture[]> {
        let params = new HttpParams();
        if (filters?.clientId) params = params.set('clientId', filters.clientId);
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
}

