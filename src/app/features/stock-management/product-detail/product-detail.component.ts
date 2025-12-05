import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { ProductService } from '../services/product.service';
import { Product, Frame } from '../../../shared/interfaces/product.interface';

@Component({
    selector: 'app-product-detail',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule
    ],
    templateUrl: './product-detail.component.html',
    styleUrls: ['./product-detail.component.scss']
})
export class ProductDetailComponent implements OnInit {
    product: Product | undefined;
    productId: string | null = null;

    constructor(
        private productService: ProductService,
        private route: ActivatedRoute,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.productId = this.route.snapshot.paramMap.get('id');
        if (this.productId) {
            this.loadProduct(this.productId);
        }
    }

    loadProduct(id: string): void {
        this.productService.findOne(id).subscribe(product => {
            this.product = product;
        });
    }

    editProduct(): void {
        if (this.productId) {
            this.router.navigate(['/p/stock', this.productId, 'edit']);
        }
    }

    deleteProduct(): void {
        if (this.productId && confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
            this.productService.delete(this.productId).subscribe(() => {
                this.router.navigate(['/p/stock']);
            });
        }
    }

    goBack(): void {
        this.router.navigate(['/p/stock']);
    }

    getFrameData(): Frame | undefined {
        return this.product?.typeArticle === 'monture' ? this.product as Frame : undefined;
    }

    formatPrice(price: number): string {
        return price.toFixed(2) + ' €';
    }
}
