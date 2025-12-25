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
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-bulk-stock-out-dialog',
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
    <h2 mat-dialog-title class="text-red-600">
      <mat-icon class="align-middle mr-2">remove_shopping_cart</mat-icon>
      Sortie de stock groupée ({{ data.products.length }} produits)
    </h2>
    
    <mat-dialog-content>
      <!-- Global Reason Banner -->
      <div class="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <form [formGroup]="globalForm" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Type de sortie</mat-label>
            <mat-select formControlName="typeSortie">
              <mat-option value="AJUSTEMENT">Ajustement d'inventaire</mat-option>
              <mat-option value="CASSE">Casse / Produit défectueux</mat-option>
              <mat-option value="RETOUR_FOURNISSEUR">Retour fournisseur</mat-option>
              <mat-option value="AUTRE">Autre motif</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Motif / Justification</mat-label>
            <input matInput formControlName="motif" placeholder="Ex: Inventaire annuel...">
            <mat-error *ngIf="globalForm.get('motif')?.hasError('required')">Requis</mat-error>
          </mat-form-field>
        </form>
      </div>

      <table mat-table [dataSource]="data.products" class="w-full">
        <ng-container matColumnDef="designation">
          <th mat-header-cell *matHeaderCellDef> Produit </th>
          <td mat-cell *matCellDef="let p"> 
            <div class="flex flex-col">
                <span class="font-medium">{{ p.designation }}</span>
                <span class="text-xs text-gray-500">{{ p.codeInterne }} | Stock: {{ p.quantiteActuelle }}</span>
            </div>
          </td>
        </ng-container>

        <ng-container matColumnDef="quantite">
          <th mat-header-cell *matHeaderCellDef> Quantité à sortir </th>
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
      <button mat-raised-button color="warn" 
              [disabled]="globalForm.invalid || isQuantitiesInvalid() || loading" 
              (click)="onConfirm()">
        {{ loading ? 'Enregistrement...' : 'Confirmer la sortie groupée' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      min-width: 800px;
      overflow-x: hidden !important;
    }
    .text-red-600 { color: #dc2626; }
    .bg-gray-50 { background-color: #f9fafb; }
    .border-gray-200 { border-color: #e5e7eb; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    .mat-column-designation { width: 75%; padding-right: 32px; }
    .mat-column-quantite { width: 25%; }
  `]
})
export class BulkStockOutDialogComponent implements OnInit {
  globalForm: FormGroup;
  quantitiesForm: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<BulkStockOutDialogComponent>,
    private productService: ProductService,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: { products: Product[] }
  ) {
    this.globalForm = this.fb.group({
      typeSortie: ['AJUSTEMENT', Validators.required],
      motif: ['', Validators.required]
    });

    this.quantitiesForm = this.fb.group({
      items: this.fb.array(this.data.products.map(p => this.fb.group({
        quantite: [1, [Validators.required, Validators.min(1), Validators.max(p.quantiteActuelle)]]
      })))
    });
  }

  ngOnInit(): void { }

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
    if (this.globalForm.invalid || this.quantitiesForm.invalid) return;

    this.loading = true;
    const { typeSortie, motif } = this.globalForm.value;
    const finalMotif = `[SORTIE_GROUPEE][${typeSortie}] ${motif}`;

    const requests = this.data.products.map((p, i) => {
      const qty = this.getQuantityGroup(i).get('quantite')?.value;
      return this.productService.destock(p.id!, qty, finalMotif);
    });

    forkJoin(requests).subscribe({
      next: () => {
        this.snackBar.open('Sortie groupée effectuée avec succès', 'OK', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: (err) => {
        console.error('Erreur lors de la sortie groupée:', err);
        this.snackBar.open('Erreur lors de la sortie groupée', 'Fermer', { duration: 5000 });
        this.loading = false;
      }
    });
  }
}
