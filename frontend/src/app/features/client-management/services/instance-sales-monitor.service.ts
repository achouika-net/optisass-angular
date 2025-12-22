import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval, of, forkJoin } from 'rxjs';
import { startWith, switchMap, tap, map, catchError } from 'rxjs/operators';
import { FactureService } from './facture.service';
import { ProductService } from '../../stock-management/services/product.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';

export interface InstanceSale {
    facture: any;
    status: 'IN_TRANSIT' | 'READY' | 'CANCELLED' | 'UNKNOWN';
    products?: any[];
}

@Injectable({
    providedIn: 'root'
})
export class InstanceSalesMonitorService {
    private instanceSales$ = new BehaviorSubject<InstanceSale[]>([]);
    private readyToValidateCount$ = new BehaviorSubject<number>(0);
    private notifiedSales = new Set<string>();
    private isPolling = false;

    constructor(
        private factureService: FactureService,
        private productService: ProductService,
        private snackBar: MatSnackBar,
        private router: Router
    ) { }

    startPolling(): void {
        if (this.isPolling) return;

        this.isPolling = true;
        console.log('🔄 Starting Instance Sales Monitor polling...');

        // Poll every 2 minutes (120000ms) for better responsiveness
        interval(2 * 60 * 1000).pipe(
            startWith(0), // Immediate first check
            switchMap(() => this.checkInstanceSales())
        ).subscribe();
    }

    stopPolling(): void {
        this.isPolling = false;
        console.log('⏸️ Stopped Instance Sales Monitor polling');
    }

    private checkInstanceSales(): Observable<InstanceSale[]> {
        console.log('🔍 Checking instance sales status...');

        return this.factureService.findAll({ statut: 'VENTE_EN_INSTANCE' }).pipe(
            switchMap(factures => {
                if (factures.length === 0) {
                    return of([]);
                }

                const checks = factures.map(f => this.checkSaleStatus(f));
                return forkJoin(checks);
            }),
            tap(sales => {
                this.instanceSales$.next(sales);
                const readyCount = sales.filter(s => s.status === 'READY').length;
                this.readyToValidateCount$.next(readyCount);

                // Show notifications for newly ready sales
                this.showNotificationIfReady(sales);

                console.log(`✅ Found ${sales.length} instance sales, ${readyCount} ready to validate`);
            }),
            catchError(err => {
                console.error('❌ Error checking instance sales:', err);
                return of([]);
            })
        );
    }

    private checkSaleStatus(facture: any): Observable<InstanceSale> {
        // Extract product IDs from invoice lines
        const lines = (facture.lignes as any[]) || [];
        const productIds = lines
            .filter(l => l.productId)
            .map(l => l.productId);

        if (productIds.length === 0) {
            return of({ facture, status: 'UNKNOWN' });
        }

        const checks = productIds.map(id =>
            this.productService.findOne(id).pipe(
                catchError(() => of(null))
            )
        );

        return forkJoin(checks).pipe(
            map(products => {
                const validProducts = products.filter(p => p !== null);

                if (validProducts.length === 0) {
                    return { facture, status: 'UNKNOWN' };
                }

                // Check if ALL products are available (Status is DISPONIBLE OR Stock > 0)
                const allReceived = validProducts.every(p => p.statut === 'DISPONIBLE' || p.quantiteActuelle > 0);

                // Check if SOME are still in transit (Status is EN_TRANSIT OR metadata says SHIPPED)
                const someInTransit = validProducts.some(p =>
                    p.statut === 'EN_TRANSIT' ||
                    p.specificData?.pendingIncoming?.status === 'SHIPPED'
                );

                const cancelled = validProducts.some(p =>
                    !p.specificData?.pendingIncoming &&
                    p.quantiteActuelle <= 0 &&
                    p.statut !== 'EN_TRANSIT' &&
                    p.statut !== 'DISPONIBLE'
                );

                let status: 'IN_TRANSIT' | 'READY' | 'CANCELLED' | 'UNKNOWN';
                if (cancelled) {
                    status = 'CANCELLED';
                } else if (allReceived) {
                    status = 'READY';
                } else if (someInTransit) {
                    status = 'IN_TRANSIT';
                } else {
                    status = 'UNKNOWN';
                }

                return { facture, status, products: validProducts };
            })
        );
    }

    private showNotificationIfReady(sales: InstanceSale[]): void {
        const newlyReady = sales.filter(s =>
            s.status === 'READY' &&
            !this.notifiedSales.has(s.facture.id)
        );

        if (newlyReady.length > 0) {
            console.log(`🔔 Triggering notifications for ${newlyReady.length} newly ready sales`);
            newlyReady.forEach(sale => {
                console.log(`📡 Sending toast for Facture: ${sale.facture.numero}`);
                const snackBarRef = this.snackBar.open(
                    `✅ Produit reçu ! Vente ${sale.facture.numero} prête à valider.`,
                    'VOIR',
                    { duration: 15000, horizontalPosition: 'end', verticalPosition: 'bottom' }
                );

                snackBarRef.onAction().subscribe(() => {
                    console.log(`🖱️ User clicked VOIR for ${sale.facture.numero}`);
                    this.router.navigate(['/p/reports/sales-control']);
                });

                this.notifiedSales.add(sale.facture.id);
            });
        }
    }

    getInstanceSales(): Observable<InstanceSale[]> {
        return this.instanceSales$.asObservable();
    }

    getReadyToValidateCount(): Observable<number> {
        return this.readyToValidateCount$.asObservable();
    }

    refreshNow(): void {
        console.log('🔄 Manual refresh triggered');
        this.checkInstanceSales().subscribe();
    }

    clearNotification(saleId: string): void {
        this.notifiedSales.delete(saleId);
    }
}
