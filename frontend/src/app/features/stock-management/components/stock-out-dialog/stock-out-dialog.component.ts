import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Product } from '../../../../shared/interfaces/product.interface';
import { CentersService } from '../../../centers/services/centers.service';
import { WarehousesService } from '../../../warehouses/services/warehouses.service';
import { Centre, Entrepot } from '../../../../shared/interfaces/warehouse.interface';

@Component({
  selector: 'app-stock-out-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title class="text-red-600">
      <mat-icon class="align-middle mr-2">remove_shopping_cart</mat-icon>
      Sortie de stock - {{ data.product.designation }}
    </h2>
    
    <mat-dialog-content>
      <!-- Header Banner -->
      <div class="mb-6 p-4 bg-red-50 rounded-lg border border-red-200 w-full">
        <div class="grid grid-cols-2 gap-4">
          <p class="m-0 text-sm"><strong>Stock actuel :</strong> {{ data.product.quantiteActuelle }}</p>
          <p class="m-0 text-sm"><strong>Entrepôt actuel :</strong> {{ data.product.entrepot?.nom }}</p>
          <div class="col-span-2">
             <p class="m-0 text-sm text-red-700"><strong>Note :</strong> Cette opération va décrémenter le stock physique.</p>
          </div>
        </div>
      </div>

      <form [formGroup]="form" class="flex flex-col gap-5 py-2 w-full">
        
        <!-- Row 1: Quantity and Type -->
        <div class="grid grid-cols-2 gap-4 w-full">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Quantité à sortir</mat-label>
            <input matInput type="number" formControlName="quantite" placeholder="Ex: 1">
            <mat-error *ngIf="form.get('quantite')?.hasError('required')">Requis</mat-error>
            <mat-error *ngIf="form.get('quantite')?.hasError('min')">Positive</mat-error>
            <mat-error *ngIf="form.get('quantite')?.hasError('max')">Max {{ data.product.quantiteActuelle }}</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Type de sortie</mat-label>
            <mat-select formControlName="typeSortie">
              <mat-option value="AJUSTEMENT">Ajustement d'inventaire</mat-option>
              <mat-option value="CASSE">Casse / Produit défectueux</mat-option>
              <mat-option value="RETOUR_FOURNISSEUR">Retour fournisseur</mat-option>
              <mat-option value="AUTRE">Autre motif</mat-option>
            </mat-select>
          </mat-form-field>
        </div>


        <!-- Row 3: Motif / Justification -->
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Motif / Justification (Champs libre)</mat-label>
          <textarea matInput formControlName="motif" rows="3" placeholder="Expliquez la raison de cette sortie..."></textarea>
          <mat-error *ngIf="form.get('motif')?.hasError('required')">Le motif est obligatoire pour justifier la sortie</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="pb-6 pr-6 pt-2">
      <button mat-button (click)="onCancel()" class="mr-2">Annuler</button>
      <button mat-raised-button color="warn" 
              [disabled]="form.invalid" 
              (click)="onConfirm()">
        Enregistrer la sortie
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
    .text-red-600 { color: #dc2626; }
    .bg-red-50 { background-color: #fef2f2; }
    .border-red-200 { border-color: #fecaca; }
    .text-red-700 { color: #b91c1c; }
    .bg-gray-50 { background-color: #f9fafb; }
    .border-gray-200 { border-color: #e5e7eb; }
  `]
})
export class StockOutDialogComponent implements OnInit {
  form: FormGroup;
  centres: Centre[] = [];
  targetWarehouses: Entrepot[] = [];

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<StockOutDialogComponent>,
    private centersService: CentersService,
    private warehousesService: WarehousesService,
    @Inject(MAT_DIALOG_DATA) public data: { product: Product }
  ) {
    this.form = this.fb.group({
      quantite: [1, [Validators.required, Validators.min(1), Validators.max(this.data.product.quantiteActuelle)]],
      typeSortie: ['AJUSTEMENT', Validators.required],
      targetCentreId: [null],
      destinationEntrepotId: [null],
      motif: ['', Validators.required]
    });

    // Handle Type change logic
    this.form.get('typeSortie')?.valueChanges.subscribe(value => {
      const warehouseCtrl = this.form.get('destinationEntrepotId');

      if (value === 'CASSE') {
        const centreId = this.data.product.entrepot?.centreId;
        if (centreId) {
          this.warehousesService.findAll(centreId).subscribe((warehouses: Entrepot[]) => {
            const defective = warehouses.find(w =>
              w.nom.toLowerCase().includes('défectueux') ||
              w.nom.toLowerCase().includes('defectueux') ||
              w.nom.toUpperCase() === 'DÉFECTUEUX'
            );
            if (defective) {
              warehouseCtrl?.setValue(defective.id);
            }
          });
        }
      } else {
        warehouseCtrl?.setValue(null);
      }
    });
  }

  ngOnInit(): void {
    this.centersService.findAll().subscribe(centres => {
      this.centres = centres;
    });
  }

  onCentreChange(centreId: string): void {
    if (centreId) {
      this.warehousesService.findAll(centreId).subscribe((warehouses: Entrepot[]) => {
        this.targetWarehouses = warehouses;
        this.form.get('destinationEntrepotId')?.setValue(null);
      });
    } else {
      this.targetWarehouses = [];
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (this.form.valid) {
      const val = this.form.value;
      // Combine motif and type for backend
      const finalMotif = `[${val.typeSortie}] ${val.motif}`;
      this.dialogRef.close({
        quantite: val.quantite,
        motif: finalMotif,
        destinationEntrepotId: val.typeSortie === 'CASSE' ? val.destinationEntrepotId : null
      });
    }
  }
}
