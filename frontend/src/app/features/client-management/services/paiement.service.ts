import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Paiement {
    id: string;
    montant: number;
    date: Date;
    mode: 'ESPECES' | 'CHEQUE' | 'CARTE' | 'VIREMENT' | 'AUTRE';
    reference?: string;
    notes?: string;
    factureId: string;
    facture?: any;
    createdAt?: string;
    updatedAt?: string;
    // New fields
    dateVersement?: string;
    banque?: string;
    remarque?: string;
    tiersNom?: string;
    tiersCin?: string;
    pieceJointe?: string;
}

export interface CreatePaiementDto {
    factureId: string;
    montant: number;
    date?: string;
    mode: string;
    reference?: string;
    notes?: string;
    // New fields
    dateVersement?: string;
    banque?: string;
    remarque?: string;
    tiersNom?: string;
    tiersCin?: string;
    pieceJointe?: string;
}

@Injectable({
    providedIn: 'root'
})
export class PaiementService {
    private apiUrl = `${environment.apiUrl}/paiements`;

    constructor(private http: HttpClient) { }

    findAll(factureId?: string): Observable<Paiement[]> {
        let params = new HttpParams();
        if (factureId) params = params.set('factureId', factureId);

        return this.http.get<Paiement[]>(this.apiUrl, { params });
    }

    findOne(id: string): Observable<Paiement> {
        return this.http.get<Paiement>(`${this.apiUrl}/${id}`);
    }

    create(paiement: CreatePaiementDto): Observable<Paiement> {
        return this.http.post<Paiement>(this.apiUrl, paiement);
    }

    update(id: string, paiement: Partial<CreatePaiementDto>): Observable<Paiement> {
        return this.http.patch<Paiement>(`${this.apiUrl}/${id}`, paiement);
    }

    delete(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }
}
