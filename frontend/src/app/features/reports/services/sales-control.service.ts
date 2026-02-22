import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../../config/api.config';

export interface BrouillonInvoice {
    id: string;
    centreId?: string;
    numero: string;
    ficheId?: string;
    dateEmission: Date;
    totalTTC: number;
    resteAPayer: number;
    clientId: string;
    client: {
        nom?: string;
        prenom?: string;
        raisonSociale?: string;
    };
    fiche?: {
        id: string;
        type: string; // MONTURE, LENTILLES
    };
    paiements?: any[];
    lignes?: any[]; // Snapshot of lines
    statut?: string; // e.g. BROUILLON, VALIDE, PAYEE, PARTIEL
    type?: string; // FACTURE, AVOIR, DEVIS
    proprietes?: {
        typeVente?: string;
        [key: string]: any;
    };
    children?: any[];
    parentFacture?: any;
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
    totalFactures?: number;
    totalAvoirs?: number;
    totalBC?: number;
    totalEncaissePeriod?: number;
    totalReste?: number;
    payments?: { methode: string; total: number }[];
}

@Injectable({
    providedIn: 'root'
})
export class SalesControlService {
    private apiUrl = `${API_URL}/sales-control`;

    constructor(private http: HttpClient) { }

    private getParams(startDate?: string, endDate?: string): HttpParams {
        let params = new HttpParams();
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        return params;
    }

    getBrouillonWithPayments(userId?: string, startDate?: string, endDate?: string): Observable<BrouillonInvoice[]> {
        let params = this.getParams(startDate, endDate);
        if (userId) params = params.set('userId', userId);
        return this.http.get<BrouillonInvoice[]>(`${this.apiUrl}/brouillon-with-payments`, { params });
    }

    getBrouillonWithoutPayments(userId?: string, startDate?: string, endDate?: string): Observable<BrouillonInvoice[]> {
        let params = this.getParams(startDate, endDate);
        if (userId) params = params.set('userId', userId);
        return this.http.get<BrouillonInvoice[]>(`${this.apiUrl}/brouillon-without-payments`, { params });
    }

    getValidInvoices(userId?: string, startDate?: string, endDate?: string): Observable<BrouillonInvoice[]> {
        let params = this.getParams(startDate, endDate);
        if (userId) params = params.set('userId', userId);
        return this.http.get<BrouillonInvoice[]>(`${this.apiUrl}/valid-invoices`, { params });
    }

    getAvoirs(userId?: string, startDate?: string, endDate?: string): Observable<BrouillonInvoice[]> {
        let params = this.getParams(startDate, endDate);
        if (userId) params = params.set('userId', userId);
        return this.http.get<BrouillonInvoice[]>(`${this.apiUrl}/avoirs`, { params });
    }

    getStatistics(startDate?: string, endDate?: string): Observable<VendorStatistics[]> {
        const params = this.getParams(startDate, endDate);
        return this.http.get<VendorStatistics[]>(`${this.apiUrl}/statistics`, { params });
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

    getDashboardData(userId?: string, startDate?: string, endDate?: string): Observable<any> {
        let params = this.getParams(startDate, endDate);
        if (userId) params = params.set('userId', userId);
        return this.http.get<any>(`${this.apiUrl}/dashboard-data`, { params });
    }
}
