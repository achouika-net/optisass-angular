import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, interval, of, forkJoin } from 'rxjs';
import { startWith, switchMap, tap, map, catchError, take } from 'rxjs/operators';
import { FactureService } from './facture.service';
import { ProductService } from '../../stock-management/services/product.service';
import { FinanceService } from '../../finance/services/finance.service';
import { MatSnackBar } from '@angular/material/snack-bar';

import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../core/store/auth/auth.selectors';

export interface InstanceSale {
    facture: any;
    status: 'IN_TRANSIT' | 'READY' | 'CANCELLED' | 'UNKNOWN';
    products?: any[];
    wasTransferred?: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class InstanceSalesMonitorService {
    private instanceSales$ = new BehaviorSubject<InstanceSale[]>([]);
    private readyToValidateCount$ = new BehaviorSubject<number>(0);
    private pendingShipmentCount$ = new BehaviorSubject<number>(0);
    private waitingReceptionCount$ = new BehaviorSubject<number>(0);
    private fundingRequestCount$ = new BehaviorSubject<number>(0);
    private portfolioCount$ = new BehaviorSubject<number>(0);


    private notifiedSales = new Set<string>();
    private notifiedShipments = new Set<string>();
    private isPolling = false;

    constructor(
        private factureService: FactureService,
        private productService: ProductService,
        private financeService: FinanceService,
        private snackBar: MatSnackBar,
        private router: Router,
        private store: Store,
        private ngZone: NgZone
    ) { }


    startPolling(): void {
        if (this.isPolling) return;

        this.isPolling = true;
        console.log('🔄 Starting Transfer & Instance Monitor polling...');

        this.ngZone.runOutsideAngular(() => {
            // Poll every 60 seconds (1 minute) for background monitoring
            interval(60 * 1000).pipe(
                startWith(0),
                switchMap(() => {
                    // Fetch all products once per cycle to avoid N*M requests inside checkInstanceSales
                    return this.productService.findAll({ global: true }).pipe(
                        switchMap(allProducts => forkJoin({
                            sales: this.checkInstanceSales(allProducts),
                            transfers: this.checkPendingTransfers(allProducts),
                            finance: this.checkFinanceAlerts()
                        })),
                        catchError(err => {
                            console.error('❌ Monitor Cycle Error:', err);
                            return of(null);
                        })
                    );
                })
            ).subscribe({
                next: (data) => {
                    if (data) {
                        console.log('✅ Monitor Cycle Complete');
                    }
                }
            });
        });
    }

    stopPolling(): void {
        this.isPolling = false;
        console.log('⏸️ Stopped Monitor polling');
    }

    private checkPendingTransfers(products: any[]): Observable<any> {
        return this.store.select(UserCurrentCentreSelector).pipe(
            take(1),
            map((center: any) => {
                if (!center) return { shipments: [], receptions: [] };

                // 1. Pending SHIPMENTS (Outgoing from THIS center)
                const shipments = products.filter(p =>
                    p.entrepot?.centreId === center.id &&
                    p.specificData?.pendingOutgoing?.some((t: any) => t.status !== 'SHIPPED')
                );

                // Run count updates back inside Angular zone for proper UI updates
                this.ngZone.run(() => {
                    this.pendingShipmentCount$.next(shipments.length);
                    this.showShipmentNotifications(shipments);
                });

                // 2. Waiting RECEPTIONS (Incoming to THIS center)
                const receptions = products.filter(p =>
                    p.entrepot?.centreId === center.id &&
                    p.specificData?.pendingIncoming &&
                    p.specificData.pendingIncoming.status === 'SHIPPED'
                );

                this.ngZone.run(() => {
                    this.waitingReceptionCount$.next(receptions.length);
                });

                return { shipments, receptions };
            }),
            catchError(err => {
                console.error('❌ Error checking transfers:', err);
                return of({ shipments: [], receptions: [] });
            })
        );
    }

    private checkFinanceAlerts(): Observable<any> {
        return this.store.select(UserCurrentCentreSelector).pipe(
            take(1),
            switchMap((center: any) => {
                const centreId = center?.id;
                return forkJoin({
                    funding: this.financeService.getFundingRequestsCount(centreId),
                    portfolio: this.financeService.getPendingTreasuryAlerts(centreId)
                }).pipe(
                    tap(({ funding, portfolio }) => {
                        this.ngZone.run(() => {
                            this.fundingRequestCount$.next(funding);
                            const portCount = (portfolio.client?.length || 0) + (portfolio.supplier?.length || 0);
                            this.portfolioCount$.next(portCount);
                        });
                    }),
                    catchError(err => {
                        console.error('❌ Error checking finance alerts:', err);
                        return of({ funding: 0, portfolio: { client: [], supplier: [] } });
                    })
                );
            })
        );
    }


    private showShipmentNotifications(shipments: any[]): void {
        shipments.forEach(p => {
            const transferId = `${p.id}_ship`;
            if (!this.notifiedShipments.has(transferId)) {
                this.ngZone.run(() => {
                    const snackBarRef = this.snackBar.open(
                        `📦 Nouveau transfert demandé pour ${p.designation}`,
                        'EXPÉDIER',
                        { duration: 15000, panelClass: 'shipping-snack' }
                    );
                    snackBarRef.onAction().subscribe(() => {
                        this.router.navigate(['/p/stock/transfers']);
                    });
                });
                this.notifiedShipments.add(transferId);
            }
        });
    }

    private checkInstanceSales(allProducts: any[]): Observable<InstanceSale[]> {
        return this.factureService.findAll({ type: 'BON_COMM' }).pipe(
            switchMap(factures => {
                const activeFactures = factures.filter(f => f.statut !== 'ANNULEE');
                if (activeFactures.length === 0) return of([]);
                const checks = activeFactures.map(f => this.checkSaleStatus(f, allProducts));
                return forkJoin(checks);
            }),
            tap(sales => {
                this.ngZone.run(() => {
                    this.instanceSales$.next(sales);
                    const readyCount = sales.filter(s => s.status === 'READY').length;
                    this.readyToValidateCount$.next(readyCount);
                    this.showNotificationIfReady(sales);
                });
            }),
            catchError(err => {
                console.error('❌ Error checking instance sales:', err);
                return of([]);
            })
        );
    }

    private checkSaleStatus(facture: any, allProducts: any[]): Observable<InstanceSale> {
        const lines = (facture.lignes as any[]) || [];
        const items = lines.filter(l => l.productId || l.description);

        if (items.length === 0) return of(({ facture, status: 'UNKNOWN' }) as InstanceSale);

        return this.store.select(UserCurrentCentreSelector).pipe(
            take(1),
            map(center => {
                const products = items.map(item => {
                    let product = null;
                    if (item.productId) {
                        product = allProducts.find(p => p.id === item.productId);
                    }

                    if (!product || product.entrepot?.centreId !== center.id) {
                        const match = allProducts.find(p =>
                            p.entrepot?.centreId === center.id &&
                            (p.designation === item.description || p.codeInterne === item.reference || p.codeBarres === item.reference)
                        );
                        return match || product;
                    }
                    return product;
                });

                const validProducts = products.filter(p => p !== null);
                if (validProducts.length === 0) return ({ facture, status: 'UNKNOWN' }) as InstanceSale;

                const allReceived = validProducts.every(p =>
                    (p.entrepot?.centreId === center.id && (p.quantiteActuelle > 0 || p.statut === 'DISPONIBLE'))
                );

                const wasTransferred = validProducts.some(p => p.specificData?.lastTransferReception);

                const someInTransit = validProducts.some(p =>
                    p.statut === 'EN_TRANSIT' ||
                    p.specificData?.pendingIncoming?.status === 'SHIPPED' ||
                    (p.entrepot?.centreId !== center.id && p.statut === 'RESERVE')
                );

                const cancelled = validProducts.some(p =>
                    p.entrepot?.centreId !== center.id &&
                    !p.specificData?.pendingOutgoing &&
                    p.quantiteActuelle > 0
                );

                let status: 'IN_TRANSIT' | 'READY' | 'CANCELLED' | 'UNKNOWN';
                if (allReceived) status = 'READY';
                else if (someInTransit) status = 'IN_TRANSIT';
                else if (cancelled) status = 'CANCELLED';
                else status = 'UNKNOWN';

                return ({ facture, status, products: validProducts, wasTransferred }) as InstanceSale;
            })
        ) as Observable<InstanceSale>;
    }

    private showNotificationIfReady(sales: InstanceSale[]): void {
        const newlyReady = sales.filter(s => s.status === 'READY' && s.wasTransferred && !this.notifiedSales.has(s.facture.id));
        newlyReady.forEach(sale => {
            const snackBarRef = this.snackBar.open(
                `✅ Produit reçu ! Vente ${sale.facture.numero} prête à valider.`,
                'VOIR',
                { duration: 15000 }
            );
            snackBarRef.onAction().subscribe(() => this.router.navigate(['/p/finance/sales-control']));
            this.notifiedSales.add(sale.facture.id);
        });
    }

    getInstanceSales(): Observable<InstanceSale[]> { return this.instanceSales$.asObservable(); }
    getReadyToValidateCount(): Observable<number> { return this.readyToValidateCount$.asObservable(); }
    getPendingShipmentCount(): Observable<number> { return this.pendingShipmentCount$.asObservable(); }
    getWaitingReceptionCount(): Observable<number> { return this.waitingReceptionCount$.asObservable(); }

    refreshNow(): void {
        this.productService.findAll({ global: true }).pipe(
            switchMap(allProducts => forkJoin({
                sales: this.checkInstanceSales(allProducts),
                transfers: this.checkPendingTransfers(allProducts),
                finance: this.checkFinanceAlerts()
            }))
        ).subscribe();
    }

    getFundingRequestCount(): Observable<number> { return this.fundingRequestCount$.asObservable(); }
    getPortfolioCount(): Observable<number> { return this.portfolioCount$.asObservable(); }


    clearNotification(saleId: string): void { this.notifiedSales.delete(saleId); }
}
