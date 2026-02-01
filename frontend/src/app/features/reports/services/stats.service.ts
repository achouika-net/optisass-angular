import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_URL } from '../../../config/api.config';

export interface RevenueDataPoint {
    period: string;
    revenue: number;
    count: number;
}

export interface ProductDistribution {
    type: string;
    count: number;
    value: number;
}

export interface ConversionMetrics {
    totalDevis: number;
    validatedFactures: number;
    paidFactures: number;
    conversionToFacture: number;
    conversionToPaid: number;
}

export interface WarehouseStock {
    warehouseName: string;
    totalQuantity: number;
    totalValue: number;
    productCount: number;
}

export interface TopClient {
    clientId: string;
    clientName: string;
    totalRevenue: number;
    invoiceCount: number;
}

export interface PaymentMethodStat {
    method: string;
    count: number;
    totalAmount: number;
}

export interface StatsSummary {
    totalProducts: number;
    totalClients: number;
    totalRevenue: number;
    totalExpenses: number;
    activeWarehouses: number;
    conversionRate: number;
}

@Injectable({
    providedIn: 'root'
})
export class StatsService {
    private apiUrl = `${API_URL}/stats`;

    constructor(private http: HttpClient) { }

    getRevenueEvolution(
        period: 'daily' | 'monthly' | 'yearly' = 'monthly',
        startDate?: string,
        endDate?: string
    ): Observable<RevenueDataPoint[]> {
        let params = new HttpParams().set('period', period);
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        return this.http.get<RevenueDataPoint[]>(`${this.apiUrl}/revenue-evolution`, { params });
    }

    getProductDistribution(): Observable<ProductDistribution[]> {
        return this.http.get<ProductDistribution[]>(`${this.apiUrl}/product-distribution`);
    }

    getConversionRate(startDate?: string, endDate?: string): Observable<ConversionMetrics> {
        let params = new HttpParams();
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        return this.http.get<ConversionMetrics>(`${this.apiUrl}/conversion-rate`, { params });
    }

    getStockByWarehouse(): Observable<WarehouseStock[]> {
        return this.http.get<WarehouseStock[]>(`${this.apiUrl}/stock-by-warehouse`);
    }

    getTopClients(limit: number = 10, startDate?: string, endDate?: string): Observable<TopClient[]> {
        let params = new HttpParams().set('limit', limit.toString());
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        return this.http.get<TopClient[]>(`${this.apiUrl}/top-clients`, { params });
    }

    getPaymentMethods(startDate?: string, endDate?: string): Observable<PaymentMethodStat[]> {
        let params = new HttpParams();
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        return this.http.get<PaymentMethodStat[]>(`${this.apiUrl}/payment-methods`, { params });
    }

    getSummary(startDate?: string, endDate?: string): Observable<StatsSummary> {
        let params = new HttpParams();
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        return this.http.get<StatsSummary>(`${this.apiUrl}/summary`, { params });
    }

    getRealProfit(startDate?: string, endDate?: string): Observable<any> {
        let params = new HttpParams();
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        // Add cache buster
        params = params.set('_t', new Date().getTime().toString());
        return this.http.get<any>(`${this.apiUrl}/profit`, { params });
    }

    getProfitEvolution(startDate?: string, endDate?: string): Observable<any[]> {
        let params = new HttpParams();
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        // Add cache buster
        params = params.set('_t', new Date().getTime().toString());
        return this.http.get<any[]>(`${this.apiUrl}/profit-evolution`, { params });
    }
}
