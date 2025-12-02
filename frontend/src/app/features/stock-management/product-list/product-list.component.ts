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
import { Product, ProductType, ProductStatus, ProductFilters, StockStats } from '../../../shared/interfaces/product.interface';
import { ProductService } from '../services/product.service';

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
    displayedColumns: string[] = ['codeInterne', 'designation', 'marque', 'typeArticle', 'quantiteActuelle', 'prixVenteHT', 'statut', 'actions'];
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
        byType: {
            montures: 0,
            verres: 0,
            lentilles: 0,
            accessoires: 0
        }
    };

    productTypes = Object.values(ProductType);
    productStatuses = Object.values(ProductStatus);

    constructor(private productService: ProductService) { }

    ngOnInit(): void {
        this.loadProducts();
        this.loadStats();
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    loadProducts(): void {
        this.productService.findAll(this.filter).subscribe(products => {
            this.dataSource.data = products;
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

    getStatusClass(status: ProductStatus): string {
        switch (status) {
            case ProductStatus.DISPONIBLE:
                return 'status-disponible';
            case ProductStatus.RESERVE:
                return 'status-reserve';
            case ProductStatus.EN_COMMANDE:
                return 'status-commande';
            case ProductStatus.RUPTURE:
                return 'status-rupture';
            case ProductStatus.OBSOLETE:
                return 'status-obsolete';
            default:
                return '';
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
        return price.toFixed(2) + ' €';
    }

    exportXLS(): void {
        // TODO: Implement Excel export
        console.log('Export to Excel');
    }

    printBarcode(product: Product): void {
        // TODO: Implement barcode printing
        console.log('Print barcode for:', product.designation);
    }
}
