import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { StockTransferDialogComponent } from '../stock-transfer-dialog/stock-transfer-dialog.component';

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
        FormsModule
    ],
    templateUrl: './stock-search-dialog.component.html',
    styleUrls: ['./stock-search-dialog.component.scss']
})
export class StockSearchDialogComponent implements OnInit {
    searchQuery: string = '';
    allProducts: any[] = [];
    filteredProducts: any[] = [];
    loading = false;
    displayedColumns: string[] = ['photo', 'designation', 'reference', 'marque', 'location', 'statut', 'actions'];

    constructor(
        public dialogRef: MatDialogRef<StockSearchDialogComponent>,
        private productService: ProductService,
        private dialog: MatDialog,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.loadProducts();
    }

    loadProducts(): void {
        this.loading = true;
        this.productService.findAll().subscribe({
            next: (products) => {
                this.allProducts = products;
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

    filterProducts(): void {
        if (!this.searchQuery) {
            this.filteredProducts = [...this.allProducts];
        } else {
            const query = this.searchQuery.toLowerCase().trim();
            this.filteredProducts = this.allProducts.filter(p =>
                (p.designation?.toLowerCase().includes(query)) ||
                (p.codeInterne?.toLowerCase().includes(query)) ||
                (p.codeBarres?.toLowerCase().includes(query)) ||
                (p.marque?.toLowerCase().includes(query)) ||
                (p.referenceFournisseur?.toLowerCase().includes(query))
            );
        }
    }

    selectProduct(product: any): void {
        this.dialogRef.close({ action: 'SELECT', product });
    }

    requestTransfer(product: any): void {
        const dialogRef = this.dialog.open(StockTransferDialogComponent, {
            width: '400px',
            data: { product }
        });

        dialogRef.afterClosed().subscribe(targetWarehouseId => {
            if (targetWarehouseId) {
                this.loading = true;
                this.cdr.detectChanges(); // Update spinner state immediately
                this.productService.initiateTransfer(product.id, targetWarehouseId).subscribe({
                    next: () => {
                        this.loading = false;
                        // Refresh to show updated status
                        this.loadProducts();
                        // Optionally close with 'TRANSFER_INITIATED' or assume user stays to select?
                        // User likely wants to select it even if transfer is pending, to fill the form.
                        // I'll update the product status locally for immediate feedback
                        product.statut = 'RESERVE';
                        // this.selectProduct(product); // Auto-select? Or let user click?
                        // Let's let user see the status change to "RESERVE" first.
                        this.cdr.detectChanges();
                    },
                    error: (err) => {
                        console.error('Transfer initiation failed:', err);
                        this.loading = false;
                        this.cdr.detectChanges();
                    }
                });
            }
        });
    }
}
