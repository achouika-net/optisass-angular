import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { SupplierService } from '../../../../shared/services/supplier.service';

@Component({
  selector: 'app-add-verre-supplier-dialog',
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
  ],
  template: `
    <h2 mat-dialog-title>{{ data.mode === 'edit' ? 'Modifier le verre fournisseur' : 'Associer un fournisseur' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="flex flex-col gap-4 py-2">
        <mat-form-field appearance="outline" class="w-full" *ngIf="data.mode !== 'edit'">
          <mat-label>Fournisseur</mat-label>
          <mat-select formControlName="fournisseurId">
            <mat-option *ngFor="let s of suppliers" [value]="s.id">
              {{ s.name }} {{ s.margeDefaut ? '(' + s.margeDefaut + '% marge)' : '' }}
            </mat-option>
          </mat-select>
          <mat-error *ngIf="form.get('fournisseurId')?.hasError('required')">Le fournisseur est requis</mat-error>
        </mat-form-field>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Épaisseur (mm)</mat-label>
            <input matInput type="number" step="0.1" formControlName="epaisseur" placeholder="ex: 1.8">
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Référence Fournisseur</mat-label>
            <input matInput type="text" formControlName="reference" placeholder="ex: ESS-150-AR">
          </mat-form-field>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Prix d'achat (MAD)</mat-label>
            <input matInput type="number" formControlName="prixAchat" placeholder="0">
            <mat-error *ngIf="form.get('prixAchat')?.hasError('required')">Le prix d'achat est requis</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Prix de vente conseillé (MAD - Optionnel)</mat-label>
            <input matInput type="number" formControlName="prixVente" [placeholder]="computedPrice || 'Calculé auto'">
            <mat-hint *ngIf="!form.get('prixVente')?.value && computedPrice">
              Prix conseillé basé sur la marge du fournisseur
            </mat-hint>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Notes / Observations</mat-label>
          <textarea matInput formControlName="notes" placeholder="Notes particulières..."></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Annuler</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid" (click)="save()">Enregistrer</button>
    </mat-dialog-actions>
  `
})
export class AddVerreSupplierDialogComponent implements OnInit {
  form: FormGroup;
  suppliers: any[] = [];
  computedPrice = '';

  constructor(
    private fb: FormBuilder,
    private supplierService: SupplierService,
    public dialogRef: MatDialogRef<AddVerreSupplierDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { mode: 'create' | 'edit'; item?: any; glassIndexId?: string }
  ) {
    this.form = this.fb.group({
      fournisseurId: [{ value: data.item?.fournisseurId || '', disabled: data.mode === 'edit' }, Validators.required],
      epaisseur: [data.item?.epaisseur || null],
      prixAchat: [data.item?.prixAchat || 0, [Validators.required, Validators.min(0)]],
      prixVente: [data.item?.prixVente || null],
      reference: [data.item?.reference || ''],
      notes: [data.item?.notes || ''],
    });
  }

  ngOnInit() {
    this.supplierService.getActiveSuppliers().subscribe(list => {
      this.suppliers = list;
      this.recalculatePrice();
    });

    this.form.get('prixAchat')?.valueChanges.subscribe(() => this.recalculatePrice());
    this.form.get('fournisseurId')?.valueChanges.subscribe(() => this.recalculatePrice());
  }

  recalculatePrice() {
    const pAchat = this.form.get('prixAchat')?.value;
    const fId = this.form.get('fournisseurId')?.value;
    if (pAchat !== null && pAchat !== undefined && fId) {
      const supplier = this.suppliers.find(s => s.id === fId);
      if (supplier?.margeDefaut && supplier.margeDefaut > 0 && supplier.margeDefaut < 100) {
        const val = Math.round(pAchat / (1 - supplier.margeDefaut / 100));
        this.computedPrice = `${val} MAD`;
      } else {
        this.computedPrice = '';
      }
    } else {
      this.computedPrice = '';
    }
  }

  save() {
    if (this.form.valid) {
      const val = this.form.getRawValue();
      this.dialogRef.close({
        ...val,
        glassIndexId: this.data.glassIndexId
      });
    }
  }
}
