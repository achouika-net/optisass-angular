import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { ProductService } from '../../services/product.service';
import { Product, Frame } from '../../../../shared/interfaces/product.interface';
import { finalize, timeout } from 'rxjs/operators';

import { MatDialog } from '@angular/material/dialog';
import { StockTransferDialogComponent } from '../../dialogs/stock-transfer-dialog/stock-transfer-dialog.component';

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
    product: any | undefined; // Use any to match include structure if needed
    productId: string | null = null;
    isLoading = true;

    constructor(
        private productService: ProductService,
        private route: ActivatedRoute,
        private router: Router,
        private cdr: ChangeDetectorRef,
        private dialog: MatDialog
    ) { }

    ngOnInit(): void {
        this.route.paramMap.subscribe(params => {
            this.productId = params.get('id');
            if (this.productId) {
                this.loadProduct(this.productId);
            } else {
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    loadProduct(id: string): void {
        console.log('Starting loadProduct for ID:', id);
        this.isLoading = true;

        // Failsafe: Manual timeout to guarantee spinner removal
        setTimeout(() => {
            if (this.isLoading) {
                console.warn('Manual timeout triggered!');
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        }, 6000);

        this.productService.findOne(id)
            .pipe(
                timeout(5000), // Force error after 5 seconds if no response
                finalize(() => {
                    console.log('Finalize called');
                    this.isLoading = false;
                    this.cdr.detectChanges();
                })
            )
            .subscribe({
                next: (product) => {
                    console.log('Product loaded successfully:', product);
                    this.product = product;
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Error loading product:', err);
                    this.cdr.detectChanges();
                }
            });
    }

    editProduct(): void {
        if (this.productId) {
            this.router.navigate(['/p/stock', this.productId, 'edit']);
        }
    }

    requestTransfer(): void {
        if (!this.product) return;

        const dialogRef = this.dialog.open(StockTransferDialogComponent, {
            width: '400px',
            data: { product: this.product }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && result.targetWarehouseId) {
                // To get the targetProductId, we need all products for that warehouse
                // Since this component might not have allProducts loaded, we might need a search
                // For now, let's try to find it in the current context or prompt to create it

                // We'll call a temporary search to find the target product
                this.isLoading = true;
                this.productService.findAll({ entrepotId: result.targetWarehouseId }).subscribe({
                    next: (targetProducts) => {
                        const targetProduct = targetProducts.find(p =>
                            p.designation === this.product?.designation &&
                            p.codeInterne === this.product?.codeInterne
                        );

                        if (!targetProduct) {
                            this.isLoading = false;
                            alert("Le produit correspondant n'existe pas dans l'entrepôt de destination. Veuillez d'abord le créer.");
                            return;
                        }

                        this.productService.initiateTransfer(this.product!.id, targetProduct.id).subscribe({
                            next: () => {
                                this.isLoading = false;
                                this.cdr.detectChanges();
                                if (this.productId) this.loadProduct(this.productId);
                            },
                            error: (err) => {
                                console.error('Transfer initiation failed:', err);
                                this.isLoading = false;
                                this.cdr.detectChanges();
                            }
                        });
                    },
                    error: (err) => {
                        console.error('Target discovery failed:', err);
                        this.isLoading = false;
                        this.cdr.detectChanges();
                    }
                });
            }
        });
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

    getFrameData(): any | undefined {
        if (!this.product) return undefined;
        const type = (this.product.typeArticle || '').toUpperCase();
        if (type.includes('MONTURE') || type === 'SOLAIRE' || type === 'OPTIQUE') {
            // Fusionner specificData dans l'objet pour le template
            const spec = this.product.specificData || {};
            return {
                ...this.product,
                categorie: this.product.categorie || (type === 'MONTURE_SOLAIRE' ? 'solaire' : 'optique'),
                genre: spec.genre || (this.product as any).genre,
                forme: spec.forme || (this.product as any).forme,
                matiere: spec.materiau || spec.matiere || (this.product as any).matiere || (this.product as any).materiau,
                calibre: spec.calibre || (this.product as any).calibre,
                pont: spec.pont || (this.product as any).pont,
                branche: spec.branche || (this.product as any).branche
            };
        }
        return undefined;
    }

    formatPrice(price: number | undefined | null): string {
        if (price === undefined || price === null) {
            return '0.00 DH';
        }
        return Number(price).toFixed(2) + ' DH';
    }
}
