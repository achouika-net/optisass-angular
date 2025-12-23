import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
import { WarehousesService } from '../services/warehouses.service';
import { Entrepot } from '../../../shared/interfaces/warehouse.interface';
import { Location } from '@angular/common';
import { StockMovementHistoryDialogComponent } from '../../stock-management/components/stock-movement-history-dialog/stock-movement-history-dialog.component';
import { StockTransferDialogComponent } from '../../stock-management/components/stock-transfer-dialog/stock-transfer-dialog.component';
import { ProductService } from '../../stock-management/services/product.service';
import { ProductStatus } from '../../../shared/interfaces/product.interface';
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
        FormsModule
    ],
    templateUrl: './warehouse-detail.component.html',
    styleUrls: ['./warehouse-detail.component.scss']
})
export class WarehouseDetailComponent implements OnInit {
    entrepot: any | null = null; // Using any for now to handle included products
    allProducts: any[] = []; // Store full list for filtering
    filteredProducts: any[] = []; // List to display
    filterText: string = '';

    loading = false;
    displayedColumns: string[] = ['designation', 'codeInterne', 'quantiteActuelle', 'prixVenteHT', 'actions'];

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
                this.applyFilter(); // Initial filter apply (show all)
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

    applyFilter(): void {
        if (!this.filterText) {
            this.filteredProducts = [...this.allProducts];
        } else {
            const filterValue = this.filterText.toLowerCase().trim();
            this.filteredProducts = this.allProducts.filter(p =>
                (p.designation && p.designation.toLowerCase().includes(filterValue)) ||
                (p.codeInterne && p.codeInterne.toLowerCase().includes(filterValue)) ||
                (p.marque && p.marque.toLowerCase().includes(filterValue)) ||
                (p.referenceFournisseur && p.referenceFournisseur.toLowerCase().includes(filterValue))
            );
        }

        // Update the view's data
        if (this.entrepot) {
            this.entrepot.produits = this.filteredProducts;
        }
    }

    goBack(): void {
        // If we have centreId, navigate there, else go back in history
        if (this.entrepot?.centreId) {
            this.router.navigate(['/p/centers', this.entrepot.centreId]);
        } else {
            this.location.back();
        }
    }

    navigateToAddProduct(): void {
        // Navigate to product creation with warehouse context
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

    initiateTransfer(product: any): void {
        const dialogRef = this.dialog.open(StockTransferDialogComponent, {
            width: '500px',
            data: {
                product,
                allProducts: this.allProducts
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && result.targetWarehouseId) {
                // Find the target product in the selected warehouse/center
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
                        this.snackBar.open('Transfert initié ! L\'unité a été retirée de votre stock.', 'Fermer', { duration: 3000 });
                        if (this.entrepot?.id) this.loadEntrepot(this.entrepot.id);
                    },
                    error: (err) => {
                        console.error('Transfer initiation failed:', err);
                        this.loading = false;
                        this.snackBar.open(err.error?.message || 'Erreur lors de l\'initiation du transfert', 'Fermer', { duration: 3000 });
                        this.cdr.detectChanges();
                    }
                });
            }
        });
    }

    validateReception(product: any): void {
        this.receiveTransfer(product);
    }

    // --- New Transfer LifeCycle Actions ---

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
                        this.snackBar.open('Expédition validée ! Le produit est "En Transit" côté destinataire.', 'Fermer', { duration: 3000 });
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
                    this.snackBar.open('Produit reçu et ajouté au stock local !', 'Fermer', { duration: 3000 });
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
}
