import { Component, OnInit, ViewChild, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { WarehousesService } from '../../../warehouses/services/warehouses.service';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { SelectionModel } from '@angular/cdk/collections';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';
import { Product, ProductType, ProductStatus, ProductFilters, StockStats } from '../../../../shared/interfaces/product.interface';
import { ProductService } from '../../services/product.service';
import { effect } from '@angular/core';
import { forkJoin } from 'rxjs';

@Component({
    selector: 'app-product-list',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        FormsModule,
        MatMenuModule,
        MatDividerModule,
        MatDialogModule,
        MatSnackBarModule,
        MatCheckboxModule
    ],
    templateUrl: './product-list.component.html',
    styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit {
    displayedColumns: string[] = ['select', 'codeInterne', 'designation', 'marque', 'typeArticle', 'centre', 'entrepot', 'quantiteActuelle', 'prixVenteTTC', 'statut', 'actions'];
    dataSource: MatTableDataSource<Product> = new MatTableDataSource<Product>([]);
    selection = new SelectionModel<Product>(true, []);
    loading: boolean = false;

    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    filter: ProductFilters = {
        typeArticle: '' as any,
        marque: '',
        statut: '' as any,
        search: ''
    };

    stats: StockStats = {
        totalProduits: 0,
        valeurStockTotal: 0,
        caNonConsolide: 0,
        produitsStockBas: 0,
        produitsRupture: 0,
        produitsReserves: 0,
        produitsEnTransit: 0,
        byType: {
            montures: 0,
            verres: 0,
            lentilles: 0,
            accessoires: 0
        }
    };

    productTypes = Object.values(ProductType);
    productStatuses = Object.values(ProductStatus);
    currentCentre = this.store.selectSignal(UserCurrentCentreSelector);

    constructor(
        private productService: ProductService,
        private warehousesService: WarehousesService,
        private store: Store,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        private zone: NgZone,
        private cdr: ChangeDetectorRef
    ) {
        // Automatically reload when center changes
        effect(() => {
            const center = this.currentCentre();
            if (center) {
                this.loadProducts();
                this.loadStats();
            }
        });
    }

    ngOnInit(): void {
        // Handled by effect on center change
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    loadProducts(): void {
        this.dataSource.data = []; // Reset for stability
        this.productService.findAll(this.filter).subscribe(products => {
            this.zone.run(() => {
                const center = this.currentCentre();
                if (center) {
                    // Strictly filter by current center AND exclude defective warehouses from main view
                    this.dataSource.data = products.filter(p =>
                        p.entrepot?.centreId === center.id &&
                        !p.entrepot?.nom?.toLowerCase().includes('défectueux') &&
                        !p.entrepot?.nom?.toLowerCase().includes('defectueux') &&
                        p.entrepot?.nom?.toUpperCase() !== 'DÉFECTUEUX'
                    );
                } else {
                    this.dataSource.data = products;
                }
                this.cdr.markForCheck();
            });
        });
    }

    loadStats(): void {
        this.productService.getStockStats().subscribe(stats => {
            this.stats = stats;
        });
    }

    /** Multi-selection logic */
    isAllSelected() {
        const numSelected = this.selection.selected.length;
        const numRows = this.dataSource.data.length;
        return numSelected === numRows;
    }

    masterToggle() {
        this.isAllSelected() ?
            this.selection.clear() :
            this.dataSource.data.forEach(row => this.selection.select(row));
    }

    checkboxLabel(row?: Product): string {
        if (!row) {
            return `${this.isAllSelected() ? 'select' : 'deselect'} all`;
        }
        return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row.id}`;
    }

    hasReceivableItems(): boolean {
        return this.selection.selected.some(p => this.canReceive(p));
    }

    applyFilter(): void {
        this.loadProducts();
    }

    getStatusClass(status: string): string {
        if (!status) return '';
        const s = status.toUpperCase();
        switch (s) {
            case 'DISPONIBLE': return 'status-disponible';
            case 'RESERVE': return 'status-reserve';
            case 'EN_TRANSIT': return 'status-transit';
            case 'RUPTURE': return 'status-rupture';
            case 'EN_COMMANDE': return 'status-commande';
            case 'OBSOLETE': return 'status-obsolete';
            default: return '';
        }
    }

    getStockClass(product: Product): string {
        if (product.quantiteActuelle === 0) {
            return 'stock-rupture';
        } else if (product.quantiteActuelle <= product.seuilAlerte) {
            return 'stock-bas';
        }
        return 'stock-ok';
    }

    formatPrice(price: number): string {
        return price.toFixed(2) + ' DH';
    }

    exportXLS(): void {
        // TODO: Implement Excel export
        console.log('Export to Excel');
    }

    printBarcode(product: Product): void {
        // TODO: Implement barcode printing
        console.log('Print barcode for:', product.designation);
    }

    // --- Transfer Actions ---

    canShip(product: any): boolean {
        return !!product.specificData?.pendingOutgoing?.some((t: any) => t.status !== 'SHIPPED');
    }

    canCancel(product: any): boolean {
        // Can cancel if we are the receiver and it's not shipped yet
        return !!product.specificData?.pendingIncoming && product.specificData.pendingIncoming.status === 'RESERVED';
    }

    canReceive(product: any): boolean {
        // FIX: Only show reception button when product has been SHIPPED (not just RESERVED)
        return !!product.specificData?.pendingIncoming && product.specificData.pendingIncoming.status === 'SHIPPED';
    }

    shipTransfer(product: any): void {
        if (confirm(`Confirmer l'expédition de 1 unité de ${product.designation} ?`)) {
            // Find the first non-shipped outgoing transfer
            const outgoing = product.specificData?.pendingOutgoing?.find((t: any) => t.status !== 'SHIPPED');
            if (outgoing) {
                this.productService.shipTransfer(outgoing.targetProductId).subscribe(() => {
                    this.loadProducts();
                });
            }
        }
    }

    cancelTransfer(product: Product): void {
        if (confirm(`Annuler la réservation de ${product.designation} ?`)) {
            this.productService.cancelTransfer(product.id!).subscribe(() => {
                this.loadProducts();
            });
        }
    }

    receiveTransfer(product: Product): void {
        if (confirm(`Confirmer la réception de ${product.designation} dans votre stock ?`)) {
            this.productService.completeTransfer(product.id!).subscribe(() => {
                this.loadProducts();
            });
        }
    }

    openStockEntryDialog(product: Product): void {
        import('../../dialogs/stock-entry-dialog/stock-entry-dialog.component').then(m => {
            const dialogRef = this.dialog.open(m.StockEntryDialogComponent, {
                width: '60vw',
                minWidth: '600px',
                maxWidth: '800px',
                panelClass: 'custom-dialog-container',
                data: { product },
                autoFocus: false
            });

            dialogRef.afterClosed().subscribe(result => {
                if (result) {
                    this.productService.restock(
                        product.id!,
                        result.quantite,
                        result.motif,
                        result.prixAchatHT,
                        result.remiseFournisseur
                    ).subscribe({
                        next: () => {
                            this.snackBar.open('Stock mis à jour avec succès', 'OK', { duration: 3000 });
                            this.loadProducts();
                            this.loadStats();
                        },
                        error: (err) => {
                            console.error('Erreur lors de la mise à jour du stock:', err);
                            const errorMsg = err.error?.message || 'Erreur lors de la mise à jour du stock';
                            this.snackBar.open(errorMsg, 'Fermer', { duration: 5000 });
                        }
                    });
                }
            });
        });
    }

    openStockOutDialog(product: Product): void {
        import('../../dialogs/stock-out-dialog/stock-out-dialog.component').then(m => {
            const dialogRef = this.dialog.open(m.StockOutDialogComponent, {
                width: '60vw',
                minWidth: '600px',
                maxWidth: '800px',
                panelClass: 'custom-dialog-container',
                data: { product },
                autoFocus: false
            });

            dialogRef.afterClosed().subscribe(result => {
                if (result) {
                    this.productService.destock(
                        product.id!,
                        result.quantite,
                        result.motif,
                        result.destinationEntrepotId
                    ).subscribe({
                        next: () => {
                            this.snackBar.open('Sortie de stock enregistrée avec succès', 'OK', { duration: 3000 });
                            this.loadProducts();
                            this.loadStats();
                        },
                        error: (err) => {
                            console.error('Erreur lors de la sortie de stock:', err);
                            const errorMsg = err.error?.message || 'Erreur lors de la sortie de stock';
                            this.snackBar.open(errorMsg, 'Fermer', { duration: 5000 });
                        }
                    });
                }
            });
        });
    }

    openHistoryDialog(product: Product): void {
        import('../../dialogs/stock-movement-history-dialog/stock-movement-history-dialog.component').then(m => {
            this.dialog.open(m.StockMovementHistoryDialogComponent, {
                width: '1400px',
                maxWidth: '98vw',
                minHeight: '500px',
                maxHeight: '95vh',
                panelClass: 'no-scroll-dialog', // Adding custom class to force override
                data: { product },
                autoFocus: false
            });
        });
    }

    openStockTransferDialog(product: Product): void {
        import('../../dialogs/stock-transfer-dialog/stock-transfer-dialog.component').then(m => {
            // Need local warehouses for transfer
            this.warehousesService.findAll(this.currentCentre()?.id!).subscribe((warehouses: any[]) => {
                const dialogRef = this.dialog.open(m.StockTransferDialogComponent, {
                    width: '60vw',
                    minWidth: '600px',
                    maxWidth: '800px',
                    data: {
                        product,
                        allProducts: this.dataSource.data,
                        localWarehouses: warehouses
                    }
                });

                dialogRef.afterClosed().subscribe(result => {
                    if (result && result.productId) {
                        this.productService.initiateTransfer(result.productId, product.id!, result.quantite).subscribe({
                            next: () => {
                                this.snackBar.open('Transfert initié avec succès', 'OK', { duration: 3000 });
                                this.loadProducts();
                            },
                            error: (err) => {
                                console.error('Erreur initiation transfert:', err);
                                this.snackBar.open('Erreur lors de l\'initiation du transfert', 'Fermer', { duration: 5000 });
                            }
                        });
                    }
                });
            });
        });
    }

    openBulkStockOutDialog(): void {
        const selected = this.selection.selected;
        if (selected.length === 0) return;

        import('../../dialogs/bulk-stock-out-dialog/bulk-stock-out-dialog.component').then(m => {
            const dialogRef = this.dialog.open(m.BulkStockOutDialogComponent, {
                width: '90vw',
                maxWidth: '1100px',
                data: { products: selected }
            });

            dialogRef.afterClosed().subscribe(result => {
                if (result) {
                    this.selection.clear();
                    this.loadProducts();
                    this.loadStats();
                }
            });
        });
    }

    openBulkStockTransferDialog(): void {
        const selected = this.selection.selected;
        if (selected.length === 0) return;

        import('../../dialogs/bulk-stock-transfer-dialog/bulk-stock-transfer-dialog.component').then(m => {
            const dialogRef = this.dialog.open(m.BulkStockTransferDialogComponent, {
                width: '90vw',
                maxWidth: '1100px',
                data: { products: selected }
            });

            dialogRef.afterClosed().subscribe(result => {
                if (result) {
                    this.selection.clear();
                    this.loadProducts();
                    this.loadStats();
                }
            });
        });
    }

    openBulkReceptionDialog(): void {
        const selected = this.selection.selected.filter(p => this.canReceive(p));
        if (selected.length === 0) {
            this.snackBar.open('Aucun produit à réceptionner parmi la sélection', 'OK', { duration: 3000 });
            return;
        }

        if (confirm(`Confirmer la réception de ${selected.length} produit(s) ?`)) {
            const requests = selected.map(p => this.productService.completeTransfer(p.id!));
            forkJoin(requests).subscribe({
                next: () => {
                    this.snackBar.open(`${selected.length} produit(s) réceptionné(s) avec succès`, 'OK', { duration: 3000 });
                    this.selection.clear();
                    this.loadProducts();
                },
                error: (err) => {
                    console.error('Erreur réception groupée:', err);
                    this.snackBar.open('Erreur lors de la réception groupée', 'Fermer', { duration: 5000 });
                }
            });
        }
    }

    deleteProduct(product: Product): void {
        const confirmMsg = `Êtes-vous sûr de vouloir supprimer définitivement le produit "${product.designation}" ?\n` +
            `Cette action échouera s'il y a des mouvements de stock ou des factures liées.`;

        if (confirm(confirmMsg)) {
            this.productService.delete(product.id!).subscribe({
                next: () => {
                    this.snackBar.open('Produit supprimé avec succès', 'OK', { duration: 3000 });
                    this.loadProducts();
                    this.loadStats();
                },
                error: (err) => {
                    console.error('Erreur suppression produit:', err);
                    const msg = err.error?.message || 'Erreur lors de la suppression du produit. Vérifiez les liaisons.';
                    this.snackBar.open(msg, 'Fermer', { duration: 6000 });
                }
            });
        }
    }
}
