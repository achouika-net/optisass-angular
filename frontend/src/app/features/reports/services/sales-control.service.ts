import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface BrouillonInvoice {
    id: string;
    numero: string;
    dateEmission: Date;
    totalTTC: number;
    resteAPayer: number;
    client: {
        nom?: string;
        prenom?: string;
        raisonSociale?: string;
    };
    paiements?: any[];
}

export interface VendorStatistics {
    vendorId: string;
    vendorName: string;
    countWithPayment: number;
    countWithoutPayment: number;
    totalAmount: number;
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

    getStatistics(): Observable<VendorStatistics[]> {
        return this.http.get<VendorStatistics[]>(`${this.apiUrl}/statistics`);
    }

    validateInvoice(id: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/validate/${id}`, {});
    }

    declareAsGift(id: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/declare-gift/${id}`, {});
    }
}
