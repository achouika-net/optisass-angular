import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { Entrepot } from '../../../../shared/interfaces/warehouse.interface';
import { WarehousesService } from '../../../warehouses/services/warehouses.service';
import { StagedProduct } from '../../pages/stock-entry-v2/stock-entry-v2.component';

export interface AlimentationResult {
  warehouseId: string;
  products: StagedProduct[];
}

@Component({
  selector: 'app-stock-alimentation-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>Alimentation du Stock</h2>
    <mat-dialog-content class="w-[800px] max-h-[80vh] flex flex-col gap-4">
      
      <!-- Warehouse Selection -->
      <form [formGroup]="form" class="flex flex-col gap-4 pt-2">
        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Entrepôt de destination</mat-label>
          <mat-select formControlName="warehouseId">
             <mat-option *ngFor="let w of warehouses$ | async" [value]="w.id">
                {{ w.nom }}
             </mat-option>
          </mat-select>
          <mat-error *ngIf="form.get('warehouseId')?.hasError('required')">
            L'entrepôt est obligatoire
          </mat-error>
        </mat-form-field>
      </form>

      <!-- Products Financial Review Table -->
      <div class="overflow-auto border rounded-lg max-h-[400px]">
        <table mat-table [dataSource]="productsSource" class="w-full">
          
          <!-- Name Column -->
          <ng-container matColumnDef="nom">
            <th mat-header-cell *matHeaderCellDef> Produit </th>
            <td mat-cell *matCellDef="let element"> 
                <div class="flex flex-col">
                    <span class="font-medium">{{element.original.nom}}</span>
                    <span class="text-xs text-gray-500">{{element.original.reference}}</span>
                </div>
            </td>
          </ng-container>

          <!-- Qty Column -->
          <ng-container matColumnDef="quantite">
            <th mat-header-cell *matHeaderCellDef> Qte </th>
            <td mat-cell *matCellDef="let element"> {{element.original.quantite}} </td>
          </ng-container>

          <!-- Purchase Price Column (Editable) -->
           <ng-container matColumnDef="prixAchat">
            <th mat-header-cell *matHeaderCellDef> P.Achat HT </th>
            <td mat-cell *matCellDef="let element; let i = index">
                <mat-form-field appearance="outline" class="w-24 compact-form-field">
                    <input matInput type="number" [formControl]="getControl(i, 'prixAchat')" min="0">
                </mat-form-field>
            </td>
          </ng-container>

          <!-- VAT Column (Editable Multi-choice) -->
          <ng-container matColumnDef="tva">
            <th mat-header-cell *matHeaderCellDef> TVA </th>
            <td mat-cell *matCellDef="let element; let i = index">
                <mat-form-field appearance="outline" class="w-24 compact-form-field">
                    <mat-select [formControl]="getControl(i, 'tva')">
                        <mat-option [value]="0">0%</mat-option>
                        <mat-option [value]="7">7%</mat-option>
                        <mat-option [value]="10">10%</mat-option>
                        <mat-option [value]="20">20%</mat-option>
                    </mat-select>
                </mat-form-field>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns; sticky: true"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      </div>

    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Annuler</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid || productsFormArray.invalid" (click)="confirm()">
        Valider l'Alimentation
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .compact-form-field .mat-mdc-form-field-wrapper {
        padding-bottom: 0;
    }
    .compact-form-field .mat-mdc-form-field-infix {
        padding-top: 4px;
        padding-bottom: 4px;
        min-height: 32px;
    }
  `]
})
export class StockAlimentationDialogComponent implements OnInit {
  form: FormGroup;
  productsFormArray: FormArray;

  warehouses$: Observable<Entrepot[]>;
  productsSource: any[] = []; // Wrapper for template

  displayedColumns = ['nom', 'quantite', 'prixAchat', 'tva'];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<StockAlimentationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { products: StagedProduct[] },
    private warehousesService: WarehousesService
  ) {
    this.productsFormArray = this.fb.array([]);
    this.form = this.fb.group({
      warehouseId: ['', Validators.required],
      items: this.productsFormArray
    });

    this.warehouses$ = this.warehousesService.findAll();
  }

  ngOnInit() {
    // Initialize Form Array from passed products
    this.data.products.forEach(p => {
      const group = this.fb.group({
        prixAchat: [p.prixAchat, [Validators.required, Validators.min(0)]],
        tva: [p.tva, Validators.required]
      });
      this.productsFormArray.push(group);
    });

    // Create a datasource that links the form controls to the original data for display
    this.productsSource = this.data.products.map((p, index) => ({
      original: p,
      index: index
    }));
  }

  getControl(index: number, controlName: string) {
    return this.productsFormArray.at(index).get(controlName) as any;
  }

  confirm() {
    if (this.form.valid) {
      // Merge form values back into products
      const updatedProducts = this.data.products.map((p, index) => {
        const formVal = this.productsFormArray.at(index).value;
        return {
          ...p,
          prixAchat: formVal.prixAchat,
          tva: formVal.tva
        };
      });

      const result: AlimentationResult = {
        warehouseId: this.form.get('warehouseId')?.value,
        products: updatedProducts
      };

      this.dialogRef.close(result);
    }
  }
}
