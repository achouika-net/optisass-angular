import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../core/store/auth/auth.selectors';
import { Product, ProductType, ProductStatus, ProductFilters, StockStats } from '../../../shared/interfaces/product.interface';
import { ProductService } from '../services/product.service';
import { effect } from '@angular/core';

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
        FormsModule
    ],
    templateUrl: './product-list.component.html',
    styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit {
    displayedColumns: string[] = ['codeInterne', 'designation', 'marque', 'typeArticle', 'centre', 'entrepot', 'quantiteActuelle', 'prixVenteTTC', 'statut', 'actions'];
    dataSource: MatTableDataSource<Product> = new MatTableDataSource<Product>([]);

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
        private store: Store
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
            const center = this.currentCentre();
            if (center) {
                // Strictly filter by current center to avoid remote leaks in table view
                this.dataSource.data = products.filter(p => p.entrepot?.centreId === center.id);
            } else {
                this.dataSource.data = products;
            }
        });
    }

    loadStats(): void {
        this.productService.getStockStats().subscribe(stats => {
            this.stats = stats;
        });
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
}
