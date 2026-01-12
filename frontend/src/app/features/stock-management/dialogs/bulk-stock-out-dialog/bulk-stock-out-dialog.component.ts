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
    <div class="dialog-container">
      <div class="dialog-header bg-gradient-to-br from-red-700 to-rose-500">
        <div class="header-content">
          <mat-icon class="header-icon">remove_shopping_cart</mat-icon>
          <div>
            <h2 class="dialog-title text-white m-0">Sortie de stock groupée</h2>
            <p class="dialog-subtitle text-rose-100 m-0">{{ data.products.length }} produits sélectionnés pour retrait</p>
          </div>
        </div>
        <button mat-icon-button (click)="onCancel()" class="text-white">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      
      <mat-dialog-content class="custom-content">
        <!-- Reason Selection -->
        <div class="reason-card animate-in fade-in slide-in-from-top-4 duration-500">
          <div class="card-header-accent border-l-4 border-l-red-500">
            <mat-icon class="text-red-500">info_outline</mat-icon>
            <span>Informations de sortie</span>
          </div>
          
          <form [formGroup]="globalForm" class="grid grid-cols-1 md:grid-cols-2 gap-6 p-5">
            <mat-form-field appearance="outline" class="w-full premium-field">
              <mat-label>Type de sortie</mat-label>
              <mat-select formControlName="typeSortie">
                <mat-option value="AJUSTEMENT">
                  <div class="flex items-center gap-2">
                    <mat-icon class="scale-75 text-gray-400">inventory</mat-icon>
                    <span>Ajustement d'inventaire</span>
                  </div>
                </mat-option>
                <mat-option value="CASSE">
                  <div class="flex items-center gap-2">
                    <mat-icon class="scale-75 text-red-400">broken_image</mat-icon>
                    <span>Casse / Produit défectueux</span>
                  </div>
                </mat-option>
                <mat-option value="RETOUR_FOURNISSEUR">
                  <div class="flex items-center gap-2">
                    <mat-icon class="scale-75 text-blue-400">undo</mat-icon>
                    <span>Retour fournisseur</span>
                  </div>
                </mat-option>
                <mat-option value="AUTRE">
                  <div class="flex items-center gap-2">
                    <mat-icon class="scale-75 text-gray-400">help_outline</mat-icon>
                    <span>Autre motif</span>
                  </div>
                </mat-option>
              </mat-select>
              <mat-error *ngIf="globalForm.get('typeSortie')?.hasError('required')">Requis</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="w-full premium-field">
              <mat-label>Motif / Justification</mat-label>
              <input matInput formControlName="motif" placeholder="Ex: Inventaire annuel...">
              <mat-icon matSuffix class="text-gray-400">edit_note</mat-icon>
              <mat-error *ngIf="globalForm.get('motif')?.hasError('required')">Requis</mat-error>
            </mat-form-field>
          </form>
        </div>

        <div class="table-container shadow-sm border rounded-xl overflow-hidden mt-6">
          <table mat-table [dataSource]="data.products" class="w-full">
            <ng-container matColumnDef="designation">
              <th mat-header-cell *matHeaderCellDef class="bg-slate-800 text-white font-bold uppercase text-[11px] tracking-wider py-4"> Produit </th>
              <td mat-cell *matCellDef="let p" class="py-3"> 
                <div class="flex flex-col">
                    <span class="font-bold text-slate-800">{{ p.designation }}</span>
                    <div class="flex items-center gap-2 mt-1">
                      <span class="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded font-mono">{{ p.codeInterne }}</span>
                      <span class="text-[10px] text-gray-500 italic">Position: {{ p.entrepot?.nom || 'Non spécifié' }} (Stock: {{ p.quantiteActuelle }})</span>
                    </div>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="quantite">
              <th mat-header-cell *matHeaderCellDef class="bg-slate-800 text-white font-bold uppercase text-[11px] tracking-wider text-center py-4"> Quantité à retirer </th>
              <td mat-cell *matCellDef="let p; let i = index" class="text-center py-3">
                <mat-form-field appearance="outline" class="w-32 compact-field" [formGroup]="getQuantityGroup(i)">
                  <input matInput type="number" formControlName="quantite" (change)="validateQuantity(i, p)" class="text-center font-bold">
                  <mat-error *ngIf="getQuantityGroup(i).get('quantite')?.hasError('max')" class="text-[10px]">
                    Max {{ p.quantiteActuelle }}
                  </mat-error>
                </mat-form-field>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="['designation', 'quantite']"></tr>
            <tr mat-row *matRowDef="let row; columns: ['designation', 'quantite'];" class="hover:bg-red-50/30 transition-colors"></tr>
          </table>
        </div>

      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions p-6 border-t bg-gray-50/50">
        <button mat-button (click)="onCancel()" class="px-6 h-11 text-gray-600 font-medium hover:bg-gray-100 transition-all mr-2">
          ANNULER
        </button>
        <button mat-raised-button color="warn" 
                class="px-8 h-11 font-bold text-sm tracking-wide shadow-lg shadow-red-200"
                [disabled]="globalForm.invalid || isQuantitiesInvalid() || loading" 
                (click)="onConfirm()">
          <mat-icon class="mr-2" *ngIf="!loading">remove_circle_outline</mat-icon>
          <mat-icon class="mr-2 animate-spin" *ngIf="loading">sync</mat-icon>
          {{ loading ? 'ENREGISTREMENT...' : 'CONFIRMER LA SORTIE' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      overflow: hidden;
    }
    .dialog-header {
      background: linear-gradient(135deg, #be123c 0%, #fb7185 100%);
      padding: 1.5rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }
    .header-content {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .header-icon {
      font-size: 2.5rem;
      width: 2.5rem;
      height: 2.5rem;
      color: rgba(255, 255, 255, 0.9);
    }
    .dialog-title {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.025em;
    }
    .custom-content {
      padding: 1.5rem !important;
      width: 100%;
      max-width: 100%;
      overflow-x: hidden !important;
    }
    .reason-card {
      background: white;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
      overflow: hidden;
    }
    .card-header-accent {
      background: #f8fafc;
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
    }
    .premium-field {
      ::ng-deep .mdc-text-field--outlined {
        background-color: #ffffff;
        transition: all 0.2s;
      }
      ::ng-deep .mdc-notched-outline__leading,
      ::ng-deep .mdc-notched-outline__notch,
      ::ng-deep .mdc-notched-outline__trailing {
        border-color: #e2e8f0 !important;
      }
      &:hover ::ng-deep .mdc-notched-outline__leading,
      &:hover ::ng-deep .mdc-notched-outline__notch,
      &:hover ::ng-deep .mdc-notched-outline__trailing {
        border-color: #f43f5e !important;
      }
    }
    .table-container {
      background: white;
    }
    ::ng-deep .compact-field {
      .mdc-text-field--outlined {
        height: 48px !important;
      }
      .mat-mdc-form-field-infix {
        padding-top: 12px !important;
        padding-bottom: 12px !important;
      }
      .mat-mdc-form-field-subscript-wrapper {
        font-size: 9px;
      }
    }
    .dialog-actions {
      border-top: 1px solid #f1f5f9;
    }
    @media (max-width: 900px) {
      .custom-content {
        min-width: 100%;
        padding: 1rem !important;
      }
    }
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
