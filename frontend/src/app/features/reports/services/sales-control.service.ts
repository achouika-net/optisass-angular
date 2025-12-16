import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface BrouillonInvoice {
    id: string;
    numero: string;
    ficheId?: string;
    dateEmission: Date;
    totalTTC: number;
    resteAPayer: number;
    client: {
        nom?: string;
        prenom?: string;
        raisonSociale?: string;
    };
    paiements?: any[];
    lignes?: any[]; // Snapshot of lines
    statut?: string; // e.g. BROUILLON, VALIDE, PAYEE, PARTIEL
    type?: string; // FACTURE, AVOIR, DEVIS
    proprietes?: {
        typeVente?: string;
        [key: string]: any;
    };
}

export interface VendorStatistics {
    vendorId: string;
    vendorName: string;
    countWithPayment: number;
    countWithoutPayment: number;
    totalAmount: number;
    countValid?: number;
    countAvoir?: number;
    totalArchived?: number;
}

@Injectable({
    providedIn: 'root'
})
export class SalesControlService {
    private apiUrl = `${environment.apiUrl}/sales-control`;

    constructor(private http: HttpClient) { }

    getBrouillonWithPayments(userId?: string): Observable<BrouillonInvoice[]> {
        const params = userId ? { userId } : {};
        return this.http.get<BrouillonInvoice[]>(`${this.apiUrl}/brouillon-with-payments`, { params });
    }

    getBrouillonWithoutPayments(userId?: string): Observable<BrouillonInvoice[]> {
        const params = userId ? { userId } : {};
        return this.http.get<BrouillonInvoice[]>(`${this.apiUrl}/brouillon-without-payments`, { params });
    }

    getValidInvoices(userId?: string): Observable<BrouillonInvoice[]> {
        const params = userId ? { userId } : {};
        return this.http.get<BrouillonInvoice[]>(`${this.apiUrl}/valid-invoices`, { params });
    }

    getArchivedInvoices(userId?: string): Observable<BrouillonInvoice[]> {
        const params = userId ? { userId } : {};
        return this.http.get<BrouillonInvoice[]>(`${this.apiUrl}/archived`, { params });
    }

    getAvoirs(userId?: string): Observable<BrouillonInvoice[]> {
        const params = userId ? { userId } : {};
        return this.http.get<BrouillonInvoice[]>(`${this.apiUrl}/avoirs`, { params });
    }

    getStatistics(): Observable<VendorStatistics[]> {
        return this.http.get<VendorStatistics[]>(`${this.apiUrl}/statistics`);
    }

    validateInvoice(id: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/validate/${id}`, {});
    }

    declareAsGift(id: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/declare-gift/${id}`, {});
    }

    archiveInvoice(id: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/archive/${id}`, {});
    }
}
