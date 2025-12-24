
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { WarehousesService } from '../../../warehouses/services/warehouses.service';
import { CentersService } from '../../../centers/services/centers.service';
import { ProductService } from '../../services/product.service';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';
import { Entrepot } from '../../../../shared/interfaces/warehouse.interface';
import { Product } from '../../../../shared/interfaces/product.interface';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
    selector: 'app-stock-transfer-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatSelectModule,
        MatInputModule,
        MatIconModule,
        MatProgressSpinnerModule
    ],
    template: `
        <h2 mat-dialog-title class="transfer-title">
            <mat-icon inline>swap_horiz</mat-icon> Réserver / Transférer le produit
        </h2>
        
        <mat-dialog-content>
            <div class="product-banner mb-4">
                <div class="text-xs text-gray-500 font-medium uppercase tracking-wider">Produit</div>
                <div class="text-lg font-bold text-gray-800">{{ data.product.designation }}</div>
                <div class="text-xs text-gray-400">{{ data.product.codeInterne }} | {{ data.product.marque }}</div>
            </div>

            <div [formGroup]="form" class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- SOURCE BOX (SENDER) -->
                    <div class="center-box source">
                        <div class="box-header">
                            <mat-icon inline>outbound</mat-icon> EXPÉDITEUR (Source)
                        </div>
                        
                        <div class="p-3 space-y-3">
                            <mat-form-field appearance="outline" class="full-width compact">
                                <mat-label>Centre</mat-label>
                                <mat-select formControlName="sourceCenterId" (selectionChange)="onCenterChange($any($event).value)">
                                    <mat-option *ngFor="let c of centers" [value]="c.id">
                                        {{ c.nom }}
                                    </mat-option>
                                </mat-select>
                            </mat-form-field>

                            <mat-form-field appearance="outline" class="full-width compact">
                                <mat-label>Entrepôt</mat-label>
                                <mat-select formControlName="sourceWarehouseId" (selectionChange)="onSourceChange($any($event).value)">
                                    <mat-option *ngFor="let w of senderWarehouses" [value]="w.id">
                                        {{ w.nom }}
                                    </mat-option>
                                </mat-select>
                            </mat-form-field>

                            <div *ngIf="productLookupLoading" class="text-xs text-blue-500 italic flex items-center gap-2">
                                <mat-spinner diameter="14"></mat-spinner> Vérification du stock...
                            </div>

                            <div *ngIf="matchingProduct" class="stock-info-card">
                                <div class="label">Stock disponible à la source</div>
                                <div class="value">{{ matchingProduct.quantiteActuelle }} unités</div>
                            </div>
                            
                            <div *ngIf="!matchingProduct && !productLookupLoading && form.get('sourceWarehouseId')?.value" class="error-msg">
                                <mat-icon inline>warning</mat-icon> Produit non trouvé dans cet entrepôt.
                            </div>
                        </div>
                    </div>

                    <!-- DESTINATION BOX (RECEIVER) -->
                    <div class="center-box destination">
                        <div class="box-header">
                            <mat-icon inline>login</mat-icon> DESTINATAIRE (Local)
                        </div>
                        
                        <div class="p-3">
                            <div class="mb-3">
                                <div class="text-xs text-gray-500 font-semibold uppercase">Centre Actuel</div>
                                <div class="font-bold text-blue-700">{{ currentCenter?.nom || 'Mon Centre' }}</div>
                            </div>

                            <div class="target-summary">
                                <div class="text-xs text-blue-500 font-bold uppercase tracking-tight mb-1">Cible Automatique</div>
                                <div *ngIf="targetWarehouse" class="text-sm font-bold text-gray-800">
                                    {{ targetWarehouse.nom }}
                                    <span class="block text-xs font-normal text-gray-500">Nature: {{ targetWarehouse.type }}</span>
                                </div>
                                <div *ngIf="!targetWarehouse" class="text-sm text-red-500 font-medium">
                                    Aucun entrepôt cible trouvé pour {{ sourceWarehouseType }} à {{ currentCenter?.nom }}.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- QUANTITY INPUT -->
                <div class="quantity-row bg-gray-50 p-4 rounded-lg flex items-center justify-between gap-4 border border-gray-100">
                    <div class="flex-1">
                        <div class="text-sm font-bold text-gray-700">Quantité à transférer</div>
                        <p class="text-xs text-gray-500 m-0">Saisissez le nombre total d'unités à déplacer vers votre centre.</p>
                    </div>
                    <mat-form-field appearance="outline" class="qty-field">
                        <input matInput type="number" formControlName="quantite" placeholder="1">
                        <mat-error *ngIf="form.get('quantite')?.hasError('max')">
                            Max: {{ form.get('quantite')?.getError('max').max }}
                        </mat-error>
                    </mat-form-field>
                </div>

                <div class="warning-banner text-xs text-amber-700 flex items-start gap-2 bg-amber-50 p-3 rounded border border-amber-100">
                    <mat-icon inline>info</mat-icon>
                    <span>Le produit sera réservé à la source jusqu'à sa réception physique dans votre entrepôt {{ targetWarehouse?.nom }}.</span>
                </div>
            </div>
        </mat-dialog-content>

        <mat-dialog-actions align="end">
            <button mat-button (click)="cancel()">Annuler</button>
            <button mat-raised-button color="primary" (click)="confirm()" 
                    [disabled]="form.invalid || loading || productLookupLoading">
                Confirmer le transfert
            </button>
        </mat-dialog-actions>
    `,
    styles: [`
        .transfer-title { display: flex; align-items: center; gap: 8px; font-weight: bold; color: #1e293b; }
        .product-banner { background: #f8fafc; padding: 10px 15px; border-radius: 8px; border: 1px solid #f1f5f9; }
        .full-width { width: 100%; }
        .compact { margin-bottom: -10px; }
        
        .center-box { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; min-height: 220px; }
        .box-header { background: #f1f5f9; padding: 6px 12px; font-size: 0.7rem; font-weight: 800; color: #475569; display: flex; align-items: center; gap: 6px; }
        .center-box.source { border-top: 3px solid #94a3b8; }
        .center-box.destination { border-top: 3px solid #3b82f6; background-color: #eff6ff; }
        
        .stock-info-card { background: #f0fdf4; border: 1px solid #dcfce7; padding: 8px; border-radius: 6px; margin-top: 10px; }
        .stock-info-card .label { font-size: 0.7rem; color: #166534; font-weight: 600; text-transform: uppercase; }
        .stock-info-card .value { font-size: 1.1rem; font-weight: 800; color: #14532d; }
        
        .target-summary { border: 1px dashed #bfdbfe; background: white; padding: 10px; border-radius: 6px; }
        .error-msg { background: #fef2f2; border: 1px solid #fee2e2; color: #991b1b; font-size: 0.75rem; padding: 5px 8px; border-radius: 4px; display: flex; align-items: center; gap: 4px; margin-top: 8px; }
        
        .qty-field { width: 120px; margin-bottom: -1.25em; }
    `]
})
export class StockTransferDialogComponent implements OnInit {
    form: FormGroup;
    centers: any[] = [];
    senderWarehouses: Entrepot[] = [];
    targetWarehouse: Entrepot | undefined;
    sourceWarehouseType: string = '';
    currentCenter: any;
    matchingProduct: Product | undefined;
    sourceStock: number = 0;
    loading = false;
    productLookupLoading = false;

    constructor(
        public dialogRef: MatDialogRef<StockTransferDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { product: any, allProducts: any[], localWarehouses: any[] },
        private fb: FormBuilder,
        private warehousesService: WarehousesService,
        private centersService: CentersService,
        private productService: ProductService,
        private store: Store
    ) {
        this.currentCenter = this.store.selectSignal(UserCurrentCentreSelector)();
        this.form = this.fb.group({
            sourceCenterId: [this.data.product.entrepot?.centreId || '', Validators.required],
            sourceWarehouseId: [this.data.product.entrepotId, Validators.required],
            targetWarehouseId: ['', Validators.required],
            quantite: [1, [Validators.required, Validators.min(1)]],
            productId: [this.data.product.id, Validators.required]
        });
    }

    ngOnInit(): void {
        this.loadCenters();
        const initialCenterId = this.data.product.entrepot?.centreId;
        if (initialCenterId) {
            this.loadWarehouses(initialCenterId);
        }
    }

    loadCenters(): void {
        this.centersService.findAll().subscribe(centers => {
            this.centers = centers;
        });
    }

    onCenterChange(centerId: string): void {
        this.form.patchValue({ sourceWarehouseId: '' });
        this.loadWarehouses(centerId);
    }

    loadWarehouses(centerId: string): void {
        if (!centerId) {
            this.senderWarehouses = [];
            return;
        }
        this.loading = true;
        this.warehousesService.findAll(centerId).subscribe({
            next: (warehouses) => {
                this.senderWarehouses = warehouses;
                this.loading = false;

                // If it's the product's origin, auto-select it
                if (centerId === this.data.product.entrepot?.centreId) {
                    this.form.patchValue({ sourceWarehouseId: this.data.product.entrepotId });
                    this.onSourceChange(this.data.product.entrepotId);
                }
            },
            error: (err) => {
                console.error('Error loading warehouses', err);
                this.loading = false;
            }
        });
    }

    onSourceChange(warehouseId: string): void {
        if (!warehouseId) return;

        const sourceWh = this.senderWarehouses.find(w => w.id === warehouseId) ||
            (warehouseId === this.data.product.entrepotId ? this.data.product.entrepot : null);

        if (!sourceWh) return;

        this.sourceWarehouseType = sourceWh.type;
        this.targetWarehouse = this.data.localWarehouses.find(w => w.type === sourceWh.type);

        if (!this.targetWarehouse && sourceWh.type !== 'PRINCIPAL') {
            this.targetWarehouse = this.data.localWarehouses.find(w => w.type === 'PRINCIPAL');
        }

        if (this.targetWarehouse) {
            this.form.patchValue({ targetWarehouseId: this.targetWarehouse.id });
        } else {
            this.form.patchValue({ targetWarehouseId: '' });
        }

        // Matching logic
        let matchingProduct = this.data.allProducts.find(p =>
            p.entrepotId === warehouseId &&
            p.codeInterne === this.data.product.codeInterne
        );

        if (matchingProduct) {
            this.setMatchingProduct(matchingProduct);
        } else {
            this.productLookupLoading = true;
            this.form.get('quantite')?.disable();
            this.productService.findAll({ entrepotId: warehouseId }).subscribe({
                next: (products) => {
                    const found = products.find(p => p.codeInterne === this.data.product.codeInterne);
                    this.setMatchingProduct(found);
                    this.productLookupLoading = false;
                },
                error: (err) => {
                    console.error('Error matching remote product', err);
                    this.productLookupLoading = false;
                }
            });
        }
    }

    setMatchingProduct(product: any): void {
        if (product) {
            if (product.id === this.data.product.id) {
                // If same product ID as current context, it's a self-transfer attempt (invalid)
                this.form.get('productId')?.setValue(null);
                this.form.get('productId')?.setErrors({ selfTransfer: true });
                this.form.get('quantite')?.disable();
                this.matchingProduct = undefined;
                this.sourceStock = 0;
            } else {
                this.form.patchValue({ productId: product.id });
                this.form.get('productId')?.setErrors(null);
                this.form.get('quantite')?.enable();

                const maxStock = product.quantiteActuelle;
                this.sourceStock = maxStock;
                this.matchingProduct = product;

                this.form.get('quantite')?.setValidators([Validators.required, Validators.min(1), Validators.max(maxStock)]);
                this.form.get('quantite')?.updateValueAndValidity();
            }
        } else {
            this.form.patchValue({ productId: '' });
            this.form.get('productId')?.setErrors({ productNotFound: true });
            this.form.get('quantite')?.disable();
            this.matchingProduct = undefined;
            this.sourceStock = 0;
        }
    }

    cancel(): void {
        this.dialogRef.close();
    }

    confirm(): void {
        if (this.form.valid) {
            this.dialogRef.close({
                productId: this.form.value.productId,
                targetWarehouseId: this.form.value.targetWarehouseId,
                targetCentreId: this.currentCenter?.id,
                quantite: this.form.value.quantite
            });
        }
    }
}
