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
        <h2 mat-dialog-title>Transférer le produit</h2>
        <mat-dialog-content>
            <p><strong>Produit :</strong> {{ data.product.designation }}</p>
            <p class="warning-text">
                <mat-icon inline>info</mat-icon>
                Le produit sera réservé jusqu'à réception dans l'entrepôt de destination.
            </p>

            <form [formGroup]="form" class="transfer-form">
                <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Entrepôt de destination</mat-label>
                    <mat-select formControlName="targetWarehouseId">
                        <mat-option *ngFor="let w of availableWarehouses" [value]="w.id">
                            {{ w.nom }} ({{ w.type }})
                        </mat-option>
                    </mat-select>
                    <mat-error *ngIf="form.get('targetWarehouseId')?.hasError('required')">
                        Requis
                    </mat-error>
                </mat-form-field>
            </form>

            <div *ngIf="loading" class="loading-spinner">
                <mat-spinner diameter="30"></mat-spinner>
            </div>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button (click)="cancel()">Annuler</button>
            <button mat-raised-button color="primary" (click)="confirm()" [disabled]="form.invalid || loading">
                Confirmer le transfert
            </button>
        </mat-dialog-actions>
    `,
    styles: [`
        .full-width { width: 100%; margin-top: 16px; }
        .warning-text { color: #666; font-size: 0.9em; display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .loading-spinner { display: flex; justify-content: center; margin-top: 10px; }
    `]
})
export class StockTransferDialogComponent implements OnInit {
    form: FormGroup;
    availableWarehouses: Entrepot[] = [];
    loading = false;

    constructor(
        public dialogRef: MatDialogRef<StockTransferDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { product: Product },
        private fb: FormBuilder,
        private warehousesService: WarehousesService
    ) {
        this.form = this.fb.group({
            targetWarehouseId: ['', Validators.required]
        });
    }

    ngOnInit(): void {
        this.loadWarehouses();
    }

    loadWarehouses(): void {
        this.loading = true;
        // Fetch all warehouses (could filter by center if strictly hierarchical, 
        // but robust transfer allows any warehouse usually).
        // Passing no arguments fetches all (or needs implementation in service if strictly filtered).
        // Let's assume findAll() returns all or we filter client side.
        this.warehousesService.findAll().subscribe({
            next: (warehouses) => {
                this.availableWarehouses = warehouses.filter(w => w.id !== this.data.product.entrepotId);
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading warehouses', err);
                this.loading = false;
            }
        });
    }

    cancel(): void {
        this.dialogRef.close();
    }

    confirm(): void {
        if (this.form.valid) {
            this.dialogRef.close(this.form.get('targetWarehouseId')?.value);
        }
    }
}
