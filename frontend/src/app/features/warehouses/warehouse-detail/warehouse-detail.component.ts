import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { WarehousesService } from '../services/warehouses.service';
import { Entrepot } from '../../../shared/interfaces/warehouse.interface';
import { Location } from '@angular/common';
import { StockMovementHistoryDialogComponent } from '../../stock-management/dialogs/stock-movement-history-dialog/stock-movement-history-dialog.component';
import { StockTransferDialogComponent } from '../../stock-management/dialogs/stock-transfer-dialog/stock-transfer-dialog.component';
import { ProductService } from '../../stock-management/services/product.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
    selector: 'app-warehouse-detail',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatSnackBarModule,
        FormsModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatSelectModule
    ],
    templateUrl: './warehouse-detail.component.html',
    styleUrls: ['./warehouse-detail.component.scss']
})
export class WarehouseDetailComponent implements OnInit {
    entrepot: any | null = null;
    allProducts: any[] = [];
    filteredProducts: any[] = [];
    filterText: string = '';

    // Filters
    selectedPeriod: string = 'all';
    startDate: Date | null = null;
    endDate: Date | null = null;
    selectedSourceWarehouse: string | null = null;
    sourceWarehouses: string[] = [];

    loading = false;
    displayedColumns: string[] = ['designation', 'codeInterne', 'sourceEntrepot', 'dateOperation', 'quantiteActuelle', 'prixVenteHT', 'actions'];

    constructor(
        private route: ActivatedRoute,
        private warehousesService: WarehousesService,
        private location: Location,
        private router: Router,
        private cdr: ChangeDetectorRef,
        private dialog: MatDialog,
        private productService: ProductService,
        private snackBar: MatSnackBar
    ) { }

    get totalQuantity(): number {
        return this.filteredProducts.reduce((sum, p) => sum + (p.quantiteActuelle || 0), 0);
    }

    get totalValue(): number {
        return this.filteredProducts.reduce((sum, p) => sum + ((p.quantiteActuelle || 0) * (p.prixVenteTTC || 0)), 0);
    }

    ngOnInit(): void {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.loadEntrepot(id);
        }
    }

    loadEntrepot(id: string): void {
        this.loading = true;
        this.warehousesService.findOne(id).subscribe({
            next: (data) => {
                this.entrepot = data;
                this.allProducts = data.produits || [];

                // Extract sources
                const sources = new Set<string>();
                this.allProducts.forEach(p => {
                    const src = this.getProductSource(p);
                    if (src) sources.add(src);
                });
                this.sourceWarehouses = Array.from(sources).sort();

                this.applyFilter();
                this.loading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading warehouse:', err);
                this.loading = false;
                this.cdr.detectChanges();
            }
        });
    }

    getProductSource(p: any): string {
        // 1. Pending Incoming (Transfer not yet received)
        if (p.specificData?.pendingIncoming?.fromWarehouseName) {
            return p.specificData.pendingIncoming.fromWarehouseName;
        }
        // 2. Completed Transfer (History)
        if (p.mouvements && p.mouvements.length > 0 && p.mouvements[0].entrepotSource) {
            return p.mouvements[0].entrepotSource.nom;
        }
        // 3. Fallback
        return p.sourceEntrepotName || '';
    }

    getProductDate(p: any): Date {
        return p.updatedAt ? new Date(p.updatedAt) : (p.createdAt ? new Date(p.createdAt) : new Date());
    }

    onPeriodChange(): void {
        const now = new Date();

        switch (this.selectedPeriod) {
            case 'today':
                this.endDate = now;
                this.startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                this.endDate = now;
                const first = now.getDate() - now.getDay();
                this.startDate = new Date(now.setDate(first));
                break;
            case 'month':
                this.endDate = now;
                this.startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'all':
                this.startDate = null;
                this.endDate = null;
                break;
            case 'custom':
                // User picks dates
                break;
        }
        this.applyFilter();
    }

    applyFilter(): void {
        let filtered = [...this.allProducts];

        // Text Filter
        if (this.filterText) {
            const filterValue = this.filterText.toLowerCase().trim();
            filtered = filtered.filter(p =>
                (p.designation && p.designation.toLowerCase().includes(filterValue)) ||
                (p.codeInterne && p.codeInterne.toLowerCase().includes(filterValue)) ||
                (p.marque && p.marque.toLowerCase().includes(filterValue)) ||
                (p.referenceFournisseur && p.referenceFournisseur.toLowerCase().includes(filterValue))
            );
        }

        // Warehouse Filter
        if (this.selectedSourceWarehouse) {
            filtered = filtered.filter(p => this.getProductSource(p) === this.selectedSourceWarehouse);
        }

        // Date Filter
        if (this.startDate) {
            const start = new Date(this.startDate);
            start.setHours(0, 0, 0, 0);
            filtered = filtered.filter(p => this.getProductDate(p) >= start);
        }
        if (this.endDate) {
            const end = new Date(this.endDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(p => this.getProductDate(p) <= end);
        }

        this.filteredProducts = filtered;

        // Update the view's data
        if (this.entrepot) {
            this.entrepot.produits = this.filteredProducts;
        }
    }

    goBack(): void {
        if (this.entrepot?.centreId) {
            this.router.navigate(['/p/centers', this.entrepot.centreId]);
        } else {
            this.location.back();
        }
    }

    navigateToAddProduct(): void {
        if (this.entrepot && this.entrepot.id) {
            this.router.navigate(['/p/stock/new'], {
                queryParams: { entrepotId: this.entrepot.id }
            });
        }
    }

    openHistory(product: any): void {
        this.dialog.open(StockMovementHistoryDialogComponent, {
            width: 'auto',
            minWidth: '800px',
            maxWidth: '95vw',
            maxHeight: '90vh',
            data: { product },
            autoFocus: false
        });
    }

    // Transfer Actions ...
    initiateTransfer(product: any): void {
        const dialogRef = this.dialog.open(StockTransferDialogComponent, {
            width: '500px',
            data: { product, allProducts: this.allProducts }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && result.targetWarehouseId) {
                const targetProduct = this.allProducts.find(p =>
                    p.entrepotId === result.targetWarehouseId &&
                    p.designation === product.designation &&
                    p.codeInterne === product.codeInterne
                );

                if (!targetProduct) {
                    this.snackBar.open('Le produit correspondant n\'existe pas dans l\'entrepôt de destination. Veuillez d\'abord le créer.', 'Fermer', { duration: 5000 });
                    return;
                }

                this.loading = true;
                this.productService.initiateTransfer(product.id, targetProduct.id).subscribe({
                    next: () => {
                        this.loading = false;
                        this.snackBar.open('Transfert initié !', 'Fermer', { duration: 3000 });
                        if (this.entrepot?.id) this.loadEntrepot(this.entrepot.id);
                    },
                    error: (err) => {
                        console.error('Transfer failed:', err);
                        this.loading = false;
                        this.snackBar.open(err.error?.message || 'Erreur lors de l\'initiation du transfert', 'Fermer', { duration: 3000 });
                        this.cdr.detectChanges();
                    }
                });
            }
        });
    }

    // ... Other actions (ship, cancel, receive) copied from previous version ...
    canShip(product: any): boolean {
        return !!product.specificData?.pendingOutgoing?.some((t: any) => t.status !== 'SHIPPED');
    }

    canCancel(product: any): boolean {
        return !!product.specificData?.pendingIncoming && product.specificData.pendingIncoming.status === 'RESERVED';
    }

    canReceive(product: any): boolean {
        return !!product.specificData?.pendingIncoming && product.specificData.pendingIncoming.status === 'SHIPPED';
    }

    shipTransfer(product: any): void {
        const outgoing = product.specificData?.pendingOutgoing?.find((t: any) => t.status !== 'SHIPPED');
        if (outgoing) {
            if (confirm(`Confirmer l'expédition de 1 unité de ${product.designation} ?`)) {
                this.loading = true;
                this.productService.shipTransfer(outgoing.targetProductId).subscribe({
                    next: () => {
                        this.loading = false;
                        this.snackBar.open('Expédition validée !', 'Fermer', { duration: 3000 });
                        if (this.entrepot?.id) this.loadEntrepot(this.entrepot.id);
                    },
                    error: (err) => {
                        console.error('Shipment failed:', err);
                        this.loading = false;
                        this.cdr.detectChanges();
                    }
                });
            }
        }
    }

    cancelTransfer(product: any): void {
        if (confirm(`Annuler le transfert de ${product.designation} ?`)) {
            this.loading = true;
            this.productService.cancelTransfer(product.id).subscribe({
                next: () => {
                    this.loading = false;
                    this.snackBar.open('Transfert annulé.', 'Fermer', { duration: 3000 });
                    if (this.entrepot?.id) this.loadEntrepot(this.entrepot.id);
                },
                error: (err) => {
                    console.error('Cancel failed:', err);
                    this.loading = false;
                    this.cdr.detectChanges();
                }
            });
        }
    }

    receiveTransfer(product: any): void {
        if (confirm(`Confirmer la réception de ${product.designation} ?`)) {
            this.loading = true;
            this.productService.completeTransfer(product.id).subscribe({
                next: () => {
                    this.loading = false;
                    this.snackBar.open('Produit reçu !', 'Fermer', { duration: 3000 });
                    if (this.entrepot?.id) this.loadEntrepot(this.entrepot.id);
                },
                error: (err) => {
                    console.error('Reception failed:', err);
                    this.loading = false;
                    this.cdr.detectChanges();
                }
            });
        }
    }

    hasPendingTransferToCurrent(product: any): boolean {
        return !!product.specificData?.pendingIncoming || !!product.specificData?.pendingOutgoing?.length;
    }

    validateReception(product: any): void {
        this.receiveTransfer(product);
    }
}
