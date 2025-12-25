import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';

import { Supplier } from '../../models/finance.models';

@Component({
    selector: 'app-supplier-form-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatTabsModule
    ],
    templateUrl: './supplier-form-dialog.component.html',
    styles: [`
    .full-width { width: 100%; }
    .row { display: flex; gap: 16px; margin-bottom: 8px; }
    .col { flex: 1; }
  `]
})
export class SupplierFormDialogComponent {
    form: FormGroup;
    isEditMode: boolean;

    constructor(
        private fb: FormBuilder,
        private dialogRef: MatDialogRef<SupplierFormDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { supplier?: Supplier }
    ) {
        this.isEditMode = !!data.supplier;
        this.form = this.fb.group({
            nom: [data.supplier?.nom || '', Validators.required],
            contact: [data.supplier?.contact || ''],
            email: [data.supplier?.email || '', [Validators.email]],
            telephone: [data.supplier?.telephone || ''],
            siteWeb: [data.supplier?.siteWeb || ''],

            adresse: [data.supplier?.adresse || ''],
            ville: [data.supplier?.ville || ''],

            ice: [data.supplier?.ice || ''],
            rc: [data.supplier?.rc || ''],
            identifiantFiscal: [data.supplier?.identifiantFiscal || ''],
            patente: [data.supplier?.patente || ''], // Manquant dans l'interface TS, je vais l'ajouter si besoin ou l'ignorer
            cnss: [data.supplier?.cnss || ''],

            rib: [data.supplier?.rib || ''],
            banque: [data.supplier?.banque || ''],
            conditionsPaiement: [data.supplier?.conditionsPaiement || '']
        });
    }

    onSubmit() {
        if (this.form.valid) {
            this.dialogRef.close(this.form.value);
        }
    }

    onCancel() {
        this.dialogRef.close();
    }
}
