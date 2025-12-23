import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Product } from '../../../../shared/interfaces/product.interface';

@Component({
  selector: 'app-stock-entry-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="align-middle mr-2">add_shopping_cart</mat-icon>
      Entrée en stock - {{ data.product.designation }}
    </h2>
    
    <mat-dialog-content>
      <!-- Header Banner -->
      <div class="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 w-full">
        <div class="grid grid-cols-2 gap-4">
          <p class="m-0 text-sm"><strong>Stock actuel :</strong> {{ data.product.quantiteActuelle }}</p>
          <p class="m-0 text-sm"><strong>Entrepôt :</strong> {{ data.product.entrepot?.nom }}</p>
          <div class="col-span-2">
             <p class="m-0 text-sm"><strong>Prix d'achat actuel :</strong> {{ data.product.prixAchatHT | number:'1.2-2' }} DH</p>
          </div>
        </div>
      </div>

      <form [formGroup]="form" class="flex flex-col gap-5 py-2 w-full">
        
        <!-- Row 1: Quantity, Price, Discount -->
        <div class="grid grid-cols-3 gap-4 w-full">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Quantité</mat-label>
            <input matInput type="number" formControlName="quantite" placeholder="Ex: 10" (input)="calculateWeightedAverage()">
            <mat-error *ngIf="form.get('quantite')?.hasError('required')">Requis</mat-error>
            <mat-error *ngIf="form.get('quantite')?.hasError('min')">Positive</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Prix d'achat HT</mat-label>
            <input matInput type="number" formControlName="prixAchatHT" placeholder="0.00" (input)="calculateWeightedAverage()">
            <span matSuffix style="padding-left: 8px; margin-right: 10px; font-weight: 500;">DH</span>
            <mat-error *ngIf="form.get('prixAchatHT')?.hasError('required')">Requis</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Remise Fourn.</mat-label>
            <input matInput type="number" formControlName="remiseFournisseur" placeholder="0" (input)="calculateWeightedAverage()">
            <span matSuffix style="padding-left: 8px; margin-right: 10px; font-weight: 500;">%</span>
            <mat-error *ngIf="form.get('remiseFournisseur')?.hasError('max')">Max 100%</mat-error>
          </mat-form-field>
        </div>

        <!-- Weighted Average Preview (Full Width) -->
        <div class="w-full p-3 bg-blue-50 rounded border border-blue-200" *ngIf="weightedAveragePrice !== null">
          <p class="m-0 text-sm font-semibold text-blue-900">
            <mat-icon class="align-middle mr-1" style="font-size: 18px; height: 18px; width: 18px;">calculate</mat-icon>
            Prix moyen pondéré : {{ weightedAveragePrice | number:'1.2-2' }} DH
          </p>
          <p class="m-0 text-xs text-blue-700 mt-1" *ngIf="priceAfterDiscount !== null && form.get('remiseFournisseur')?.value">
            (Prix après remise : {{ priceAfterDiscount | number:'1.2-2' }} DH)
          </p>
        </div>

        <!-- Row 2: Note / Motif -->
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Motif / Note</mat-label>
          <textarea matInput formControlName="motif" rows="2" placeholder="Ex: Réception commande fournisseur #123"></textarea>
          <mat-error *ngIf="form.get('motif')?.hasError('required')">Le motif est obligatoire</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="pb-6 pr-6 pt-2">
      <button mat-button (click)="onCancel()" class="mr-2">Annuler</button>
      <button mat-raised-button color="primary" 
              [disabled]="form.invalid" 
              (click)="onConfirm()">
        Enregistrer l'entrée
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      overflow: visible !important; 
      padding: 0 24px 20px 24px !important;
      display: flex;
      flex-direction: column;
      align-items: center; 
    }
    
    .bg-gray-50 {
      background-color: #f9fafb;
    }
    
    .bg-blue-50 {
      background-color: #eff6ff;
    }
    
    .border-gray-200 {
      border-color: #e5e7eb;
    }
    
    .border-blue-200 {
      border-color: #bfdbfe;
    }
    
    .text-blue-900 {
      color: #1e3a8a;
    }
    
    .text-blue-700 {
      color: #1d4ed8;
    }
  `]
})
export class StockEntryDialogComponent {
  form: FormGroup;
  weightedAveragePrice: number | null = null;
  priceAfterDiscount: number | null = null;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<StockEntryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { product: Product }
  ) {
    this.form = this.fb.group({
      quantite: [1, [Validators.required, Validators.min(1)]],
      prixAchatHT: [this.data.product.prixAchatHT || 0, [Validators.required, Validators.min(0)]],
      remiseFournisseur: [0, [Validators.min(0), Validators.max(100)]],
      motif: ['', Validators.required]
    });
  }

  calculateWeightedAverage(): void {
    const quantite = this.form.get('quantite')?.value || 0;
    const prixAchatHT = this.form.get('prixAchatHT')?.value || 0;
    const remiseFournisseur = this.form.get('remiseFournisseur')?.value || 0;
    const currentStock = this.data.product.quantiteActuelle || 0;
    const currentPrice = this.data.product.prixAchatHT || 0;

    if (quantite > 0 && prixAchatHT > 0) {
      // Calculate price after discount
      this.priceAfterDiscount = prixAchatHT * (1 - remiseFournisseur / 100);

      // Calculate weighted average: (current_stock × current_price + new_qty × new_price_after_discount) / (current_stock + new_qty)
      const totalValue = (currentStock * currentPrice) + (quantite * this.priceAfterDiscount);
      const totalQuantity = currentStock + quantite;

      this.weightedAveragePrice = totalQuantity > 0 ? totalValue / totalQuantity : 0;
    } else {
      this.weightedAveragePrice = null;
      this.priceAfterDiscount = null;
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (this.form.valid) {
      this.dialogRef.close({
        ...this.form.value,
        weightedAveragePrice: this.weightedAveragePrice
      });
    }
  }
}
