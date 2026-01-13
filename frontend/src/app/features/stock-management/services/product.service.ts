import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product, ProductFilters, StockStats } from '../../../shared/interfaces/product.interface';

import { API_URL } from '../../../config/api.config';

@Injectable({
    providedIn: 'root'
})
export class ProductService {
    private apiUrl = `${API_URL}/products`;

    constructor(private http: HttpClient) { }

    /**
     * CRUD Operations
     */

    create(product: Partial<Product>): Observable<Product> {
        return this.http.post<Product>(this.apiUrl, product);
    }

    findAll(filters?: ProductFilters): Observable<Product[]> {
        let params = new HttpParams();

        if (filters) {
            if (filters.entrepotId) {
                params = params.set('entrepotId', filters.entrepotId);
            }
            if (filters.global) {
                params = params.set('global', 'true');
            }
            if (filters.search) {
                params = params.set('search', filters.search);
            }
            if (filters.marque) {
                params = params.set('marque', filters.marque);
            }
            if (filters.typeArticle) {
                params = params.set('typeArticle', filters.typeArticle);
            }
            if (filters.reference) {
                params = params.set('reference', filters.reference);
            }
            if (filters.codeBarres) {
                params = params.set('codeBarres', filters.codeBarres);
            }
        }

        return this.http.get<Product[]>(this.apiUrl, { params });
    }

    findOne(id: string): Observable<Product> {
        return this.http.get<Product>(`${this.apiUrl}/${id}`);
    }

    update(id: string, productData: Partial<Product>): Observable<Product> {
        return this.http.patch<Product>(`${this.apiUrl}/${id}`, productData);
    }

    delete(id: string): Observable<boolean> {
        return this.http.delete<boolean>(`${this.apiUrl}/${id}`);
    }

    initiateTransfer(sourceProductId: string, targetProductId: string, quantite: number = 1): Observable<void> {
        return this.http.post<void>(`${this.apiUrl}/${sourceProductId}/transfer`, { targetProductId, quantite });
    }

    shipTransfer(id: string): Observable<void> {
        return this.http.post<void>(`${this.apiUrl}/${id}/ship`, {});
    }

    cancelTransfer(id: string): Observable<void> {
        return this.http.post<void>(`${this.apiUrl}/${id}/cancel`, {});
    }

    completeTransfer(id: string): Observable<void> {
        return this.http.post<void>(`${this.apiUrl}/${id}/complete-transfer`, {});
    }

    restock(id: string, quantite: number, motif: string, prixAchatHT?: number, remiseFournisseur?: number): Observable<void> {
        return this.http.post<void>(`${this.apiUrl}/${id}/restock`, { quantite, motif, prixAchatHT, remiseFournisseur });
    }

    destock(id: string, quantite: number, motif: string, destinationEntrepotId?: string): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/${id}/destock`, { quantite, motif, destinationEntrepotId });
    }


    getStockMovements(productId: string): Observable<any[]> {
        return this.http.get<any[]>(`${API_URL}/stock-movements/product/${productId}`);
    }

    /**
     * Price Calculations
     */

    calculateSellingPrice(purchasePrice: number, coefficient: number): number {
        return Math.round(purchasePrice * coefficient * 100) / 100;
    }

    calculatePriceTTC(priceHT: number, tvaRate: number = 0.20): number {
        return Math.round(priceHT * (1 + tvaRate) * 100) / 100;
    }

    calculateWeightedAveragePrice(
        currentStock: number,
        currentPrice: number,
        newQuantity: number,
        newPrice: number
    ): number {
        if (currentStock + newQuantity === 0) {
            return 0;
        }
        const totalValue = (currentStock * currentPrice) + (newQuantity * newPrice);
        const totalQuantity = currentStock + newQuantity;
        return Math.round((totalValue / totalQuantity) * 100) / 100;
    }

    /**
     * Statistics (Future Implementation in Backend)
     */

    // These statistics methods previously relied on mock data.
    // For now, they might return simplified/empty data or we can implement specific stats endpoints.
    // Keeping simple placeholder or fetching all products to calc stats client-side is heavy.
    // Better to have stats endpoint. For now, let's keep them as minimal or client-side calc on small datasets.

    getStockStatistics(centreId?: string): Observable<StockStats> {
        let params = new HttpParams();
        if (centreId) params = params.set('centreId', centreId);
        return this.http.get<StockStats>(`${this.apiUrl}/stats`, { params });
    }

    getTransferHistory(params: { startDate?: string; endDate?: string; centreId?: string; productId?: string; type?: string }): Observable<any[]> {
        let httpParams = new HttpParams();
        if (params.startDate) httpParams = httpParams.set('startDate', params.startDate);
        if (params.endDate) httpParams = httpParams.set('endDate', params.endDate);
        if (params.centreId) httpParams = httpParams.set('centreId', params.centreId);
        if (params.productId) httpParams = httpParams.set('productId', params.productId);
        if (params.type) httpParams = httpParams.set('type', params.type);

        return this.http.get<any[]>(`${this.apiUrl}/transfers/history`, { params: httpParams });
    }

    // Search methods would be API calls with query params
    searchByBarcodeOrReference(query: string): Observable<Product[]> {
        let params = new HttpParams().set('search', query);
        return this.http.get<Product[]>(this.apiUrl, { params });
    }

    cleanupOutOfStock(): Observable<{ deletedCount: number, archivedCount: number }> {
        return this.http.delete<{ deletedCount: number, archivedCount: number }>(`${this.apiUrl}/cleanup-rupture`);
    }
}
