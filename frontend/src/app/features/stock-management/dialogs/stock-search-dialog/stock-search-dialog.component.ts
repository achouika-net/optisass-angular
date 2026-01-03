import { Component, OnInit, ChangeDetectorRef, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { MatMenuModule } from '@angular/material/menu';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';
import { ProductService } from '../../services/product.service';
import { WarehousesService } from '../../../warehouses/services/warehouses.service';
import { StockTransferDialogComponent } from '../stock-transfer-dialog/stock-transfer-dialog.component';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { SelectionModel } from '@angular/cdk/collections';

@Component({
    selector: 'app-stock-search-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        MatSelectModule,
        MatSnackBarModule,
        MatMenuModule,
        MatCheckboxModule,
        FormsModule
    ],
    templateUrl: './stock-search-dialog.component.html',
    styleUrls: ['./stock-search-dialog.component.scss']
})
export class StockSearchDialogComponent implements OnInit {
    searchQuery: string = '';
    allProducts: any[] = [];
    filteredProducts: any[] = [];
    selection = new SelectionModel<any>(true, []);
    loading = false;
    displayedColumns: string[] = ['select', 'photo', 'designation', 'reference', 'marque', 'location', 'quantity', 'statut', 'actions'];

    warehouses: any[] = [];
    selectedWarehouseId: string | undefined;
    currentCenter: any;
    context: 'stock-management' | 'sales' = 'stock-management';

    constructor(
        public dialogRef: MatDialogRef<StockSearchDialogComponent>,
        private productService: ProductService,
        private warehousesService: WarehousesService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef,
        private store: Store,
        @Inject(MAT_DIALOG_DATA) public data?: { context?: 'stock-management' | 'sales' }
    ) {
        this.currentCenter = this.store.selectSignal(UserCurrentCentreSelector)();
        this.context = data?.context || 'stock-management';
    }

    ngOnInit(): void {
        // Remove select column in sales context
        if (this.context === 'sales') {
            this.displayedColumns = this.displayedColumns.filter(col => col !== 'select');
        }
        this.loadWarehouses();
        this.loadProducts();
    }

    loadWarehouses(): void {
        this.warehousesService.findAll().subscribe({
            next: (data) => {
                // FILTER: Hide defective warehouses from dropdown
                this.warehouses = data.filter(w =>
                    !w.nom?.toLowerCase().includes('défectueux') &&
                    !w.nom?.toLowerCase().includes('defectueux') &&
                    w.nom?.toUpperCase() !== 'DÉFECTUEUX'
                );
                this.cdr.detectChanges();
            },
            error: (err) => console.error('Error loading warehouses', err)
        });
    }

    loadProducts(): void {
        this.loading = true;
        // Always load ALL products (GLOBAL) to enable cross-warehouse search
        this.productService.findAll({ global: true }).subscribe({
            next: (products) => {
                // FILTER: Hide products from defective warehouses
                this.allProducts = products.filter(p =>
                    !p.entrepot?.nom?.toLowerCase().includes('défectueux') &&
                    !p.entrepot?.nom?.toLowerCase().includes('defectueux') &&
                    p.entrepot?.nom?.toUpperCase() !== 'DÉFECTUEUX'
                );
                this.filterProducts();
                this.loading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading products:', err);
                this.loading = false;
                this.cdr.detectChanges();
            }
        });
    }

    onWarehouseChange(): void {
        this.filterProducts();
    }

    filterProducts(): void {
        let results = [...this.allProducts];

        // 1. Text Search
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase().trim();
            results = results.filter(p =>
                (p.designation?.toLowerCase().includes(query)) ||
                (p.codeInterne?.toLowerCase().includes(query)) ||
                (p.codeBarres?.toLowerCase().includes(query)) ||
                (p.marque?.toLowerCase().includes(query)) ||
                (p.referenceFournisseur?.toLowerCase().includes(query))
            );
        }

        // 2. Center/Warehouse Filter with Fallback
        if (this.selectedWarehouseId) {
            // Explicit warehouse selection
            this.filteredProducts = results.filter(p => p.entrepotId === this.selectedWarehouseId);
        } else {
            // DEFAULT: Show only from current center
            const localResults = results.filter(p => p.entrepot?.centreId === this.currentCenter?.id);

            // Check if ANY local product has a pending arrival. 
            // If so, we want to hide corresponding remote rows for that product to avoid duplicates as showing in CASA line.
            const localArrivals = localResults.filter(p => !!p.specificData?.pendingIncoming);
            const arrivalDesignations = new Set(localArrivals.map(p => p.designation));

            const hasLocalStock = localResults.some(p => p.quantiteActuelle > 0 || !!p.specificData?.pendingIncoming);

            if (hasLocalStock) {
                this.filteredProducts = localResults;
            } else if (results.length > 0) {
                // FALLBACK: Global view if local is empty/rupture
                // BUT hide remote rows whose product is already arriving locally
                this.filteredProducts = results.filter(p => {
                    const fromOurCenter = p.entrepot?.centreId === this.currentCenter?.id;
                    if (fromOurCenter) return true;
                    // If remote, only show if NOT already arriving locally
                    return !arrivalDesignations.has(p.designation);
                });
            } else {
                this.filteredProducts = [];
            }
        }
    }

    /** Multi-selection logic */
    isAllSelected() {
        const numSelected = this.selection.selected.length;
        const numRows = this.filteredProducts.length;
        return numSelected === numRows;
    }

    masterToggle() {
        this.isAllSelected() ?
            this.selection.clear() :
            this.filteredProducts.forEach(row => this.selection.select(row));
    }

    checkboxLabel(row?: any): string {
        if (!row) {
            return `${this.isAllSelected() ? 'select' : 'deselect'} all`;
        }
        return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row.id}`;
    }

    isRemote(product: any): boolean {
        return this.currentCenter && product.entrepot?.centreId !== this.currentCenter.id;
    }

    getSenderCenterName(): string {
        if (this.selectedWarehouseId) {
            const wh = this.warehouses.find(w => w.id === this.selectedWarehouseId);
            if (wh && wh.centreId !== this.currentCenter?.id) {
                return wh.centre?.nom || 'Inconnu';
            }
        }
        return '';
    }

    /**
     * Helper to show validation button directly on the remote row
     * if a transfer has already been initiated to our center.
     */
    hasActiveTransferToUs(remoteProduct: any): boolean {
        if (!this.isRemote(remoteProduct)) return false;
        const localProduct = this.findLocalCounterpart(remoteProduct);
        return !!localProduct?.specificData?.pendingIncoming;
    }

    selectProduct(product: any): void {
        const localProduct = this.findLocalCounterpart(product) || product;
        this.dialogRef.close({ action: 'SELECT', product: localProduct });
    }

    selectIncomingProduct(product: any): void {
        const localProduct = this.findLocalCounterpart(product) || product;
        this.dialogRef.close({
            action: 'SELECT',
            product: localProduct,
            isPendingTransfer: true
        });
    }

    orderAndSell(product: any): void {
        const isLocal = product.entrepot?.centreId === this.currentCenter?.id;

        // Find best target warehouse for this center
        // 1. If local product, use its current warehouse
        // 2. Otherwise, try to match the type of the source product
        // 3. Fallback to PRINCIPAL
        const targetWarehouse = (isLocal ? this.warehouses.find(w => w.id === product.entrepotId) : null)
            || this.warehouses.find(w => w.centreId === this.currentCenter?.id && w.type === product.entrepot?.type)
            || this.warehouses.find(w => w.centreId === this.currentCenter?.id && w.type === 'PRINCIPAL')
            || this.warehouses.find(w => w.centreId === this.currentCenter?.id);

        const hasStock = (product.quantiteActuelle || 0) > 0;
        const isProductRemote = this.isRemote(product);

        // Only initiate transfer if the product is truly in a different CENTER.
        // If it's in our center but a different warehouse, we just select it.
        const needsTransfer = hasStock && isProductRemote;

        if (needsTransfer) {
            // Product has stock and needs transfer
            this.initiateTransferForStockedProduct(product, targetWarehouse);
        } else if (!hasStock) {
            // No local stock - search for remote stock
            console.log('📦 [ORDER&SELL] No local stock. Searching in other centers...');

            const remoteProduct = this.allProducts.find(p =>
                p.codeInterne === product.codeInterne &&
                p.entrepot?.centreId !== this.currentCenter?.id &&
                (p.quantiteActuelle || 0) > 0
            );

            if (remoteProduct) {
                console.log(`📦 [ORDER&SELL] Found stock at ${remoteProduct.entrepot?.centre?.nom}. Initiating transfer.`);
                // If the original 'product' was local but ruptured, we want the transfer to go to THEIR warehouse.
                const targetWhId = isLocal ? product.entrepotId : targetWarehouse?.id;
                this.initiateAutoTransfer(remoteProduct, targetWhId);
            } else {
                console.log('📦 [ORDER&SELL] No stock anywhere. Prompting user to cancel or choose another product.');
                this.handleNoStockAnywhere(product);
            }
        } else {
            // Local stock available -> just select
            console.log('📦 [ORDER&SELL] Stock is local and available. Just selecting.');
            const localProduct = this.findLocalCounterpart(product) || product;
            this.dialogRef.close({ action: 'SELECT', product: localProduct });
        }
    }

    private initiateTransferForStockedProduct(product: any, targetWarehouse: any): void {
        if (!targetWarehouse) {
            alert("Impossible d'initier le transfert : aucun entrepôt de destination trouvé pour votre centre.");
            return;
        }

        this.loading = true;
        console.log(`📦 [ORDER&SELL-DEBUG] Initiating auto-transfer (Stock: ${product.quantiteActuelle})`);
        console.log(`   👉 Product: ${product.id} (${product.designation})`);
        console.log(`   👉 Target Warehouse: ${targetWarehouse.id} (${targetWarehouse.nom})`);
        console.log(`   👉 Source Center: ${product.entrepot?.centreId} | Current Center: ${this.currentCenter?.id}`);

        this.productService.destock(product.id, 1, 'Transfert Auto (Commande & Vente)', targetWarehouse.id).subscribe({
            next: (response: any) => {
                this.loading = false;
                console.log('✅ [ORDER&SELL-DEBUG] Destock response:', response);

                const targetProduct = response.target;
                const finalProduct = targetProduct || this.findLocalCounterpart(product) || product;

                this.dialogRef.close({
                    action: 'SELECT',
                    product: finalProduct,
                    isPendingTransfer: true
                });
            },
            error: (err) => {
                this.loading = false;
                console.error('Auto transfer failed:', err);
                const msg = err.error?.message || err.message || 'Erreur inconnue';
                alert(`Erreur transfert auto: ${msg}`);
            }
        });
    }

    private initiateAutoTransfer(remoteProduct: any, targetWarehouseId?: string): void {
        const targetWarehouse = (targetWarehouseId ? this.warehouses.find(w => w.id === targetWarehouseId) : null)
            || this.warehouses.find(w => w.centreId === this.currentCenter?.id && w.type === remoteProduct.entrepot?.type)
            || this.warehouses.find(w => w.centreId === this.currentCenter?.id && w.type === 'PRINCIPAL')
            || this.warehouses.find(w => w.centreId === this.currentCenter?.id);

        if (!targetWarehouse) {
            this.snackBar.open('Impossible de trouver un entrepôt de destination.', 'OK', { duration: 4000 });
            return;
        }

        this.loading = true;
        console.log(`🚚 [AUTO-TRANSFER] Initiating transfer from ${remoteProduct.entrepot?.centre?.nom} to ${this.currentCenter?.nom}`);

        this.productService.destock(
            remoteProduct.id,
            1,
            'Transfert Auto (Commande & Vente)',
            targetWarehouse.id
        ).subscribe({
            next: (response: any) => {
                this.loading = false;
                const targetProduct = response.target;

                this.snackBar.open(
                    `Transfert initié depuis ${remoteProduct.entrepot?.centre?.nom}. La vente sera validée à réception.`,
                    'OK',
                    { duration: 6000 }
                );

                this.dialogRef.close({
                    action: 'SELECT',
                    product: targetProduct,
                    isPendingTransfer: true
                });
            },
            error: (err) => {
                this.loading = false;
                this.snackBar.open(
                    `Erreur lors du transfert: ${err.error?.message || err.message}`,
                    'OK',
                    { duration: 5000 }
                );
            }
        });
    }

    private handleNoStockAnywhere(product: any): void {
        const confirmed = confirm(
            `Le produit "${product.designation}" n'est disponible dans aucun centre.\n\n` +
            `Voulez-vous choisir un autre produit ?\n\n` +
            `Cliquez sur "OK" pour choisir un autre produit, ou "Annuler" pour annuler la vente.`
        );

        if (confirmed) {
            // User wants to choose another product - keep dialog open
            this.snackBar.open('Veuillez sélectionner un autre produit.', 'OK', { duration: 4000 });
        } else {
            // User wants to cancel - close dialog and notify parent
            this.dialogRef.close({
                action: 'CANCEL_SALE',
                reason: 'NO_STOCK_AVAILABLE',
                product: product
            });
        }
    }

    public findLocalCounterpart(remoteProduct: any): any {
        return this.allProducts.find(p =>
            p.entrepot?.centreId === this.currentCenter?.id &&
            p.designation === remoteProduct.designation &&
            (p.marque === remoteProduct.marque || !p.marque || !remoteProduct.marque)
        );
    }

    requestTransfer(product: any): void {
        const localProduct = this.findLocalCounterpart(product);

        // We no longer block if localProduct is null, because the system will create it.
        // But we might want to inform the user.

        const localWarehouses = this.warehouses.filter(w => w.centreId === this.currentCenter?.id);
        const dialogRef = this.dialog.open(StockTransferDialogComponent, {
            width: '60vw',
            minWidth: '600px',
            maxWidth: '800px',
            data: {
                product,
                allProducts: this.allProducts,
                localWarehouses: localWarehouses
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && result.productId) {
                console.log('📦 [SEARCH-DEBUG] Transfer Dialog Result:', result);
                this.loading = true;
                // result.productId is the SOURCE product ID (selected in dialog if multiple warehouses exist)
                // Use destock with destination warehouse to trigger "find or create" logic in backend
                const qtyVal = result.quantite || 1;
                this.productService.destock(result.productId, qtyVal, 'Transfert manuel (Initialisé)', result.targetWarehouseId).subscribe({
                    next: (response: any) => {
                        this.loading = false;
                        const targetProduct = response.target || localProduct;

                        this.snackBar.open('Réservation de transfert effectuée et produit sélectionné !', 'OK', { duration: 3000 });

                        // FLUIDITY: Auto-select newly created or existing local product
                        this.dialogRef.close({
                            action: 'SELECT',
                            product: targetProduct,
                            isPendingTransfer: true
                        });
                    },
                    error: (err: any) => {
                        console.error('Transfer initiation failed:', err);
                        this.loading = false;
                        alert(err.error?.message || 'Erreur lors de l\'initiation du transfert');
                    }
                });
            }
        });
    }

    requestBulkTransfer(): void {
        const selected = this.selection.selected;
        if (selected.length === 0) return;

        // Verify if all selected items are remote
        const hasLocal = selected.some(p => !this.isRemote(p));
        if (hasLocal) {
            if (!confirm('Certains produits sélectionnés sont déjà dans votre centre. Voulez-vous continuer le transfert groupé pour les produits distants uniquement ?')) {
                return;
            }
        }

        const remoteProducts = selected.filter(p => this.isRemote(p));
        if (remoteProducts.length === 0) {
            this.snackBar.open('Aucun produit distant à transférer', 'Fermer', { duration: 3000 });
            return;
        }

        // We no longer block for missing local counterparts as the backend will create them if needed.

        import('../bulk-stock-transfer-dialog/bulk-stock-transfer-dialog.component').then(m => {
            const dialogRef = this.dialog.open(m.BulkStockTransferDialogComponent, {
                width: '90vw',
                maxWidth: '1100px',
                data: { products: remoteProducts }
            });

            dialogRef.afterClosed().subscribe(result => {
                if (result) {
                    this.selection.clear();
                    this.loadProducts(); // Reload to see updated status
                }
            });
        });
    }

}
