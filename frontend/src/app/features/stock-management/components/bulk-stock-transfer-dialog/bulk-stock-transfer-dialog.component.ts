import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { Product } from '../../../../shared/interfaces/product.interface';
import { ProductService } from '../../services/product.service';
import { CentersService } from '../../../centers/services/centers.service';
import { WarehousesService } from '../../../warehouses/services/warehouses.service';
import { Centre, Entrepot } from '../../../../shared/interfaces/warehouse.interface';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-bulk-stock-transfer-dialog',
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
    MatIconModule,
    MatTableModule
  ],
  template: `
    <h2 mat-dialog-title class="text-primary">
      <mat-icon class="align-middle mr-2">swap_horiz</mat-icon>
      Transfert de stock groupé ({{ data.products.length }} produits)
    </h2>
    
    <mat-dialog-content>
      <!-- Destination Selection -->
      <div class="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <form [formGroup]="destinationForm" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Centre de destination</mat-label>
            <mat-select formControlName="targetCentreId" (selectionChange)="onCentreChange($event.value)">
              <mat-option *ngFor="let c of centres" [value]="c.id">{{ c.nom }}</mat-option>
            </mat-select>
            <mat-error *ngIf="destinationForm.get('targetCentreId')?.hasError('required')">Requis</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Entrepôt de destination</mat-label>
            <mat-select formControlName="destinationEntrepotId">
              <mat-option *ngFor="let e of targetWarehouses" [value]="e.id">{{ e.nom }} ({{ e.type }})</mat-option>
            </mat-select>
            <mat-error *ngIf="destinationForm.get('destinationEntrepotId')?.hasError('required')">Requis</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="md:col-span-2 w-full">
            <mat-label>Motif / Justification du transfert</mat-label>
            <input matInput formControlName="motif" placeholder="Ex: Rééquilibrage de stock, Commande client...">
            <mat-error *ngIf="destinationForm.get('motif')?.hasError('required')">Requis</mat-error>
          </mat-form-field>
        </form>
      </div>

      <table mat-table [dataSource]="data.products" class="w-full">
        <ng-container matColumnDef="designation">
          <th mat-header-cell *matHeaderCellDef> Produit </th>
          <td mat-cell *matCellDef="let p"> 
            <div class="flex flex-col">
                <span class="font-medium">{{ p.designation }}</span>
                <span class="text-xs text-gray-500">{{ p.codeInterne }} | Origine: {{ p.entrepot?.nom }} (Stock: {{ p.quantiteActuelle }})</span>
            </div>
          </td>
        </ng-container>

        <ng-container matColumnDef="quantite">
          <th mat-header-cell *matHeaderCellDef> Quantité à transférer </th>
          <td mat-cell *matCellDef="let p; let i = index">
            <mat-form-field appearance="outline" class="w-24 mt-2" [formGroup]="getQuantityGroup(i)">
              <input matInput type="number" formControlName="quantite" (change)="validateQuantity(i, p)">
              <mat-error *ngIf="getQuantityGroup(i).get('quantite')?.hasError('max')">
                Max {{ p.quantiteActuelle }}
              </mat-error>
            </mat-form-field>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="['designation', 'quantite']"></tr>
        <tr mat-row *matRowDef="let row; columns: ['designation', 'quantite'];"></tr>
      </table>

    </mat-dialog-content>

    <mat-dialog-actions align="end" class="pb-6 pr-6 pt-2">
      <button mat-button (click)="onCancel()" class="mr-2">Annuler</button>
      <button mat-raised-button color="primary" 
              [disabled]="destinationForm.invalid || isQuantitiesInvalid() || loading" 
              (click)="onConfirm()">
        {{ loading ? 'Transfert en cours...' : 'Confirmer le transfert groupé' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      min-width: 800px;
      overflow-x: hidden !important;
    }
    .text-primary { color: #3f51b5; }
    .bg-blue-50 { background-color: #eff6ff; }
    .border-blue-200 { border-color: #bfdbfe; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    .mat-column-designation { width: 75%; padding-right: 32px; }
    .mat-column-quantite { width: 25%; }
  `]
})
export class BulkStockTransferDialogComponent implements OnInit {
  destinationForm: FormGroup;
  quantitiesForm: FormGroup;
  centres: Centre[] = [];
  targetWarehouses: Entrepot[] = [];
  loading = false;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<BulkStockTransferDialogComponent>,
    private productService: ProductService,
    private centersService: CentersService,
    private warehousesService: WarehousesService,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: { products: Product[] }
  ) {
    this.destinationForm = this.fb.group({
      targetCentreId: [null, Validators.required],
      destinationEntrepotId: [null, Validators.required],
      motif: ['', Validators.required]
    });

    this.quantitiesForm = this.fb.group({
      items: this.fb.array(this.data.products.map(p => this.fb.group({
        quantite: [1, [Validators.required, Validators.min(1), Validators.max(p.quantiteActuelle)]]
      })))
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
        // Filter out defective warehouses
        this.targetWarehouses = warehouses.filter(w =>
          !w.nom?.toLowerCase().includes('défectueux') &&
          !w.nom?.toLowerCase().includes('defectueux') &&
          w.nom?.toUpperCase() !== 'DÉFECTUEUX'
        );
        this.destinationForm.get('destinationEntrepotId')?.setValue(null);
      });
    } else {
      this.targetWarehouses = [];
    }
  }

  get items(): FormArray {
    return this.quantitiesForm.get('items') as FormArray;
  }

  getQuantityGroup(index: number): FormGroup {
    return this.items.at(index) as FormGroup;
  }

  validateQuantity(index: number, product: Product): void {
    const ctrl = this.getQuantityGroup(index).get('quantite');
    if (ctrl && ctrl.value > product.quantiteActuelle) {
      ctrl.setErrors({ max: true });
    }
  }

  isQuantitiesInvalid(): boolean {
    return this.quantitiesForm.invalid;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (this.destinationForm.invalid || this.quantitiesForm.invalid) return;

    this.loading = true;
    const { destinationEntrepotId, motif } = this.destinationForm.value;
    const finalMotif = `[TRANSFERT_GROUPEE] ${motif}`;

    const requests = this.data.products.map((p, i) => {
      const qty = this.getQuantityGroup(i).get('quantite')?.value;
      return this.productService.destock(p.id!, qty, finalMotif, destinationEntrepotId);
    });

    forkJoin(requests).subscribe({
      next: () => {
        this.snackBar.open('Transfert groupé effectué avec succès', 'OK', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: (err: any) => {
        console.error('Erreur lors du transfert groupé:', err);
        const errorMsg = err.error?.message || 'Erreur lors du transfert groupé';
        this.snackBar.open(errorMsg, 'Fermer', { duration: 5000 });
        this.loading = false;
      }
    });
  }
}
