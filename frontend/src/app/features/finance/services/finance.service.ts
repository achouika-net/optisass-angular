import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../../config/api.config';
import { Supplier, Expense, SupplierInvoice, ExpenseDTO, SupplierInvoiceDTO, FundingRequest } from '../models/finance.models';

@Injectable({
    providedIn: 'root'
})
export class FinanceService {
    private apiUrl = API_URL;

    constructor(private http: HttpClient) { }

    // --- Suppliers ---
    getSuppliers(): Observable<Supplier[]> {
        return this.http.get<Supplier[]>(`${this.apiUrl}/suppliers`);
    }

    getSupplier(id: string): Observable<Supplier> {
        return this.http.get<Supplier>(`${this.apiUrl}/suppliers/${id}`);
    }

    createSupplier(supplier: Partial<Supplier>): Observable<Supplier> {
        return this.http.post<Supplier>(`${this.apiUrl}/suppliers`, supplier);
    }

    updateSupplier(id: string, supplier: Partial<Supplier>): Observable<Supplier> {
        return this.http.put<Supplier>(`${this.apiUrl}/suppliers/${id}`, supplier);
    }

    deleteSupplier(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/suppliers/${id}`);
    }

    // --- Expenses ---
    getExpenses(filters?: { centreId?: string; startDate?: string; endDate?: string }): Observable<Expense[]> {
        let params = new HttpParams();
        if (filters?.centreId) params = params.set('centreId', filters.centreId);
        if (filters?.startDate) params = params.set('startDate', filters.startDate);
        if (filters?.endDate) params = params.set('endDate', filters.endDate);

        return this.http.get<Expense[]>(`${this.apiUrl}/expenses`, { params });
    }

    getExpense(id: string): Observable<Expense> {
        return this.http.get<Expense>(`${this.apiUrl}/expenses/${id}`);
    }

    createExpense(expense: ExpenseDTO): Observable<Expense> {
        return this.http.post<Expense>(`${this.apiUrl}/expenses`, expense);
    }

    updateExpense(id: string, expense: Partial<Expense>): Observable<Expense> {
        return this.http.put<Expense>(`${this.apiUrl}/expenses/${id}`, expense);
    }

    deleteExpense(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/expenses/${id}`);
    }

    // --- Supplier Invoices ---
    getSupplierSituation(fournisseurId: string, startDate?: string, endDate?: string): Observable<any> {
        let params = new HttpParams();
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        return this.http.get<any>(`${this.apiUrl}/supplier-invoices/situation/${fournisseurId}`, { params });
    }

    getInvoices(filters?: {
        fournisseurId?: string;
        statut?: string;
        clientId?: string;
        centreId?: string;
        isBL?: boolean;
        categorieBL?: string;
        parentInvoiceId?: string;
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
    }): Observable<{ data: SupplierInvoice[], total: number }> {
        let params = new HttpParams();
        if (filters?.fournisseurId) params = params.set('fournisseurId', filters.fournisseurId);
        if (filters?.statut) params = params.set('statut', filters.statut);
        if (filters?.clientId) params = params.set('clientId', filters.clientId);
        if (filters?.centreId) params = params.set('centreId', filters.centreId);
        if (filters?.isBL !== undefined) params = params.set('isBL', filters.isBL.toString());
        if (filters?.categorieBL) params = params.set('categorieBL', filters.categorieBL);
        if (filters?.parentInvoiceId) params = params.set('parentInvoiceId', filters.parentInvoiceId);
        if (filters?.startDate) params = params.set('startDate', filters.startDate);
        if (filters?.endDate) params = params.set('endDate', filters.endDate);
        if (filters?.page) params = params.set('page', filters.page.toString());
        if (filters?.limit) params = params.set('limit', filters.limit.toString());

        return this.http.get<{ data: SupplierInvoice[], total: number }>(`${this.apiUrl}/supplier-invoices`, { params });
    }

    groupBLsToInvoice(blIds: string[], targetInvoiceData: any): Observable<SupplierInvoice> {
        return this.http.post<SupplierInvoice>(`${this.apiUrl}/supplier-invoices/group`, { blIds, targetInvoiceData });
    }

    createInvoice(invoice: SupplierInvoiceDTO): Observable<SupplierInvoice> {
        return this.http.post<SupplierInvoice>(`${this.apiUrl}/supplier-invoices`, invoice);
    }

    getInvoice(id: string): Observable<SupplierInvoice> {
        return this.http.get<SupplierInvoice>(`${this.apiUrl}/supplier-invoices/${id}`);
    }

    updateInvoice(id: string, invoice: any): Observable<SupplierInvoice> {
        return this.http.put<SupplierInvoice>(`${this.apiUrl}/supplier-invoices/${id}`, invoice);
    }

    deleteInvoice(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/supplier-invoices/${id}`);
    }

    checkInvoiceExistence(fournisseurId: string, numeroFacture: string): Observable<{ exists: boolean, invoice?: any }> {
        let params = new HttpParams()
            .set('fournisseurId', fournisseurId)
            .set('numeroFacture', numeroFacture);
        return this.http.get<{ exists: boolean, invoice?: any }>(`${this.apiUrl}/supplier-invoices/check-existence`, { params });
    }

    // --- Treasury ---
    getTreasurySummary(year?: number, month?: number, centreId?: string, startDate?: string, endDate?: string): Observable<any> {
        let params = new HttpParams();
        if (year) params = params.set('year', year.toString());
        if (month) params = params.set('month', month.toString());
        if (centreId) params = params.set('centreId', centreId);
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        return this.http.get<any>(`${this.apiUrl}/treasury/summary`, { params });
    }

    getYearlyProjection(year: number, centreId?: string): Observable<any[]> {
        let params = new HttpParams().set('year', year.toString());
        if (centreId) params = params.set('centreId', centreId);
        return this.http.get<any[]>(`${this.apiUrl}/treasury/projection`, { params });
    }

    getTreasuryConfig(): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/treasury/config`);
    }

    updateTreasuryConfig(threshold: number): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/treasury/config`, { monthlyThreshold: threshold });
    }

    getConsolidatedOutgoings(filters: any): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/treasury/consolidated-outgoings`, { params: filters });
    }

    getConsolidatedIncomings(filters: any): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/treasury/consolidated-incomings`, { params: filters });
    }

    getUnpaidClientInvoices(filters?: any): Observable<any[]> {
        let params = new HttpParams().set('unpaid', 'true');
        if (filters?.startDate) params = params.set('startDate', filters.startDate); // Use createdAt filters if backend supports?
        // Note: FacturesController.findAll doesn't explicitely handle startDate/endDate yet in my recent edit.
        // It relies on generic filters? No, I only added clientId, type, statut.
        // If I want date filtering, I need to add it to backend too.
        // For now, let's just fetch unpaid to show the list.

        return this.http.get<any[]>(`${this.apiUrl}/factures`, { params });
    }

    validatePayment(id: string, statut: string = 'ENCAISSE'): Observable<any> {
        return this.http.patch(`${this.apiUrl}/paiements/${id}`, { statut });
    }

    validateEcheance(id: string, statut: string = 'ENCAISSE'): Observable<any> {
        return this.http.post(`${this.apiUrl}/treasury/echeances/${id}/validate`, { statut });
    }

    // --- Funding Requests ---
    getFundingRequests(centreId?: string): Observable<FundingRequest[]> {
        let params = new HttpParams();
        if (centreId) params = params.set('centreId', centreId);
        return this.http.get<FundingRequest[]>(`${this.apiUrl}/funding-requests`, { params });
    }

    approveFundingRequest(id: string, validatorId: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/funding-requests/${id}/approve`, { validatorId });
    }

    rejectFundingRequest(id: string, validatorId: string, remarque?: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/funding-requests/${id}/reject`, { validatorId, remarque });
    }

    getFundingRequestsCount(centreId?: string): Observable<number> {
        let params = new HttpParams();
        if (centreId) params = params.set('centreId', centreId);
        return this.http.get<number>(`${this.apiUrl}/funding-requests/count-pending`, { params });
    }

    getPendingTreasuryAlerts(centreId?: string): Observable<any> {
        let params = new HttpParams();
        if (centreId) params = params.set('centreId', centreId);
        return this.http.get<any>(`${this.apiUrl}/treasury/pending-alerts`, { params });
    }
}

