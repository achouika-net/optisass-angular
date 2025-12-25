import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';

import { Supplier, SupplierInvoice, Echeance } from '../../models/finance.models';
import { FinanceService } from '../../services/finance.service';

@Component({
    selector: 'app-invoice-form-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatIconModule,
        MatDividerModule,
        MatTooltipModule
    ],
    templateUrl: './invoice-form-dialog.component.html',
    styles: [`
    .full-width { width: 100%; }
    .row { display: flex; gap: 16px; margin-bottom: 8px; }
    .col { flex: 1; }
    .echeance-row { 
      background: #f9f9f9; 
      padding: 12px; 
      border-radius: 4px; 
      margin-bottom: 12px;
      border-left: 4px solid #3f51b5;
    }
    .delete-btn { color: #f44336; }
    .sum-footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 20px;
        padding: 10px;
        font-weight: bold;
    }
    .diff-error { color: #f44336; font-size: 12px; }
  `]
})
export class InvoiceFormDialogComponent implements OnInit {
    form: FormGroup;
    isEditMode: boolean;
    suppliers: Supplier[] = [];

    invoiceTypes = ['ACHAT_STOCK', 'FRAIS_GENERAUX', 'IMMOBILISATION', 'AUTRE'];
    invoiceStatus = ['EN_ATTENTE', 'VALIDEE', 'PARTIELLE', 'PAYEE', 'ANNULEE'];
    paymentMethods = ['ESPECES', 'CHEQUE', 'LCN', 'VIREMENT'];
    echeanceStatus = ['EN_ATTENTE', 'DEPOSE', 'ENCAISSE', 'REJETE', 'ANNULE'];

    constructor(
        private fb: FormBuilder,
        private financeService: FinanceService,
        private dialogRef: MatDialogRef<InvoiceFormDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { invoice?: SupplierInvoice }
    ) {
        this.isEditMode = !!data.invoice;
        this.form = this.fb.group({
            fournisseurId: [data.invoice?.fournisseurId || '', Validators.required],
            numeroFacture: [data.invoice?.numeroFacture || '', Validators.required],
            dateEmission: [data.invoice?.dateEmission || new Date(), Validators.required],
            dateEcheance: [data.invoice?.dateEcheance || null],
            montantHT: [data.invoice?.montantHT || 0, [Validators.required, Validators.min(0)]],
            montantTVA: [data.invoice?.montantTVA || 0, [Validators.required, Validators.min(0)]],
            montantTTC: [data.invoice?.montantTTC || 0, [Validators.required, Validators.min(0)]],
            statut: [data.invoice?.statut || 'EN_ATTENTE', Validators.required],
            type: [data.invoice?.type || 'ACHAT_STOCK', Validators.required],
            pieceJointeUrl: [data.invoice?.pieceJointeUrl || ''],
            echeances: this.fb.array([])
        });

        if (data.invoice?.echeances) {
            data.invoice.echeances.forEach(e => this.addEcheance(e));
        }
    }

    ngOnInit() {
        this.loadSuppliers();

        // Auto-calculate TTC when HT or TVA changes
        this.form.get('montantHT')?.valueChanges.subscribe(() => this.calculateTTC());
        this.form.get('montantTVA')?.valueChanges.subscribe(() => this.calculateTTC());
    }

    get echeances() {
        return this.form.get('echeances') as FormArray;
    }

    loadSuppliers() {
        this.financeService.getSuppliers().subscribe({
            next: (data) => this.suppliers = data,
            error: (err) => console.error('Erreur chargement fournisseurs', err)
        });
    }

    calculateTTC() {
        const ht = this.form.get('montantHT')?.value || 0;
        const tva = this.form.get('montantTVA')?.value || 0;
        this.form.patchValue({ montantTTC: ht + tva }, { emitEvent: false });
    }

    addEcheance(echeance?: Echeance) {
        const group = this.fb.group({
            type: [echeance?.type || 'CHEQUE', Validators.required],
            dateEcheance: [echeance?.dateEcheance || new Date(), Validators.required],
            montant: [echeance?.montant || 0, [Validators.required, Validators.min(0)]],
            reference: [echeance?.reference || ''],
            statut: [echeance?.statut || 'EN_ATTENTE', Validators.required],
            banque: [echeance?.banque || '']
        });
        this.echeances.push(group);
    }

    removeEcheance(index: number) {
        this.echeances.removeAt(index);
    }

    get totalEcheances(): number {
        return this.echeances.controls.reduce((acc, ctrl) => acc + (ctrl.get('montant')?.value || 0), 0);
    }

    get diffTTC(): number {
        return (this.form.get('montantTTC')?.value || 0) - this.totalEcheances;
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
