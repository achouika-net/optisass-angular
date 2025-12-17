import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Product, ProductFilters, StockStats } from '../../../shared/interfaces/product.interface';

@Injectable({
    providedIn: 'root'
})
export class ProductService {
    private apiUrl = `${environment.apiUrl}/products`;

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
            // Mapping explicit filters to query params supported by backend
            // Note: Backend currently supports 'entrepotId' via @Query.
            // Other filters (search, type, brand) need implementation in backend findAll
            // or we filter client-side for now if backend sends all for an entrepot.
            // For now, let's pass what we can.
            if (filters.entrepotId) {
                params = params.set('entrepotId', filters.entrepotId);
            }
            // For other filters, we might need to implement them in backend or pass them here
            // if strict filtering is needed server-side.
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

    initiateTransfer(id: string, targetWarehouseId: string): Observable<void> {
        return this.http.post<void>(`${this.apiUrl}/${id}/initiate-transfer`, { targetWarehouseId });
    }

    completeTransfer(id: string): Observable<void> {
        return this.http.post<void>(`${this.apiUrl}/${id}/complete-transfer`, {});
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

    getStockStats(): Observable<StockStats> {
        // Placeholder or call a dedicated stats endpoint if created
        // For MVP integration, we might skip this or implement a simple backend endpoint later.
        // Returning 'of' empty stats for safety if called
        return new Observable(observer => {
            observer.next({
                totalProduits: 0,
                valeurStockTotal: 0,
                produitsStockBas: 0,
                produitsRupture: 0,
                byType: { montures: 0, verres: 0, lentilles: 0, accessoires: 0 }
            });
            observer.complete();
        });
    }

    // Search methods would be API calls with query params
    searchByBarcode(barcode: string): Observable<Product> {
        // Ideally backend endpoint
        // For now, findAll and filter? Or add specific endpoint?
        // Let's assume we use findAll(search=...) later
        return new Observable();
    }
}
