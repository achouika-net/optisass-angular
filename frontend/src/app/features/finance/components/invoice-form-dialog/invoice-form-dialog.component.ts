import { Component, Inject, OnInit, NgZone, Optional, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, FormControl } from '@angular/forms';
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
import { Observable, of } from 'rxjs';
import { map, startWith, switchMap } from 'rxjs/operators';
import { CeilingWarningDialogComponent } from '../ceiling-warning-dialog/ceiling-warning-dialog.component';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CameraCaptureDialogComponent } from '../../../../shared/components/camera-capture/camera-capture-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

interface AttachmentFile {
    name: string;
    type: string;
    size: number;
    preview: string | SafeResourceUrl;
    file: File;
    uploadDate: Date;
}

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
        MatProgressBarModule,
        MatSnackBarModule
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
    ::ng-deep .dense-field .mat-mdc-form-field-subscript-wrapper {
        display: none;
    }
    ::ng-deep .dense-field .mat-mdc-form-field-wrapper {
        padding-bottom: 0;
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

    invoiceTypes = [
        'ACHAT_VERRE_OPTIQUE', 'ACHAT_MONTURES_OPTIQUE', 'ACHAT_MONTURES_SOLAIRE',
        'ACHAT_LENTILLES', 'ACHAT_PRODUITS', 'COTISATION_AMO_CNSS',
        'ACHAT_STOCK', 'FRAIS_GENERAUX', 'IMMOBILISATION', 'AUTRE'
    ];
    filteredTypes!: Observable<string[]>;
    invoiceStatus = ['EN_ATTENTE', 'VALIDEE', 'PARTIELLE', 'PAYEE', 'ANNULEE'];
    paymentMethods = ['ESPECES', 'CHEQUE', 'LCN', 'VIREMENT', 'CARTE'];
    echeanceStatus = ['EN_ATTENTE', 'DEPOSE', 'ENCAISSE', 'REJETE', 'ANNULE'];

    // Supplier Autocomplete
    supplierCtrl = new FormControl('');
    filteredSuppliers!: Observable<Supplier[]>;

    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

    attachmentFiles: AttachmentFile[] = [];
    viewingFile: AttachmentFile | null = null;

    constructor(
        private fb: FormBuilder,
        private financeService: FinanceService,
        private route: ActivatedRoute,
        private router: Router,
        private zone: NgZone,
        private store: Store,
        private sanitizer: DomSanitizer,
        private cdr: ChangeDetectorRef,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
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
                tauxTVA: [
                    (data?.invoice?.montantTVA !== undefined && data?.invoice?.montantHT)
                        ? Math.round((data.invoice.montantTVA / data.invoice.montantHT) * 100)
                        : 20
                ],
                montantTVA: [data?.invoice?.montantTVA || 0, [Validators.required, Validators.min(0)]],
                montantTTC: [data?.invoice?.montantTTC || 0, [Validators.required, Validators.min(0)]],
                type: [data?.invoice?.type || (data as any)?.prefilledType || 'ACHAT_STOCK', Validators.required],
                pieceJointeUrl: [data?.invoice?.pieceJointeUrl || ''],
                clientId: [data?.invoice?.clientId || (data as any)?.prefilledClientId || ''],
            }),
            payment: this.fb.group({
                echeances: this.fb.array([]),
                statut: [data?.invoice?.statut || 'EN_ATTENTE']
            })
        });

        if (data?.invoice?.echeances) {
            data.invoice.echeances.forEach(e => this.addEcheance(e));
        }

        if (data?.invoice?.fournisseur) {
            this.supplierCtrl.setValue(data.invoice.fournisseur.nom);
            this.selectedSupplier = data.invoice.fournisseur;
        }
    }

    get isBLMode(): boolean {
        return (this.data as any)?.isBL || !!this.detailsGroup.get('clientId')?.value;
    }

    ngOnInit() {
        console.log('[InvoiceForm] VERSION CHECK: Aggressive Rounding & Sync Date Update ACTIVE');
        this.loadSuppliers();

        // Check if opened as dialog with viewMode in data
        if ((this.data?.invoice as any)?.viewMode) {
            this.isViewMode = true;
            this.form.disable();
            this.supplierCtrl.disable();
        }

        this.route.queryParams.subscribe(params => {
            if (params['viewMode'] === 'true') {
                this.isViewMode = true;
                this.form.disable();
                this.supplierCtrl.disable();
            }
        });

        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.isEditMode = true;
            this.financeService.getInvoice(id).subscribe(invoice => {
                // AGGRESSIVE ROUNDING
                const mHT = Math.round(Number(invoice.montantHT || 0) * 100) / 100;
                const mTVA = Math.round(Number(invoice.montantTVA || 0) * 100) / 100;
                const mTTC = Math.round(Number(invoice.montantTTC || 0) * 100) / 100;

                console.log('[InvoiceForm] Loaded Invoice:', { mHT, mTVA, mTTC });

                this.form.patchValue({
                    details: {
                        fournisseurId: invoice.fournisseurId,
                        numeroFacture: invoice.numeroFacture,
                        dateEmission: invoice.dateEmission,
                        dateEcheance: invoice.dateEcheance,
                        montantHT: mHT,
                        montantTVA: mTVA,
                        montantTTC: mTTC,
                        type: invoice.type,
                        pieceJointeUrl: invoice.pieceJointeUrl,
                        clientId: invoice.clientId
                    },
                    payment: {
                        statut: invoice.statut
                    }
                });
                this.echeances.clear();
                invoice.echeances?.forEach(e => this.addEcheance(e));

                // Force Auto-Apply if supplier exists and conditions look mismatched or it's a "draft" invoice
                // We do this inside loadSuppliers usually, but let's prep the data here
                if (invoice.fournisseur) {
                    this.supplierCtrl.setValue(invoice.fournisseur.nom);
                    this.selectedSupplier = invoice.fournisseur;
                }

                this.autoUpdateStatus();
                if (invoice.montantTTC > 0) this.calculateFromTTC();
            });
        }

        // Handle passed data invoice (not from URL ID but from @Inject)
        if (this.data?.invoice && !this.isEditMode) {
            // Logic for passed data is handled in constructor mostly, 
            // but we might need to trigger recalc here if it wasn't an edit mode fetch
            // Actually constructor handles it. 
            // But wait, constructor patches the form. 
            // If we want to enforce consistency for passed data too:
        }

        // Also check if we have data.invoice from constructor and we are in EditMode (but not ID fetch)
        // The constructor sets values. Let's trigger recalc for that case too if needed in ngAfterViewInit or here.
        if (this.data?.invoice && this.data.invoice.montantTTC > 0) {
            // We need to be careful not to overwrite if user actively changed something, 
            // but this is ngOnInit, so it's initial load.
            // However, calculateFromTTC reads from form control.
            // The form controls are already set in constructor.
            setTimeout(() => this.calculateFromTTC());
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
        this.detailsGroup.get('montantTTC')?.valueChanges.subscribe(() => {
            this.autoUpdateStatus();
            // Auto-redistribute amount across existing echeances
            this.redistributeAmountAcrossEcheances();
        });

        this.filteredTypes = this.detailsGroup.get('type')!.valueChanges.pipe(
            startWith(''),
            map(value => this._filterTypes(value || ''))
        );

        // SYNC: Update ID when selection changes in autocomplete
        this.supplierCtrl.valueChanges.subscribe(value => {
            if (typeof value === 'object' && value && 'id' in (value as any)) {
                this.detailsGroup.patchValue({ fournisseurId: (value as any).id }, { emitEvent: false });
                this.selectedSupplier = value as Supplier;
            } else if (!value) {
                this.detailsGroup.patchValue({ fournisseurId: null }, { emitEvent: false });
                this.selectedSupplier = null;
            }
        });

        // SYNC: Update text when ID changes (e.g. from patchValue or loading)
        this.detailsGroup.get('fournisseurId')?.valueChanges.subscribe(id => {
            if (id && this.suppliers.length > 0) {
                const s = this.suppliers.find(x => x.id === id);
                if (s && this.supplierCtrl.value !== s.nom) {
                    this.supplierCtrl.setValue(s.nom, { emitEvent: false });
                    this.selectedSupplier = s;
                }
            } else if (!id) {
                this.supplierCtrl.setValue('', { emitEvent: false });
                this.selectedSupplier = null;
            }
        });
    }

    loadSuppliers() {
        this.financeService.getSuppliers().subscribe({
            next: (data) => {
                this.suppliers = data;
                this.setupSupplierFilter();

                // If editing and has provider, ensure we have the full object
                const currentId = this.detailsGroup.get('fournisseurId')?.value;
                if (currentId) {
                    const s = this.suppliers.find(x => x.id === currentId);
                    if (s) {
                        this.selectedSupplier = s;
                        this.supplierCtrl.setValue(s.nom, { emitEvent: false });

                        // AGGRESSIVE AUTO-APPLY
                        // Only auto-apply if we have no installments or just one default one
                        // and we are NOT in view mode.
                        if (this.echeances.length <= 1 && !this.isViewMode) {
                            const conditions = (s.convention?.echeancePaiement?.[0] || s.conditionsPaiement || '').toLowerCase();

                            if (conditions) {
                                console.log('[InvoiceForm] Checking for auto-apply on load...', conditions);
                                if (conditions.includes('60 jours') && this.echeances.length !== 2) {
                                    this.applyPaymentConditions(s);
                                } else if (conditions.includes('90 jours') && this.echeances.length !== 3) {
                                    this.applyPaymentConditions(s);
                                }
                            }
                        }
                    }
                }
            },
            error: (err) => console.error('Erreur chargement fournisseurs', err)
        });
    }

    setupSupplierFilter() {
        this.filteredSuppliers = this.supplierCtrl.valueChanges.pipe(
            startWith(''),
            map(value => {
                const name = typeof value === 'string' ? value : (value as any)?.nom;
                return name ? this._filterSuppliers(name as string) : this.suppliers.slice();
            })
        );
    }

    private _filterSuppliers(name: string): Supplier[] {
        const filterValue = name.toLowerCase();
        return this.suppliers.filter((option: Supplier) => option.nom.toLowerCase().includes(filterValue));
    }

    displayFn(supplier: any): string {
        if (!supplier) return '';
        if (typeof supplier === 'string') return supplier;
        return supplier.nom || '';
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



    onSupplierChange(id: string) {
        console.log('[InvoiceForm] onSupplierChange', id);
        this.selectedSupplier = this.suppliers.find(s => s.id === id) || null;

        // ONLY auto-apply if it's a NEW invoice (empty installments)
        // If there are already installments, it means we loaded them from DB or user manually added them.
        if (this.selectedSupplier && this.echeances.length === 0 && !this.isViewMode) {
            this.applyPaymentConditions(this.selectedSupplier);
        }
    }

    manualApplyConditions() {
        if (this.selectedSupplier) {
            if (confirm('Voulez-vous écraser les échéances actuelles par les conditions par défaut du fournisseur ?')) {
                this.applyPaymentConditions(this.selectedSupplier);
                // Force UI update
                this.cdr.detectChanges();
            }
        } else {
            this.snackBar.open('Veuillez d\'abord sélectionner un fournisseur', 'OK', { duration: 3000 });
        }
    }

    private isSameDay(d1: any, d2: any): boolean {
        if (!d1 || !d2) return false;
        const date1 = new Date(d1);
        const date2 = new Date(d2);
        return date1.getFullYear() === date2.getFullYear() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getDate() === date2.getDate();
    }

    applyPaymentConditions(supplier: Supplier) {
        const echeanceArray = supplier.convention?.echeancePaiement || [];
        const conditions = (echeanceArray[0] || supplier.conditionsPaiement2 || supplier.conditionsPaiement || '').trim();

        console.log(`[InvoiceForm] Applying conditions: "${conditions}" for supplier ${supplier.nom}`);

        if (!conditions) {
            console.log('[InvoiceForm] No conditions found for this supplier.');
            this.snackBar.open(`Aucune modalité de paiement définie pour ${supplier.nom}`, 'INFO', { duration: 3000 });
            return;
        }

        const conditionsLower = conditions.toLowerCase();
        this.snackBar.open(`Conditions détectées: "${conditions}"`, 'OK', { duration: 4000 });

        const emissionDate = new Date(this.detailsGroup.get('dateEmission')?.value || new Date());
        const previousEcheances = this.echeances.value;

        // PRESERVE: Logic to check if we should keep existing dates
        // We only preserve manual dates if the user actually changed them from the default (Today/Emission date)
        const getPreservedDate = (index: number, defaultDate: Date): string => {
            const existing = previousEcheances[index];
            if (existing && existing.dateEcheance) {
                // If existing date is different from emission date, we consider it "manual" or "calculée" and keep it
                if (!this.isSameDay(existing.dateEcheance, emissionDate)) {
                    return existing.dateEcheance;
                }
            }
            return defaultDate.toISOString();
        };

        this.echeances.clear();

        if (conditionsLower.includes('comptant') || conditionsLower.includes('espèces')) {
            console.log('[InvoiceForm] Condition matched: COMPTANT/ESPECES');
            const existing = previousEcheances[0];
            this.addEcheance({
                type: (existing?.type === 'ESPECES' || existing?.type === 'CHEQUE') ? existing.type : 'ESPECES',
                dateEcheance: getPreservedDate(0, emissionDate),
                statut: 'EN_ATTENTE',
                montant: 0
            });
        } else if (conditionsLower.match(/r[eé]partie?\s*sur\s*(\d+)\s*mois/)) {
            const match = conditionsLower.match(/r[eé]partie?\s*sur\s*(\d+)\s*mois/);
            const months = parseInt(match![1], 10);
            console.log(`[InvoiceForm] Condition matched: REPARTIE SUR ${months} MOIS`);

            for (let i = 1; i <= months; i++) {
                const targetDate = new Date(emissionDate);
                targetDate.setMonth(targetDate.getMonth() + i);

                const existing = previousEcheances[i - 1];
                // Use existing type if it's already a standard paper/bank type, else default to CHEQUE for split payments
                let type = existing?.type || 'CHEQUE';
                if (type === 'ESPECES' && months > 1) type = 'CHEQUE'; // Avoid 'ESPECES' for split installments

                this.addEcheance({
                    type: type,
                    reference: existing?.reference || '',
                    banque: existing?.banque || (supplier.banque || ''),
                    dateEcheance: getPreservedDate(i - 1, targetDate),
                    statut: 'EN_ATTENTE',
                    montant: 0
                });
            }
        } else if (conditionsLower.includes('60 jours') || conditionsLower.includes('60jours')) {
            console.log('[InvoiceForm] Condition matched: 60 JOURS (Split 50/50)');
            const totalTTC = this.detailsGroup.get('montantTTC')?.value || 0;
            const splitAmount = Math.floor((totalTTC / 2) * 100) / 100;
            const remainder = Math.round((totalTTC - (splitAmount * 2)) * 100) / 100;

            // +1 Month (approx 30 days but user wants 09/02 for 09/01)
            const d1 = new Date(emissionDate);
            d1.setMonth(d1.getMonth() + 1);

            // +2 Months
            const d2 = new Date(emissionDate);
            d2.setMonth(d2.getMonth() + 2);

            const existing1 = previousEcheances[0];
            const existing2 = previousEcheances[1];

            let type1 = existing1?.type || 'CHEQUE';
            if (type1 === 'ESPECES') type1 = 'CHEQUE'; // Force uniform non-cash for splits

            this.addEcheance({
                type: type1,
                reference: existing1?.reference || '',
                banque: existing1?.banque || (supplier.banque || ''),
                dateEcheance: getPreservedDate(0, d1),
                statut: 'EN_ATTENTE',
                montant: splitAmount
            });

            let type2 = existing2?.type || 'CHEQUE';
            if (type2 === 'ESPECES') type2 = 'CHEQUE';

            this.addEcheance({
                type: type2,
                reference: existing2?.reference || '',
                banque: existing2?.banque || (supplier.banque || ''),
                dateEcheance: getPreservedDate(1, d2),
                statut: 'EN_ATTENTE',
                montant: splitAmount + remainder
            });

            this.snackBar.open(`Conditions appliquées: 60 jours (2 échéances)`, 'OK', { duration: 4000 });

        } else if (conditionsLower.includes('90 jours') || conditionsLower.includes('90jours')) {
            console.log('[InvoiceForm] Condition matched: 90 JOURS (Split 1/3 each)');
            const totalTTC = this.detailsGroup.get('montantTTC')?.value || 0;
            const splitAmount = Math.floor((totalTTC / 3) * 100) / 100;
            const remainder = Math.round((totalTTC - (splitAmount * 3)) * 100) / 100;

            for (let i = 1; i <= 3; i++) {
                const targetDate = new Date(emissionDate);
                targetDate.setMonth(targetDate.getMonth() + i);

                const amt = (i === 3) ? (splitAmount + remainder) : splitAmount;
                const existing = previousEcheances[i - 1];
                let type = existing?.type || 'CHEQUE';
                if (type === 'ESPECES') type = 'CHEQUE';

                this.addEcheance({
                    type: type,
                    reference: existing?.reference || '',
                    banque: existing?.banque || (supplier.banque || ''),
                    dateEcheance: getPreservedDate(i - 1, targetDate),
                    statut: 'EN_ATTENTE',
                    montant: amt
                });
            }
            this.snackBar.open(`Conditions appliquées: 90 jours (3 échéances)`, 'OK', { duration: 4000 });

        } else if (conditionsLower.includes('30 jours') || conditionsLower.includes('30jours')) {
            console.log('[InvoiceForm] Condition matched: 30 JOURS');
            const totalTTC = this.detailsGroup.get('montantTTC')?.value || 0;
            const targetDate = new Date(emissionDate);
            targetDate.setMonth(targetDate.getMonth() + 1);

            const existing = previousEcheances[0];
            let type = existing?.type || 'CHEQUE';
            if (type === 'ESPECES') type = 'CHEQUE';

            this.addEcheance({
                type: type,
                reference: existing?.reference || '',
                banque: existing?.banque || (supplier.banque || ''),
                dateEcheance: getPreservedDate(0, targetDate),
                statut: 'EN_ATTENTE',
                montant: totalTTC
            });
            this.snackBar.open(`Conditions appliquées: 30 jours (1 échéance)`, 'OK', { duration: 4000 });
        } else if (conditionsLower.includes('fin de mois')) {
            console.log('[InvoiceForm] Condition matched: FIN DE MOIS');
            const targetDate = new Date(emissionDate);
            targetDate.setMonth(targetDate.getMonth() + 1);
            targetDate.setDate(0);
            const existing = previousEcheances[0];
            this.addEcheance({
                type: existing?.type || 'VIREMENT',
                reference: existing?.reference || '',
                banque: existing?.banque || (supplier.banque || ''),
                dateEcheance: getPreservedDate(0, targetDate),
                statut: 'EN_ATTENTE',
                montant: 0
            });
        } else {
            console.log('[InvoiceForm] No specific condition matched, triggering manual handling or default.');
        }

        // Logic to update the invoice due date remains in the addEcheance sync or handled here
        this.updateInvoiceDueDateFromEcheances();
        this.cdr.detectChanges();

        if (!conditionsLower.includes('60 jours') && !conditionsLower.includes('90 jours')) {
            this.redistributeAmountAcrossEcheances();
        }
    }

    private updateInvoiceDueDateFromEcheances() {
        if (this.echeances.length > 0) {
            const dates = this.echeances.controls
                .map(c => c.get('dateEcheance')?.value)
                .filter(v => !!v)
                .map(v => new Date(v));
            if (dates.length > 0) {
                const maxDate = new Date(Math.max.apply(null, dates.map(d => d.getTime())));
                const currentInvoiceDate = this.detailsGroup.get('dateEcheance')?.value;

                if (!currentInvoiceDate || !this.isSameDay(currentInvoiceDate, maxDate)) {
                    this.detailsGroup.get('dateEcheance')?.setValue(maxDate, { emitEvent: false });
                }
            }
        }
    }


    private redistributeAmountAcrossEcheances() {
        const montantTTC = this.detailsGroup.get('montantTTC')?.value || 0;
        const echeancesCount = this.echeances.length;

        if (echeancesCount > 0 && montantTTC > 0) {
            let montantParEcheance = Math.floor((montantTTC / echeancesCount) * 100) / 100;
            let remainder = Math.round((montantTTC - (montantParEcheance * echeancesCount)) * 100) / 100;

            this.echeances.controls.forEach((control, index) => {
                let amount = montantParEcheance;
                // Add remainder to the last installment to ensure total matches exactly
                if (index === echeancesCount - 1) {
                    amount += remainder;
                    // Fix floating point issues
                    amount = Math.round(amount * 100) / 100;
                }

                // Only update if value is different to avoid loops
                if (control.get('montant')?.value !== amount) {
                    control.patchValue({ montant: amount }, { emitEvent: false });
                }
            });

            console.log(`[InvoiceForm] Redistributed ${montantTTC} MAD across ${echeancesCount} installments`);
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
        const ht = Math.round((this.detailsGroup.get('montantHT')?.value || 0) * 100) / 100;
        const taux = this.detailsGroup.get('tauxTVA')?.value || 0;
        const tva = Math.round(ht * (taux / 100) * 100) / 100;
        const ttc = Math.round((ht + tva) * 100) / 100;

        this.detailsGroup.patchValue({
            montantHT: ht,
            montantTVA: tva,
            montantTTC: ttc
        }, { emitEvent: false });
    }

    calculateFromTTC() {
        const ttc = Math.round((this.detailsGroup.get('montantTTC')?.value || 0) * 100) / 100;
        const taux = this.detailsGroup.get('tauxTVA')?.value || 0;
        const ht = Math.round((ttc / (1 + taux / 100)) * 100) / 100;
        const tva = Math.round((ttc - ht) * 100) / 100;

        this.detailsGroup.patchValue({
            montantHT: ht,
            montantTVA: tva,
            montantTTC: ttc
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

        // Dynamic validation based on type
        group.get('type')?.valueChanges.subscribe(type => {
            console.log('[InvoiceForm] Echeance type changed to:', type);
            const banqueCtrl = group.get('banque');
            const refCtrl = group.get('reference');

            if (type === 'ESPECES') {
                banqueCtrl?.clearValidators();
                banqueCtrl?.disable({ emitEvent: false }); // Disable to exclude from validity
                banqueCtrl?.setValue('');

                refCtrl?.clearValidators();
                refCtrl?.disable({ emitEvent: false });
                refCtrl?.setValue('');
            } else {
                banqueCtrl?.setValidators([Validators.required]);
                banqueCtrl?.enable({ emitEvent: false });

                refCtrl?.enable({ emitEvent: false });
            }
            banqueCtrl?.updateValueAndValidity();
            refCtrl?.updateValueAndValidity();
        });

        // SYNC: Update main invoice due date when an installment date changes
        const syncInvoiceDate = () => {
            if (this.echeances.length > 0) {
                const dates = this.echeances.controls
                    .map(c => c.get('dateEcheance')?.value)
                    .filter(v => !!v)
                    .map(v => new Date(v));
                if (dates.length > 0) {
                    const maxDate = new Date(Math.max.apply(null, dates.map(d => d.getTime())));
                    const currentInvoiceDate = this.detailsGroup.get('dateEcheance')?.value;

                    // Only update if it's actually different to avoid unnecessary triggers
                    if (!currentInvoiceDate || new Date(currentInvoiceDate).getTime() !== maxDate.getTime()) {
                        this.detailsGroup.get('dateEcheance')?.setValue(maxDate, { emitEvent: false });
                    }
                }
            }
        };

        group.get('dateEcheance')?.valueChanges.subscribe(() => syncInvoiceDate());

        // Also trigger on creation to ensure initial state is correct
        syncInvoiceDate();

        // Trigger initial check
        const initialType = group.get('type')?.value;
        if (initialType === 'ESPECES') {
            const banqueCtrl = group.get('banque');
            const refCtrl = group.get('reference');
            banqueCtrl?.clearValidators();
            banqueCtrl?.disable({ emitEvent: false });
            refCtrl?.clearValidators();
            refCtrl?.disable({ emitEvent: false });
            banqueCtrl?.updateValueAndValidity();
            refCtrl?.updateValueAndValidity();
        }

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
        // En mode BL, on ne valide que la partie détails
        const isValid = this.isBLMode ? this.detailsGroup.valid : this.form.valid;

        if (isValid) {
            this.submitting = true;
            this.handleSupplierAndSave();
        } else {
            this.detailsGroup.markAllAsTouched();
            if (!this.isBLMode) {
                this.paymentGroup.markAllAsTouched();
            }
            this.snackBar.open('Veuillez remplir tous les champs obligatoires (marqués par *)', 'Fermer', { duration: 3000 });
        }
    }

    private handleSupplierAndSave() {
        const supplierInput = this.supplierCtrl.value;
        // If empty, proceed without supplier (though it is required in form, but handle cleanly)
        if (!supplierInput) {
            this.detailsGroup.patchValue({ fournisseurId: null }); // Will likely fail validation if required
            this.saveInvoice();
            return;
        }

        // Check if selected existing
        if (typeof supplierInput === 'object' && supplierInput && 'id' in supplierInput) {
            const s = supplierInput as Supplier;
            this.detailsGroup.patchValue({ fournisseurId: s.id });
            this.saveInvoice();
            return;
        }

        // It is a string
        const name = String(supplierInput);
        const existing = this.suppliers.find(s => s.nom.toLowerCase() === name.toLowerCase());
        if (existing) {
            this.detailsGroup.patchValue({ fournisseurId: existing.id });
            this.saveInvoice();
            return;
        }

        // Creating new supplier
        this.financeService.createSupplier({ nom: name }).subscribe({
            next: (newSupplier) => {
                this.detailsGroup.patchValue({ fournisseurId: newSupplier.id });
                this.saveInvoice();
            },
            error: (err) => {
                console.error('Error creating supplier', err);
                this.submitting = false;
                this.snackBar.open(this.getErrorMessage(err) || 'Erreur lors de la création du fournisseur', 'Fermer', { duration: 5000 });
            }
        });
    }

    private saveInvoice() {
        const detailsData = this.detailsGroup.value;
        const paymentData = this.paymentGroup.value;

        const invoiceData = {
            ...detailsData,
            ...paymentData,
            fournisseurId: detailsData.fournisseurId || null,
            centreId: detailsData.centreId || null,
            clientId: detailsData.clientId || null,
            dateEcheance: detailsData.dateEcheance || undefined,
            montantHT: Number(detailsData.montantHT),
            montantTVA: Number(detailsData.montantTVA),
            montantTTC: Number(detailsData.montantTTC)
        };

        delete invoiceData.tauxTVA;

        if (this.isEditMode) {
            const id = this.route.snapshot.paramMap.get('id') || this.data?.invoice?.id;
            if (id) {
                this.financeService.updateInvoice(id, invoiceData).subscribe({
                    next: () => {
                        this.snackBar.open('Modifications enregistrées', 'Fermer', { duration: 3000 });
                        this.finalize(invoiceData);
                    },
                    error: (err) => {
                        this.submitting = false;
                        const msg = this.getErrorMessage(err);
                        this.snackBar.open(msg || 'Erreur lors de la mise à jour', 'Fermer', { duration: 7000 });
                    }
                });
            } else {
                this.finalize(invoiceData);
            }
        } else {
            // Before creating invoice, check expense ceiling for current month
            // Only count échéances (payment schedules) that fall within the current month
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            const echeances = invoiceData.echeances || [];
            const monthlyPaymentAmount = echeances.reduce((sum: number, ech: any) => {
                const echeanceDate = new Date(ech.dateEcheance);
                const echMonth = echeanceDate.getMonth();
                const echYear = echeanceDate.getFullYear();

                // Only count active (=not cancelled) installments that fall within the current month
                if (echMonth === currentMonth && echYear === currentYear && ech.statut !== 'ANNULE') {
                    return sum + (Number(ech.montant) || 0);
                }
                return sum;
            }, 0);

            // Get current centre for ceiling check
            const centreId = invoiceData.centreId || this.currentCentre()?.id;

            // Check ceiling if there are payments this month
            if (monthlyPaymentAmount > 0 && centreId) {
                this.financeService.getTreasurySummary(currentYear, currentMonth + 1, centreId).pipe(
                    switchMap(summary => {
                        const threshold = summary?.monthlyThreshold || 50000;
                        const totalWithEntry = (summary?.totalExpenses || 0) + monthlyPaymentAmount;

                        if (totalWithEntry > threshold) {
                            return this.financeService.getYearlyProjection(currentYear, centreId).pipe(
                                switchMap(projection => {
                                    const dialogRef = this.dialog.open(CeilingWarningDialogComponent, {
                                        width: '600px',
                                        disableClose: true,
                                        data: {
                                            amount: monthlyPaymentAmount,
                                            currentDetails: {
                                                totalExpenses: summary.totalExpenses,
                                                monthlyThreshold: threshold,
                                                balance: summary.balance
                                            },
                                            projection: projection,
                                            currentMonth: currentMonth,
                                            currentYear: currentYear
                                        }
                                    });
                                    return dialogRef.afterClosed();
                                })
                            );
                        }
                        return of({ action: 'FORCE' });
                    })
                ).subscribe((result: any) => {
                    if (!result || result.action === 'CANCEL') {
                        this.submitting = false;
                        return;
                    }

                    if (result.action === 'RESCHEDULE' && result.date) {
                        const targetDateStr = result.date.toISOString();

                        // Reschedule logic: Move ALL installments that fall in the current month 
                        // to the target month to ensure we actually clear the ceiling breach.
                        let movedAny = false;
                        (invoiceData.echeances || []).forEach((ech: any) => {
                            const d = new Date(ech.dateEcheance);
                            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                                ech.dateEcheance = targetDateStr;
                                movedAny = true;
                            }
                        });

                        // Also update the main invoice-level dateEcheance if it was in the current month
                        const mainDate = new Date(invoiceData.dateEcheance);
                        if (mainDate.getMonth() === currentMonth && mainDate.getFullYear() === currentYear) {
                            invoiceData.dateEcheance = targetDateStr;
                        } else if (movedAny) {
                            // If we moved installments but not the main date, 
                            // we should still ensure the main date is at least as late as the latest installment
                            invoiceData.dateEcheance = targetDateStr;
                        }
                    }

                    // Proceed with creation
                    this.createInvoiceAfterCeilingCheck(invoiceData);
                });
            } else {
                // No payments this month or no centre, proceed directly
                this.createInvoiceAfterCeilingCheck(invoiceData);
            }
        }
    }

    private createInvoiceAfterCeilingCheck(invoiceData: any) {
        this.financeService.createInvoice(invoiceData).subscribe({
            next: res => {
                this.snackBar.open('Enregistrement réussi', 'Fermer', { duration: 3000 });

                const stockTypes = ['ACHAT_VERRE_OPTIQUE', 'ACHAT_MONTURES_OPTIQUE', 'ACHAT_MONTURES_SOLAIRE', 'ACHAT_LENTILLES', 'ACHAT_PRODUITS', 'ACHAT_STOCK'];
                if (stockTypes.includes(res.type)) {
                    const feedStock = confirm('Facture enregistrée. Souhaitez-vous maintenant alimenter le stock avec les articles de cette facture ?');
                    if (feedStock) {
                        this.dialogRef.close(res);
                        this.router.navigate(['/p/stock/entry-v2'], {
                            queryParams: {
                                prefillInvoice: res.numeroFacture,
                                prefillSupplier: res.fournisseurId,
                                prefillDate: res.dateEmission
                            }
                        });
                        return;
                    }
                }
                this.finalize(res);
            },
            error: (err) => {
                this.submitting = false;
                const msg = this.getErrorMessage(err);
                this.snackBar.open(msg || 'Erreur lors de la création', 'Fermer', { duration: 7000 });
            }
        });
    }

    private getErrorMessage(err: any): string {
        console.error('Error details:', err);
        if (!err) return 'Une erreur inconnue est survenue';

        let message = '';
        if (typeof err.error === 'string') {
            message = err.error;
        } else if (err.error && typeof err.error.message === 'string') {
            message = err.error.message;
        } else if (err.error && Array.isArray(err.error.message)) {
            message = err.error.message.join(', ');
        } else if (err.message) {
            message = err.message;
        } else {
            message = JSON.stringify(err);
        }

        // Translation for common database errors
        if (message.includes('Unique constraint')) {
            if (message.includes('numeroFacture')) return 'Ce numéro de BL existe déjà pour ce fournisseur.';
        }

        return message;
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

    // File Upload Methods
    openFileUpload(): void {
        this.fileInput.nativeElement.click();
    }

    onFilesSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files) return;

        Array.from(input.files).forEach(file => {
            if (file.size > 10 * 1024 * 1024) {
                alert(`Le fichier ${file.name} est trop volumineux (max 10MB)`);
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = file.type === 'application/pdf'
                    ? this.sanitizer.bypassSecurityTrustResourceUrl(e.target?.result as string)
                    : e.target?.result as string;

                const attachmentFile: AttachmentFile = {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    preview,
                    file,
                    uploadDate: new Date()
                };
                this.attachmentFiles.push(attachmentFile);
                this.cdr.markForCheck();
            };
            reader.readAsDataURL(file);
        });
        input.value = '';
    }

    viewFile(file: AttachmentFile): void {
        this.viewingFile = file;
        this.cdr.markForCheck();
    }

    closeViewer(): void {
        this.viewingFile = null;
        this.cdr.markForCheck();
    }

    deleteFile(index: number): void {
        if (confirm('Supprimer ce document ?')) {
            this.attachmentFiles.splice(index, 1);
            this.cdr.markForCheck();
        }
    }

    formatFileSize(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // Camera Methods
    async openCamera(): Promise<void> {
        const dialogRef = this.dialog.open(CameraCaptureDialogComponent, {
            width: '800px',
            disableClose: true
        });

        dialogRef.afterClosed().subscribe(dataUrl => {
            if (dataUrl) {
                this.handleCapturedPhoto(dataUrl);
            }
        });
    }

    private handleCapturedPhoto(dataUrl: string): void {
        const file = this.dataURLtoFile(dataUrl, `photo_${Date.now()}.jpg`);
        const attachmentFile: AttachmentFile = {
            name: file.name,
            type: file.type,
            size: file.size,
            preview: dataUrl,
            file,
            uploadDate: new Date()
        };
        this.attachmentFiles.push(attachmentFile);
        this.cdr.markForCheck();
    }

    private dataURLtoFile(dataurl: string, filename: string): File {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)![1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    }
}
