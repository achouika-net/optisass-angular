import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
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
    breakdown: { type: string; quantity: number; value: number }[];
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
    fichesStats?: {
        total: number;
        monture: number;
        lentilles: number;
        produit: number;
    };
    productsStats?: { [key: string]: number };
    clientStats?: {
        M: number;
        F: number;
        E: number;
    };
}

@Injectable({
    providedIn: 'root'
})
export class StatsService {
    private apiUrl = `${API_URL}/stats`;
    private cache = new Map<string, { data: any, timestamp: number }>();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

    constructor(private http: HttpClient) { }

    private getFromCache<T>(key: string): T | null {
        const item = this.cache.get(key);
        if (item && (Date.now() - item.timestamp < this.CACHE_TTL)) {
            return item.data as T;
        }
        return null;
    }

    private setToCache(key: string, data: any): void {
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    private clearCache(): void {
        this.cache.clear();
    }

    getRevenueEvolution(
        period: 'daily' | 'monthly' | 'yearly' = 'monthly',
        startDate?: string,
        endDate?: string,
        centreId?: string
    ): Observable<RevenueDataPoint[]> {
        const cacheKey = `revenue-${period}-${startDate}-${endDate}-${centreId}`;
        const cached = this.getFromCache<RevenueDataPoint[]>(cacheKey);
        if (cached) return of(cached);

        let params = new HttpParams().set('period', period);
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        if (centreId) params = params.set('centreId', centreId);
        
        return this.http.get<RevenueDataPoint[]>(`${this.apiUrl}/revenue-evolution`, { params }).pipe(
            map(data => {
                this.setToCache(cacheKey, data);
                return data;
            })
        );
    }

    getProductDistribution(startDate?: string, endDate?: string, centreId?: string): Observable<ProductDistribution[]> {
        const cacheKey = `distri-${startDate}-${endDate}-${centreId}`;
        const cached = this.getFromCache<ProductDistribution[]>(cacheKey);
        if (cached) return of(cached);

        let params = new HttpParams();
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        if (centreId) params = params.set('centreId', centreId);

        return this.http.get<ProductDistribution[]>(`${this.apiUrl}/product-distribution`, { params }).pipe(
            map(data => {
                this.setToCache(cacheKey, data);
                return data;
            })
        );
    }

    getConversionRate(startDate?: string, endDate?: string, centreId?: string): Observable<ConversionMetrics> {
        let params = new HttpParams();
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        if (centreId) params = params.set('centreId', centreId);
        return this.http.get<ConversionMetrics>(`${this.apiUrl}/conversion-rate`, { params });
    }

    getStockByWarehouse(startDate?: string, endDate?: string, centreId?: string): Observable<WarehouseStock[]> {
        let params = new HttpParams();
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        if (centreId) params = params.set('centreId', centreId);
        return this.http.get<WarehouseStock[]>(`${this.apiUrl}/stock-by-warehouse`, { params });
    }

    getTopClients(limit: number = 10, startDate?: string, endDate?: string, centreId?: string): Observable<TopClient[]> {
        const cacheKey = `topclients-${limit}-${startDate}-${endDate}-${centreId}`;
        const cached = this.getFromCache<TopClient[]>(cacheKey);
        if (cached) return of(cached);

        let params = new HttpParams().set('limit', limit.toString());
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        if (centreId) params = params.set('centreId', centreId);

        return this.http.get<TopClient[]>(`${this.apiUrl}/top-clients`, { params }).pipe(
            map(data => {
                this.setToCache(cacheKey, data);
                return data;
            })
        );
    }

    getPaymentMethods(startDate?: string, endDate?: string, centreId?: string): Observable<PaymentMethodStat[]> {
        const cacheKey = `payments-${startDate}-${endDate}-${centreId}`;
        const cached = this.getFromCache<PaymentMethodStat[]>(cacheKey);
        if (cached) return of(cached);

        let params = new HttpParams();
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        if (centreId) params = params.set('centreId', centreId);

        return this.http.get<PaymentMethodStat[]>(`${this.apiUrl}/payment-methods`, { params }).pipe(
            map(data => {
                this.setToCache(cacheKey, data);
                return data;
            })
        );
    }

    getSummary(startDate?: string, endDate?: string, centreId?: string): Observable<StatsSummary> {
        const cacheKey = `summary-${startDate}-${endDate}-${centreId}`;
        const cached = this.getFromCache<StatsSummary>(cacheKey);
        if (cached) return of(cached);

        let params = new HttpParams();
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        if (centreId) params = params.set('centreId', centreId);
        
        return this.http.get<StatsSummary>(`${this.apiUrl}/summary`, { params }).pipe(
            map(data => {
                this.setToCache(cacheKey, data);
                return data;
            })
        );
    }

    getRealProfit(startDate?: string, endDate?: string, centreId?: string): Observable<any> {
        let params = new HttpParams();
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        if (centreId) params = params.set('centreId', centreId);
        // Add cache buster
        params = params.set('_t', new Date().getTime().toString());
        return this.http.get<any>(`${this.apiUrl}/profit`, { params });
    }

    getProfitEvolution(
        period: 'daily' | 'monthly' = 'monthly',
        startDate?: string,
        endDate?: string,
        centreId?: string
    ): Observable<any[]> {
        let params = new HttpParams().set('period', period);
        if (startDate) params = params.set('startDate', startDate);
        if (endDate) params = params.set('endDate', endDate);
        if (centreId) params = params.set('centreId', centreId);
        // Add cache buster
        params = params.set('_t', new Date().getTime().toString());
        return this.http.get<any[]>(`${this.apiUrl}/profit-evolution`, { params });
    }
}
