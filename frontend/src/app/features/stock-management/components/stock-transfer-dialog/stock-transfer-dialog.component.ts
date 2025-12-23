import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { WarehousesService } from '../../../warehouses/services/warehouses.service';
import { Entrepot } from '../../../../shared/interfaces/warehouse.interface';
import { Product } from '../../../../shared/interfaces/product.interface';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';
import { CentersService } from '../../../centers/services/centers.service';
import { ProductService } from '../../services/product.service';
import { switchMap } from 'rxjs';

@Component({
    selector: 'app-stock-transfer-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        ReactiveFormsModule
    ],
    template: `
        <h2 mat-dialog-title class="transfer-title">
            <mat-icon>swap_horiz</mat-icon>
            Réserver / Transférer le produit
        </h2>
        <mat-dialog-content>
            <div class="product-info mb-4 p-3 bg-gray-50 rounded">
                <div class="text-sm text-gray-500 uppercase font-bold tracking-wider">Produit</div>
                <div class="text-lg font-bold">{{ data.product.designation }}</div>
                <div class="text-xs text-gray-400">{{ data.product.codeInterne }} | {{ data.product.marque }}</div>
            </div>

            <div class="flex flex-col gap-4 mt-4">
                <!-- SENDER -->
                <div class="center-box sender">
                    <div class="label"><mat-icon inline>outbound</mat-icon> Expéditeur (Source)</div>
                    
                    <form [formGroup]="form" class="transfer-form">
                        <!-- Sender Center Selection -->
                        <mat-form-field appearance="outline" class="full-width mt-2">
                             <mat-label>Centre Source</mat-label>
                             <mat-select formControlName="sourceCenterId" (selectionChange)="onCenterChange($event.value)">
                                 <mat-option *ngFor="let c of centers" [value]="c.id">
                                     {{ c.nom }}
                                 </mat-option>
                             </mat-select>
                        </mat-form-field>

                        <!-- Sender Warehouse Selection -->
                        <mat-form-field appearance="outline" class="full-width mt-1">
                            <mat-label>Entrepôt d'origine</mat-label>
                            <mat-select formControlName="sourceWarehouseId" (selectionChange)="onSourceChange($event.value)">
                                <mat-option *ngFor="let w of senderWarehouses" [value]="w.id">
                                    {{ w.nom }} ({{ w.type }})
                                </mat-option>
                            </mat-select>
                        </mat-form-field>

                        <div *ngIf="productLookupLoading" class="text-xs text-blue-500 animate-pulse mt-1">
                            Recherche du produit dans l'entrepôt source...
                        </div>
                         <div *ngIf="!form.get('productId')?.value && !productLookupLoading && form.get('sourceWarehouseId')?.value" class="text-xs text-red-500 mt-1">
                            Ce produit n'est pas disponible dans l'entrepôt sélectionné.
                        </div>
                    </form>
                </div>

                <div class="flex justify-center my-[-10px] z-10">
                    <div class="arrow-down bg-white rounded-full p-1 border shadow-sm">
                        <mat-icon class="text-primary">arrow_downward</mat-icon>
                    </div>
                </div>

                <!-- RECEIVER (LOCAL) -->
                <div class="center-box receiver">
                    <div class="label"><mat-icon inline>login</mat-icon> Destinataire (Local)</div>
                    <div class="center-name">{{ currentCenter?.nom || 'Mon Centre' }}</div>

                    <div class="target-info p-2 bg-white/50 rounded border border-blue-100 mt-2">
                        <div class="text-xs text-blue-500 font-bold uppercase tracking-tight">Cible systématique</div>
                        <div *ngIf="targetWarehouse" class="text-sm font-medium">
                            {{ targetWarehouse.nom }} ({{ targetWarehouse.type }})
                        </div>
                        <div *ngIf="!targetWarehouse" class="text-sm text-red-500">
                            Aucun entrepôt correspondant à {{ sourceWarehouseType }} trouvé à {{ currentCenter?.nom }}.
                        </div>
                    </div>
                </div>
            </div>

            <p class="warning-text mt-4">
                <mat-icon inline>info</mat-icon>
                Le produit sera réservé jusqu'à réception physique dans votre entrepôt.
            </p>

            <div *ngIf="loading" class="loading-spinner">
                <mat-spinner diameter="30"></mat-spinner>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button (click)="cancel()">Annuler</button>
            <button mat-raised-button color="primary" (click)="confirm()" [disabled]="form.invalid || loading || productLookupLoading">
                Confirmer le transfert
            </button>
        </mat-dialog-actions>
    `,
    styles: [`
        .transfer-title { display: flex; align-items: center; gap: 8px; font-weight: bold; color: #333; }
        .full-width { width: 100%; }
        .center-box { padding: 12px; border-radius: 8px; border: 1px solid #e0e0e0; }
        .center-box.sender { background-color: #f9fafb; border-left: 4px solid #9ca3af; }
        .center-box.receiver { background-color: #eff6ff; border-left: 4px solid #3b82f6; }
        .label { font-size: 0.75rem; color: #6b7280; font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 4px; }
        .center-name { font-weight: bold; color: #111827; }
        .warning-text { color: #d97706; font-size: 0.85rem; display: flex; align-items: flex-start; gap: 8px; }
        .loading-spinner { display: flex; justify-content: center; margin-top: 10px; }
    `]
})
export class StockTransferDialogComponent implements OnInit {
    form: FormGroup;
    centers: any[] = [];
    senderWarehouses: Entrepot[] = [];
    targetWarehouse: Entrepot | undefined;
    sourceWarehouseType: string = '';
    currentCenter: any;
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
            sourceWarehouseId: [this.data.product.entrepotId, Validators.required], // Default to current if valid
            targetWarehouseId: ['', Validators.required],
            productId: [this.data.product.id, Validators.required]
        });
    }

    ngOnInit(): void {
        this.loadCenters();
        // Initial setup based on passed product's center
        this.loadSenderWarehouses(this.data.product.entrepot?.centreId);
        // We trigger onSourceChange to setup target calculation, BUT we skip product lookup loop if it's the same ID
        // Actually, onSourceChange logic relies on "sourceWarehouseId" change
        // We manually call it to sync state
        this.onSourceChange(this.data.product.entrepotId);
    }

    loadCenters(): void {
        this.centersService.findAll().subscribe(centers => {
            this.centers = centers;
        });
    }

    onCenterChange(centreId: string): void {
        this.form.patchValue({ sourceWarehouseId: '' }); // Reset warehouse
        this.loadSenderWarehouses(centreId);
    }

    loadSenderWarehouses(centreId: string): void {
        if (!centreId) return;

        this.loading = true;
        this.warehousesService.findAll(centreId).subscribe({
            next: (warehouses) => {
                // Filter out warehouses if they match the TARGET warehouse logic
                // But target is not fully determined yet.
                // At minimum, we should filter out the target if it is exactly the same warehouse instance?
                // But for now, we leave it, and validation logic handles self-transfer blocking.
                this.senderWarehouses = warehouses;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading sender warehouses', err);
                this.loading = false;
            }
        });
    }

    onSourceChange(warehouseId: string): void {
        const sourceWh = this.senderWarehouses.find(w => w.id === warehouseId) || (warehouseId === this.data.product.entrepotId ? this.data.product.entrepot : null);

        if (!sourceWh) {
            // Maybe warehouses list is not yet loaded or mismatch.
            return;
        }

        this.sourceWarehouseType = sourceWh.type;

        // 1. Find matched destination in localWarehouses
        this.targetWarehouse = this.data.localWarehouses.find(w => w.type === sourceWh.type);

        // If not found by exact type, fallback to PRINCIPAL if available
        if (!this.targetWarehouse && sourceWh.type !== 'PRINCIPAL') {
            this.targetWarehouse = this.data.localWarehouses.find(w => w.type === 'PRINCIPAL');
        }

        if (this.targetWarehouse) {
            this.form.patchValue({ targetWarehouseId: this.targetWarehouse.id });
        } else {
            this.form.patchValue({ targetWarehouseId: '' });
        }

        // 2. Find systematic product ID in the new source warehouse
        // First, check local cache (if we selected the center we came from or if data.allProducts has it)
        let matchingProduct = this.data.allProducts.find(p =>
            p.entrepotId === warehouseId &&
            p.codeInterne === this.data.product.codeInterne
        );

        if (matchingProduct) {
            this.setMatchingProduct(matchingProduct);
        } else {
            // Need to fetch from backend
            this.productLookupLoading = true;
            this.form.patchValue({ productId: '' }); // Clear while loading

            this.productService.findAll({ entrepotId: warehouseId }).subscribe({
                next: (products) => {
                    matchingProduct = products.find(p => p.codeInterne === this.data.product.codeInterne);
                    this.setMatchingProduct(matchingProduct);
                    this.productLookupLoading = false;
                },
                error: (err) => {
                    console.error('Error fetching remote products', err);
                    this.productLookupLoading = false;
                }
            });
        }
    }

    setMatchingProduct(product: any): void {
        if (product) {
            // Check for self-transfer
            if (product.id === this.data.product.id) {
                this.form.get('productId')?.setValue(null);
                this.form.get('productId')?.setErrors({ selfTransfer: true });
            } else {
                this.form.patchValue({ productId: product.id });
                this.form.get('productId')?.setErrors(null);
            }
        } else {
            this.form.patchValue({ productId: '' });
        }
    }

    cancel(): void {
        this.dialogRef.close();
    }

    confirm(): void {
        if (this.form.valid) {
            // Result to parent: { productId, targetWarehouseId }
            this.dialogRef.close({
                productId: this.form.value.productId,
                targetWarehouseId: this.form.value.targetWarehouseId,
                targetCentreId: this.targetWarehouse?.centreId || this.currentCenter?.id
            });
        }
    }
}
