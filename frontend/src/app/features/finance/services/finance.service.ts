import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Supplier, Expense, SupplierInvoice, ExpenseDTO, SupplierInvoiceDTO } from '../models/finance.models';

@Injectable({
    providedIn: 'root'
})
export class FinanceService {
    private apiUrl = environment.apiUrl;

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
    getInvoices(filters?: { fournisseurId?: string; statut?: string }): Observable<SupplierInvoice[]> {
        let params = new HttpParams();
        if (filters?.fournisseurId) params = params.set('fournisseurId', filters.fournisseurId);
        if (filters?.statut) params = params.set('statut', filters.statut);

        return this.http.get<SupplierInvoice[]>(`${this.apiUrl}/supplier-invoices`, { params });
    }

    createInvoice(invoice: SupplierInvoiceDTO): Observable<SupplierInvoice> {
        return this.http.post<SupplierInvoice>(`${this.apiUrl}/supplier-invoices`, invoice);
    }

    getInvoice(id: string): Observable<SupplierInvoice> {
        return this.http.get<SupplierInvoice>(`${this.apiUrl}/supplier-invoices/${id}`);
    }

    // --- Treasury ---
    getTreasurySummary(year: number, month: number, centreId?: string): Observable<any> {
        let params = new HttpParams().set('year', year.toString()).set('month', month.toString());
        if (centreId) params = params.set('centreId', centreId);
        return this.http.get<any>(`${this.apiUrl}/treasury/summary`, { params });
    }

    getYearlyProjection(year: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/treasury/projection`, { params: { year: year.toString() } });
    }
}
