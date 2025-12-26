import { Component, Inject, OnInit, NgZone, Optional } from '@angular/core';
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
import { MatStepperModule } from '@angular/material/stepper';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';
import { Supplier, SupplierInvoice, Echeance } from '../../models/finance.models';
import { FinanceService } from '../../services/finance.service';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

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
        MatTooltipModule,
        MatStepperModule,
        MatCardModule,
        MatAutocompleteModule,
        MatProgressBarModule
    ],
    templateUrl: './invoice-form-dialog.component.html',
    styles: [`
    .full-width { width: 100%; }
    .row { display: flex; gap: 16px; margin-bottom: 8px; flex-wrap: wrap; }
    .col { flex: 1; min-width: 200px; }
    .echeance-row { 
      background: #f9f9f9; 
      padding: 12px; 
      border-radius: 8px; 
      margin-bottom: 12px;
      border-left: 4px solid #3f51b5;
      position: relative;
    }
    .delete-btn { position: absolute; top: 10px; right: 10px; }
    .sum-footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 20px;
        padding: 20px;
        font-weight: bold;
        background: #f5f5f5;
        border-radius: 8px;
    }
    .diff-error { color: #f44336; font-size: 14px; }
    .stepper-container { height: 100%; display: flex; flex-direction: column; }
    .step-content { padding: 20px; overflow-y: auto; flex: 1; }
    
    /* View Mode Overrides for Visibility */
    ::ng-deep .mat-mdc-text-field-wrapper.mdc-text-field--disabled .mdc-text-field__input {
        color: rgba(0, 0, 0, 0.87) !important;
        -webkit-text-fill-color: rgba(0, 0, 0, 0.87) !important;
    }
    ::ng-deep .mat-mdc-text-field-wrapper.mdc-text-field--disabled .mat-mdc-select-value-text {
        color: rgba(0, 0, 0, 0.87) !important;
        -webkit-text-fill-color: rgba(0, 0, 0, 0.87) !important;
    }
    ::ng-deep .mat-mdc-text-field-wrapper.mdc-text-field--disabled .mdc-floating-label {
        color: rgba(0, 0, 0, 0.6) !important;
    }
  `]
})
export class InvoiceFormDialogComponent implements OnInit {
    form: FormGroup;
    isEditMode: boolean;
    isViewMode: boolean = false;
    submitting = false;
    suppliers: Supplier[] = [];
    selectedSupplier: Supplier | null = null;
    currentCentre = this.store.selectSignal(UserCurrentCentreSelector);
    currentMonth = new Date().getMonth() + 1;

    invoiceTypes = ['ACHAT_STOCK', 'FRAIS_GENERAUX', 'IMMOBILISATION', 'AUTRE'];
    filteredTypes!: Observable<string[]>;
    invoiceStatus = ['EN_ATTENTE', 'VALIDEE', 'PARTIELLE', 'PAYEE', 'ANNULEE'];
    paymentMethods = ['ESPECES', 'CHEQUE', 'LCN', 'VIREMENT', 'CARTE'];
    echeanceStatus = ['EN_ATTENTE', 'DEPOSE', 'ENCAISSE', 'REJETE', 'ANNULE'];

    constructor(
        private fb: FormBuilder,
        private financeService: FinanceService,
        private route: ActivatedRoute,
        private router: Router,
        private zone: NgZone,
        private store: Store,
        @Optional() public dialogRef: MatDialogRef<InvoiceFormDialogComponent>,
        @Optional() @Inject(MAT_DIALOG_DATA) public data: { invoice?: SupplierInvoice }
    ) {
        this.isEditMode = !!(data?.invoice);
        this.form = this.fb.group({
            details: this.fb.group({
                fournisseurId: [data?.invoice?.fournisseurId || '', Validators.required],
                centreId: [data?.invoice?.centreId || this.currentCentre()?.id || '', Validators.required],
                numeroFacture: [data?.invoice?.numeroFacture || '', Validators.required],
                dateEmission: [data?.invoice?.dateEmission || new Date(), Validators.required],
                dateEcheance: [data?.invoice?.dateEcheance || null],
                montantHT: [data?.invoice?.montantHT || 0, [Validators.required, Validators.min(0)]],
                tauxTVA: [20], // Default 20%
                montantTVA: [data?.invoice?.montantTVA || 0, [Validators.required, Validators.min(0)]],
                montantTTC: [data?.invoice?.montantTTC || 0, [Validators.required, Validators.min(0)]],
                type: [data?.invoice?.type || 'ACHAT_STOCK', Validators.required],
                pieceJointeUrl: [data?.invoice?.pieceJointeUrl || ''],
            }),
            payment: this.fb.group({
                echeances: this.fb.array([]),
                statut: [data?.invoice?.statut || 'EN_ATTENTE', Validators.required]
            })
        });

        if (data?.invoice?.echeances) {
            data.invoice.echeances.forEach(e => this.addEcheance(e));
        }
    }

    ngOnInit() {
        this.loadSuppliers();

        // Check if opened as dialog with viewMode in data
        if ((this.data?.invoice as any)?.viewMode) {
            this.isViewMode = true;
            this.form.disable();
        }

        this.route.queryParams.subscribe(params => {
            if (params['viewMode'] === 'true') {
                this.isViewMode = true;
                this.form.disable();
            }
        });

        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.isEditMode = true;
            this.financeService.getInvoice(id).subscribe(invoice => {
                this.form.patchValue({
                    details: {
                        fournisseurId: invoice.fournisseurId,
                        numeroFacture: invoice.numeroFacture,
                        dateEmission: invoice.dateEmission,
                        dateEcheance: invoice.dateEcheance,
                        montantHT: invoice.montantHT,
                        montantTVA: invoice.montantTVA,
                        montantTTC: invoice.montantTTC,
                        type: invoice.type,
                        pieceJointeUrl: invoice.pieceJointeUrl
                    },
                    payment: {
                        statut: invoice.statut
                    }
                });
                this.echeances.clear();
                invoice.echeances?.forEach(e => this.addEcheance(e));

                this.autoUpdateStatus();

                if (this.isViewMode) {
                    this.form.disable();
                }
            });
        }

        // Auto-calculate TVA and TTC / HT
        this.detailsGroup.get('montantHT')?.valueChanges.subscribe(() => {
            if (this.detailsGroup.get('montantHT')?.dirty) {
                this.calculateFromHT();
            }
        });
        this.detailsGroup.get('tauxTVA')?.valueChanges.subscribe(() => {
            if (this.detailsGroup.get('tauxTVA')?.dirty) {
                this.calculateFromHT();
            }
        });
        this.detailsGroup.get('montantTTC')?.valueChanges.subscribe(() => {
            if (this.detailsGroup.get('montantTTC')?.dirty) {
                this.calculateFromTTC();
            }
        });

        // Listen for supplier changes
        this.detailsGroup.get('fournisseurId')?.valueChanges.subscribe(id => {
            this.onSupplierChange(id);
        });

        // Auto-update status when echeances or amounts change
        this.echeances.valueChanges.subscribe(() => this.autoUpdateStatus());
        this.detailsGroup.get('montantTTC')?.valueChanges.subscribe(() => this.autoUpdateStatus());

        this.filteredTypes = this.detailsGroup.get('type')!.valueChanges.pipe(
            startWith(''),
            map(value => this._filterTypes(value || ''))
        );
    }

    private _filterTypes(value: string): string[] {
        const filterValue = value.toLowerCase();
        return this.invoiceTypes.filter(option => option.toLowerCase().includes(filterValue));
    }

    get detailsGroup() {
        return this.form.get('details') as FormGroup;
    }

    get paymentGroup() {
        return this.form.get('payment') as FormGroup;
    }

    get echeances() {
        return this.paymentGroup.get('echeances') as FormArray;
    }

    loadSuppliers() {
        this.financeService.getSuppliers().subscribe({
            next: (data) => {
                this.suppliers = data;
                if (this.form.get('fournisseurId')?.value) {
                    this.onSupplierChange(this.form.get('fournisseurId')?.value);
                }
            },
            error: (err) => console.error('Erreur chargement fournisseurs', err)
        });
    }

    onSupplierChange(id: string) {
        this.selectedSupplier = this.suppliers.find(s => s.id === id) || null;

        // Auto-schedule payment terms if available and creating new invoice
        if (this.selectedSupplier && this.echeances.length === 0 && !this.isEditMode) {
            const conditions = this.selectedSupplier.conditionsPaiement;

            if (conditions === 'Comptant' || conditions === 'Espèces') {
                this.addEcheance({
                    type: 'ESPECES',
                    dateEcheance: new Date().toISOString(),
                    statut: 'EN_ATTENTE',
                    montant: 0 // Will clearly indicate need to fill
                });
            } else if (conditions?.includes('30 jours')) {
                const date = new Date();
                date.setDate(date.getDate() + 30);
                this.addEcheance({
                    type: 'CHEQUE',
                    dateEcheance: date.toISOString(),
                    statut: 'EN_ATTENTE',
                    montant: 0
                });
            } else if (conditions?.includes('60 jours')) {
                const date = new Date();
                date.setDate(date.getDate() + 60);
                this.addEcheance({
                    type: 'LCN',
                    dateEcheance: date.toISOString(),
                    statut: 'EN_ATTENTE',
                    montant: 0
                });
            } else if (conditions?.includes('Fin de mois')) {
                const date = new Date();
                // Last day of current month
                date.setMonth(date.getMonth() + 1);
                date.setDate(0);
                this.addEcheance({
                    type: 'VIREMENT',
                    dateEcheance: date.toISOString(),
                    statut: 'EN_ATTENTE',
                    montant: 0
                });
            }
        }
    }

    autoUpdateStatus() {
        const totalTTC = this.detailsGroup.get('montantTTC')?.value || 0;
        const echeances = this.echeances.value as any[];

        if (!echeances || echeances.length === 0) {
            this.paymentGroup.get('statut')?.setValue('EN_ATTENTE', { emitEvent: false });
            return;
        }

        const activeEcheances = echeances.filter(e => e.statut !== 'ANNULE');
        if (activeEcheances.length === 0) {
            this.paymentGroup.get('statut')?.setValue('EN_ATTENTE', { emitEvent: false });
            return;
        }

        const totalPaid = activeEcheances
            .filter(e => e.statut === 'ENCAISSE')
            .reduce((sum, e) => sum + (e.montant || 0), 0);

        if (totalPaid >= totalTTC && totalTTC > 0) {
            this.paymentGroup.get('statut')?.setValue('PAYEE', { emitEvent: false });
        } else {
            this.paymentGroup.get('statut')?.setValue('PARTIELLE', { emitEvent: false });
        }
    }

    calculateFromHT() {
        const ht = this.detailsGroup.get('montantHT')?.value || 0;
        const taux = this.detailsGroup.get('tauxTVA')?.value || 0;
        const tva = Math.round(ht * (taux / 100) * 100) / 100;
        const ttc = Math.round((ht + tva) * 100) / 100;

        this.detailsGroup.patchValue({
            montantTVA: tva,
            montantTTC: ttc
        }, { emitEvent: false });
    }

    calculateFromTTC() {
        const ttc = this.detailsGroup.get('montantTTC')?.value || 0;
        const taux = this.detailsGroup.get('tauxTVA')?.value || 0;
        const ht = Math.round((ttc / (1 + taux / 100)) * 100) / 100;
        const tva = Math.round((ttc - ht) * 100) / 100;

        this.detailsGroup.patchValue({
            montantHT: ht,
            montantTVA: tva
        }, { emitEvent: false });
    }

    addEcheance(echeance?: Echeance) {
        const remainingAmount = this.diffTTC > 0 ? this.diffTTC : 0;
        const group = this.fb.group({
            type: [echeance?.type || 'CHEQUE', Validators.required],
            dateEcheance: [echeance?.dateEcheance || new Date(), Validators.required],
            montant: [echeance?.montant || remainingAmount, [Validators.required, Validators.min(0)]],
            reference: [echeance?.reference || ''],
            statut: [echeance?.statut || 'EN_ATTENTE', Validators.required],
            banque: [echeance?.banque || (this.selectedSupplier?.banque || ''), Validators.required]
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
        return (this.detailsGroup.get('montantTTC')?.value || 0) - this.totalEcheances;
    }

    onSubmit() {
        if (this.form.valid) {
            this.submitting = true;
            const detailsData = this.detailsGroup.value;
            const paymentData = this.paymentGroup.value;

            const invoiceData = {
                ...detailsData,
                ...paymentData
            };

            delete invoiceData.tauxTVA; // Frontend only helper

            if (this.isEditMode) {
                const id = this.route.snapshot.paramMap.get('id') || this.data?.invoice?.id;
                if (id) {
                    this.financeService.updateInvoice(id, invoiceData).subscribe({
                        next: () => this.finalize(invoiceData),
                        error: () => this.submitting = false
                    });
                } else {
                    this.finalize(invoiceData);
                }
            } else {
                this.financeService.createInvoice(invoiceData).subscribe({
                    next: res => this.finalize(res),
                    error: () => this.submitting = false
                });
            }
        } else {
            this.form.markAllAsTouched();
        }
    }

    private finalize(result: any) {
        this.zone.run(() => {
            this.submitting = false;
            if (this.dialogRef) {
                this.dialogRef.close(result);
            } else {
                this.router.navigate(['/p/finance/payments']);
            }
        });
    }

    onCancel() {
        if (this.dialogRef) {
            this.dialogRef.close();
        } else {
            this.router.navigate(['/p/finance/payments']);
        }
    }
}
