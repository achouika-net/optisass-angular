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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';
import { Supplier, SupplierInvoice, Echeance } from '../../models/finance.models';
import { FinanceService } from '../../services/finance.service';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { Observable, of, forkJoin, BehaviorSubject } from 'rxjs';
import { map, startWith, switchMap, catchError, debounceTime, tap } from 'rxjs/operators';
import { CeilingWarningDialogComponent } from '../ceiling-warning-dialog/ceiling-warning-dialog.component';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CameraCaptureDialogComponent } from '../../../../shared/components/camera-capture/camera-capture-dialog.component';
import { ClientManagementService } from '../../../client-management/services/client.service';
import { FicheService } from '../../../client-management/services/fiche.service';
import { Client } from '../../../client-management/models/client.model';
import { FicheClient } from '../../../client-management/models/fiche-client.model';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../../../environments/environment';

interface AttachmentFile {
    name: string;
    type: string;
    size: number;
    preview: string | SafeResourceUrl;
    file?: File;
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
        MatSnackBarModule,
        MatSlideToggleModule,
        MatProgressSpinnerModule
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

    // Client Autocomplete (for linking BL to client file)
    clientCtrl = new FormControl<any>('');
    filteredClients!: Observable<Client[]>;
    availableFiches: FicheClient[] = [];
    loadingClients = false;
    loadingFiches = false;


    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

    attachmentFiles: AttachmentFile[] = [];
    viewingFile: AttachmentFile | null = null;

    parentInvoice: SupplierInvoice | null = null;
    childBLs: SupplierInvoice[] = [];

    get isBLMode(): boolean {
        return this.form?.get('details.isBL')?.value === true;
    }

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
        private clientService: ClientManagementService,
        private ficheService: FicheService,
        @Optional() public dialogRef: MatDialogRef<InvoiceFormDialogComponent>,
        @Optional() @Inject(MAT_DIALOG_DATA) public data: {
            invoice?: SupplierInvoice,
            isGrouping?: boolean,
            prefilledData?: any,
            blIds?: string[]
        }
    ) {
        this.isEditMode = !!(data?.invoice);
        const prefilled = data?.prefilledData || {};

        this.form = this.fb.group({
            details: this.fb.group({
                fournisseurId: [data?.invoice?.fournisseurId || prefilled.fournisseurId || ''],
                centreId: [data?.invoice?.centreId || this.currentCentre()?.id || '', Validators.required],
                numeroFacture: [data?.invoice?.numeroFacture || prefilled.numeroFacture || '', Validators.required],
                dateEmission: [data?.invoice?.dateEmission || new Date(), Validators.required],
                dateEcheance: [data?.invoice?.dateEcheance || null],
                montantHT: [data?.invoice?.montantHT || prefilled.montantHT || 0, [Validators.required, Validators.min(0)]],
                tauxTVA: [
                    (data?.invoice?.montantTVA !== undefined && data?.invoice?.montantHT)
                        ? Math.round((data.invoice.montantTVA / data.invoice.montantHT) * 100)
                        : 20
                ],
                montantTVA: [data?.invoice?.montantTVA || prefilled.montantTVA || 0, [Validators.required, Validators.min(0)]],
                montantTTC: [data?.invoice?.montantTTC || prefilled.montantTTC || 0, [Validators.required, Validators.min(0)]],
                type: [data?.invoice?.type || (data as any)?.prefilledType || prefilled.type || 'ACHAT_STOCK', Validators.required],
                categorieBL: [data?.invoice?.categorieBL || 'VERRE'],
                isBL: [data?.invoice?.isBL !== undefined ? data.invoice.isBL : (this.data as any)?.isBL],
                pieceJointeUrl: [data?.invoice?.pieceJointeUrl || ''],
                clientId: [data?.invoice?.clientId || prefilled.prefilledClientId || ''],
                ficheId: [data?.invoice?.ficheId || prefilled.prefilledFicheId || ''],
            }),
            payment: this.fb.group({
                echeances: this.fb.array([]),
                statut: [data?.invoice?.statut || 'EN_ATTENTE']
            }),
            directPayment: this.fb.group({
                paidImmediately: [!(data?.invoice) && (data as any)?.isBL],
                modePaiement: ['ESPECES'],
                dateEcheance: [''],
                banque: ['']
            })
        });

        if (data?.invoice?.echeances) {
            data.invoice.echeances.forEach(e => this.addEcheance(e));
        }

        if (data?.invoice?.fournisseur) {
            this.supplierCtrl.setValue(data.invoice.fournisseur.nom);
            this.selectedSupplier = data.invoice.fournisseur;
        }

        if (data?.invoice?.pieceJointeUrl) {
            const urls = data.invoice.pieceJointeUrl.split(';');
            this.attachmentFiles = urls.filter(u => !!u).map(url => {
                const fullUrl = url.startsWith('/')
                    ? `${environment.apiUrl}${url}`
                    : url;

                return {
                    name: url.split('/').pop() || 'Pièce jointe',
                    type: url.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
                    size: 0,
                    preview: fullUrl,
                    uploadDate: new Date()
                };
            });
        }
    }

    ngOnInit() {
        console.log('[InvoiceForm] VERSION CHECK: Aggressive Rounding & Sync Date Update ACTIVE');
        this.loadSuppliers();

        // Ensure centreId is set if missing
        if (!this.detailsGroup.get('centreId')?.value) {
            const center = this.currentCentre();
            if (center?.id) {
                this.detailsGroup.patchValue({ centreId: center.id });
            }
        }

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
                const mHT = Math.round(Number(invoice.montantHT || 0) * 100) / 100;
                const mTVA = Math.round(Number(invoice.montantTVA || 0) * 100) / 100;
                const mTTC = Math.round(Number(invoice.montantTTC || 0) * 100) / 100;

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
                        clientId: invoice.clientId,
                        ficheId: invoice.ficheId,
                    },
                    payment: {
                        statut: invoice.statut
                    }
                });
                this.echeances.clear();
                invoice.echeances?.forEach(e => this.addEcheance(e));

                if (invoice.fournisseur) {
                    this.supplierCtrl.setValue(invoice.fournisseur.nom);
                    this.selectedSupplier = invoice.fournisseur;
                }

                this.parentInvoice = invoice.parentInvoice || null;
                this.childBLs = invoice.childBLs || [];

                this.autoUpdateStatus();
                if (invoice.montantTTC > 0) this.calculateFromTTC();

                let pieceJointeUrl = invoice.pieceJointeUrl;
                // If BL and no attachment, try to inherit from parent invoice
                if (this.isBLMode && !pieceJointeUrl && this.parentInvoice?.pieceJointeUrl) {
                    pieceJointeUrl = this.parentInvoice.pieceJointeUrl;
                }

                if (pieceJointeUrl) {
                    const urls = pieceJointeUrl.split(';');
                    this.attachmentFiles = urls.filter(u => !!u).map(url => {
                        const fullUrl = url.startsWith('/') ? `${environment.apiUrl}${url}` : url;
                        return {
                            name: url.split('/').pop() || 'Pièce jointe',
                            type: url.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
                            size: 0,
                            preview: fullUrl,
                            uploadDate: new Date()
                        };
                    });
                }
            });
        }

        if (this.data?.invoice && this.data.invoice.montantTTC > 0) {
            setTimeout(() => this.calculateFromTTC());
        }

        // Auto-calculate TVA and TTC / HT
        this.detailsGroup.get('montantHT')?.valueChanges.subscribe(() => {
            if (this.detailsGroup.get('montantHT')?.dirty) this.calculateFromHT();
        });
        this.detailsGroup.get('tauxTVA')?.valueChanges.subscribe(() => {
            if (this.detailsGroup.get('tauxTVA')?.dirty) this.calculateFromHT();
        });
        this.detailsGroup.get('montantTTC')?.valueChanges.subscribe(() => {
            if (this.detailsGroup.get('montantTTC')?.dirty) this.calculateFromTTC();
        });

        // Listen for supplier changes
        this.detailsGroup.get('fournisseurId')?.valueChanges.subscribe(id => this.onSupplierChange(id));

        // Auto-update status when echeances or amounts change
        this.echeances.valueChanges.subscribe(() => this.autoUpdateStatus());
        this.detailsGroup.get('montantTTC')?.valueChanges.subscribe(() => {
            this.autoUpdateStatus();
            this.redistributeAmountAcrossEcheances();
        });


        this.filteredTypes = this.detailsGroup.get('type')!.valueChanges.pipe(
            startWith(''),
            map(value => this._filterTypes(value || ''))
        );

        this.supplierCtrl.valueChanges.subscribe(value => {
            if (typeof value === 'object' && value && 'id' in (value as any)) {
                this.detailsGroup.patchValue({ fournisseurId: (value as any).id }, { emitEvent: false });
                this.selectedSupplier = value as Supplier;
            } else if (!value) {
                this.detailsGroup.patchValue({ fournisseurId: null }, { emitEvent: false });
                this.selectedSupplier = null;
            }
        });

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

        // Setup Client Autocomplete Logic
        this.setupClientFilter();

        // If Type changes, reset or show/hide client fields handled in UI but we might want to clear them
        this.detailsGroup.get('type')?.valueChanges.subscribe(type => {
            if (type !== 'ACHAT_VERRE_OPTIQUE') {
                // Should we clear? User might change back and forth. 
                // Let's not clear immediately unless required.
            }
        });

        // SPECIAL CASE: Consolidating BLs - Auto-add paid echeance if some BLs are paid
        if (this.data?.isGrouping && this.data.prefilledData?.totalPaye > 0) {
            const paidAmount = this.data.prefilledData.totalPaye;
            const remaining = Math.max(0, this.detailsGroup.get('montantTTC')?.value - paidAmount);

            this.echeances.clear();
            // 1. Add the paid part
            this.addEcheance({
                type: 'ESPECES',
                dateEcheance: this.detailsGroup.get('dateEmission')?.value || new Date(),
                montant: paidAmount,
                statut: 'ENCAISSE',
                reference: 'REPRIS_DES_BL'
            });
            // 2. Add the remaining part if any
            if (remaining > 0) {
                this.addEcheance({
                    type: 'CHEQUE',
                    dateEcheance: this.detailsGroup.get('dateEcheance')?.value || new Date(),
                    montant: remaining,
                    statut: 'EN_ATTENTE'
                });
            }
            this.autoUpdateStatus();
        }
    }

    loadSuppliers() {
        this.financeService.getSuppliers().subscribe({
            next: (data) => {
                this.suppliers = data;
                this.setupSupplierFilter();

                const currentId = this.detailsGroup.get('fournisseurId')?.value;
                if (currentId) {
                    const s = this.suppliers.find(x => x.id === currentId);
                    if (s) {
                        this.selectedSupplier = s;
                        this.supplierCtrl.setValue(s.nom, { emitEvent: false });
                        if (this.echeances.length <= 1 && !this.isViewMode) {
                            const conditions = (s.convention?.echeancePaiement?.[0] || s.conditionsPaiement || '').toLowerCase();
                            if (conditions) {
                                if (conditions.includes('60 jours') && this.echeances.length !== 2) this.applyPaymentConditions(s);
                                else if (conditions.includes('90 jours') && this.echeances.length !== 3) this.applyPaymentConditions(s);
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

    // --- Client Filtering & Fiche Loading ---
    setupClientFilter() {
        this.filteredClients = this.clientCtrl.valueChanges.pipe(
            startWith(''),
            debounceTime(300),
            switchMap(value => {
                if (typeof value !== 'string') return of([]); // Selected or empty
                if (!value || value.length < 2) return of([]);
                this.loadingClients = true;
                return this.clientService.searchClientsByNom(value).pipe(
                    tap(() => this.loadingClients = false),
                    catchError(() => {
                        this.loadingClients = false;
                        return of([]);
                    })
                );
            })
        );

        this.clientCtrl.valueChanges.subscribe(value => {
            if (value && typeof value === 'object' && value.id) {
                this.detailsGroup.patchValue({ clientId: value.id });
                this.loadFichesForClient(value.id);
            } else if (!value) {
                this.detailsGroup.patchValue({ clientId: null, ficheId: null });
                this.availableFiches = [];
            }
        });
    }

    loadFichesForClient(clientId: string) {
        this.loadingFiches = true;
        this.ficheService.getFichesByClient(clientId).subscribe({
            next: (fiches) => {
                this.availableFiches = fiches;
                this.loadingFiches = false;

                // If only one fiche, auto-select it
                if (this.availableFiches.length === 1 && !this.detailsGroup.get('ficheId')?.value) {
                    this.detailsGroup.patchValue({ ficheId: this.availableFiches[0].id });
                }

                this.cdr.detectChanges();
            },
            error: () => {
                this.loadingFiches = false;
                this.cdr.detectChanges();
            }
        });
    }

    displayClientFn(client: any): string {
        if (!client) return '';
        if (typeof client === 'string') return client;
        const name = client.nom || client.raisonSociale || '';
        const prenom = client.prenom || '';
        const cin = client.numeroPieceIdentite ? ` (${client.numeroPieceIdentite})` : '';
        return `${name} ${prenom}${cin}`.trim();
    }


    viewParentInvoice() {
        if (!this.parentInvoice) return;
        this.dialogRef.close();
        this.dialog.open(InvoiceFormDialogComponent, {
            width: '1400px',
            maxWidth: '98vw',
            data: { invoice: this.parentInvoice, viewMode: true }
        });
    }

    viewChildBL(bl: SupplierInvoice) {
        this.dialog.open(InvoiceFormDialogComponent, {
            width: '1400px',
            maxWidth: '98vw',
            data: { invoice: bl, viewMode: true, isBL: true }
        });
    }

    get totalEcheances(): number {
        return this.echeances.controls
            .reduce((sum, control) => sum + (control.get('montant')?.value || 0), 0);
    }

    get diffTTC(): number {
        const totalTTC = this.detailsGroup.get('montantTTC')?.value || 0;
        return Math.round((totalTTC - this.totalEcheances) * 100) / 100;
    }

    get detailsGroup() { return this.form.get('details') as FormGroup; }
    get paymentGroup() { return this.form.get('payment') as FormGroup; }
    get echeances() { return this.paymentGroup.get('echeances') as FormArray; }

    onSupplierChange(id: string) {
        this.selectedSupplier = this.suppliers.find(s => s.id === id) || null;
        if (this.selectedSupplier && this.echeances.length === 0 && !this.isViewMode) {
            this.applyPaymentConditions(this.selectedSupplier);
        }
    }

    manualApplyConditions() {
        if (this.selectedSupplier) {
            if (confirm('Voulez-vous écraser les échéances actuelles par les conditions par défaut du fournisseur ?')) {
                this.applyPaymentConditions(this.selectedSupplier);
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
        if (!conditions) return;

        const conditionsLower = conditions.toLowerCase();
        const emissionDate = new Date(this.detailsGroup.get('dateEmission')?.value || new Date());
        const previousEcheances = this.echeances.value;

        const getPreservedDate = (index: number, defaultDate: Date): string => {
            const existing = previousEcheances[index];
            if (existing && existing.dateEcheance) {
                if (!this.isSameDay(existing.dateEcheance, emissionDate)) return existing.dateEcheance;
            }
            return defaultDate.toISOString();
        };

        this.echeances.clear();

        if (conditionsLower.includes('comptant') || conditionsLower.includes('espèces')) {
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
            for (let i = 1; i <= months; i++) {
                const targetDate = new Date(emissionDate);
                targetDate.setMonth(targetDate.getMonth() + i);
                const existing = previousEcheances[i - 1];
                this.addEcheance({
                    type: existing?.type || 'CHEQUE',
                    reference: existing?.reference || '',
                    banque: existing?.banque || (supplier.banque || ''),
                    dateEcheance: getPreservedDate(i - 1, targetDate),
                    statut: 'EN_ATTENTE',
                    montant: 0
                });
            }
        } else if (conditionsLower.includes('60 jours') || conditionsLower.includes('60jours')) {
            const totalTTC = this.detailsGroup.get('montantTTC')?.value || 0;
            const splitAmount = Math.floor((totalTTC / 2) * 100) / 100;
            const remainder = Math.round((totalTTC - (splitAmount * 2)) * 100) / 100;
            const d1 = new Date(emissionDate); d1.setMonth(d1.getMonth() + 1);
            const d2 = new Date(emissionDate); d2.setMonth(d2.getMonth() + 2);
            this.addEcheance({ type: 'CHEQUE', dateEcheance: getPreservedDate(0, d1), statut: 'EN_ATTENTE', montant: splitAmount });
            this.addEcheance({ type: 'CHEQUE', dateEcheance: getPreservedDate(1, d2), statut: 'EN_ATTENTE', montant: splitAmount + remainder });
        } else if (conditionsLower.includes('90 jours') || conditionsLower.includes('90jours')) {
            const totalTTC = this.detailsGroup.get('montantTTC')?.value || 0;
            const splitAmount = Math.floor((totalTTC / 3) * 100) / 100;
            const remainder = Math.round((totalTTC - (splitAmount * 3)) * 100) / 100;
            for (let i = 1; i <= 3; i++) {
                const targetDate = new Date(emissionDate);
                targetDate.setMonth(targetDate.getMonth() + i);
                this.addEcheance({
                    type: 'CHEQUE',
                    dateEcheance: getPreservedDate(i - 1, targetDate),
                    statut: 'EN_ATTENTE',
                    montant: (i === 3) ? (splitAmount + remainder) : splitAmount
                });
            }
        } else if (conditionsLower.includes('30 jours') || conditionsLower.includes('30jours')) {
            const targetDate = new Date(emissionDate); targetDate.setMonth(targetDate.getMonth() + 1);
            this.addEcheance({ type: 'CHEQUE', dateEcheance: getPreservedDate(0, targetDate), statut: 'EN_ATTENTE', montant: 0 });
        } else if (conditionsLower.includes('fin de mois')) {
            const targetDate = new Date(emissionDate); targetDate.setMonth(targetDate.getMonth() + 1); targetDate.setDate(0);
            this.addEcheance({ type: 'VIREMENT', dateEcheance: getPreservedDate(0, targetDate), statut: 'EN_ATTENTE', montant: 0 });
        }

        this.updateInvoiceDueDateFromEcheances();
        this.cdr.detectChanges();
        if (!conditionsLower.includes('60 jours') && !conditionsLower.includes('90 jours')) this.redistributeAmountAcrossEcheances();
    }

    private updateInvoiceDueDateFromEcheances() {
        if (this.echeances.length > 0) {
            const dates = this.echeances.controls.map(c => c.get('dateEcheance')?.value).filter(v => !!v).map(v => new Date(v));
            if (dates.length > 0) {
                const maxDate = new Date(Math.max.apply(null, dates.map(d => d.getTime())));
                this.detailsGroup.get('dateEcheance')?.setValue(maxDate, { emitEvent: false });
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
                let amount = (index === echeancesCount - 1) ? (montantParEcheance + remainder) : montantParEcheance;
                control.patchValue({ montant: Math.round(amount * 100) / 100 }, { emitEvent: false });
            });
        }
    }

    autoUpdateStatus() {
        const totalTTC = this.detailsGroup.get('montantTTC')?.value || 0;
        const echeances = this.echeances.value as any[];
        if (!echeances || echeances.length === 0) return;
        const totalPaid = echeances.filter(e => e.statut === 'ENCAISSE').reduce((sum, e) => sum + (e.montant || 0), 0);
        this.paymentGroup.get('statut')?.setValue(totalPaid >= totalTTC && totalTTC > 0 ? 'PAYEE' : 'PARTIELLE', { emitEvent: false });
    }

    calculateFromHT() {
        const ht = Math.round((this.detailsGroup.get('montantHT')?.value || 0) * 100) / 100;
        const taux = this.detailsGroup.get('tauxTVA')?.value || 0;
        const tva = Math.round(ht * (taux / 100) * 100) / 100;
        const ttc = Math.round((ht + tva) * 100) / 100;
        this.detailsGroup.patchValue({ montantHT: ht, montantTVA: tva, montantTTC: ttc }, { emitEvent: false });
    }

    calculateFromTTC() {
        const ttc = Math.round((this.detailsGroup.get('montantTTC')?.value || 0) * 100) / 100;
        const taux = this.detailsGroup.get('tauxTVA')?.value || 0;
        const ht = Math.round((ttc / (1 + taux / 100)) * 100) / 100;
        const tva = Math.round((ttc - ht) * 100) / 100;
        this.detailsGroup.patchValue({ montantHT: ht, montantTVA: tva, montantTTC: ttc }, { emitEvent: false });
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
        group.get('type')?.valueChanges.subscribe(type => {
            const banqueCtrl = group.get('banque');
            if (type === 'ESPECES') {
                banqueCtrl?.clearValidators();
                banqueCtrl?.disable({ emitEvent: false });
            } else {
                banqueCtrl?.setValidators([Validators.required]);
                banqueCtrl?.enable({ emitEvent: false });
            }
            banqueCtrl?.updateValueAndValidity();
        });
        this.echeances.push(group);
    }

    removeEcheance(index: number) { this.echeances.removeAt(index); }

    onSubmit() {
        const isValid = this.isBLMode ? this.detailsGroup.valid : this.form.valid;
        if (isValid) {
            this.submitting = true;
            this.handleSupplierAndSave();
        } else {
            this.detailsGroup.markAllAsTouched();
            this.snackBar.open('Veuillez remplir tous les champs obligatoires', 'Fermer', { duration: 3000 });
        }
    }

    private handleSupplierAndSave() {
        const supplierInput = this.supplierCtrl.value;
        if (!supplierInput) { this.prepareAndSaveInvoice(); return; }
        if (typeof supplierInput === 'object' && supplierInput && 'id' in supplierInput) {
            this.detailsGroup.patchValue({ fournisseurId: (supplierInput as Supplier).id });
            this.prepareAndSaveInvoice();
            return;
        }
        const name = String(supplierInput);
        const existing = this.suppliers.find(s => s.nom.toLowerCase() === name.toLowerCase());
        if (existing) {
            this.detailsGroup.patchValue({ fournisseurId: existing.id });
            this.prepareAndSaveInvoice();
        } else {
            this.financeService.createSupplier({ nom: name }).subscribe({
                next: (newSupplier) => {
                    this.detailsGroup.patchValue({ fournisseurId: newSupplier.id });
                    this.prepareAndSaveInvoice();
                },
                error: () => this.submitting = false
            });
        }
    }

    private async prepareAndSaveInvoice() {
        const detailsData = this.detailsGroup.value;
        const paymentData = this.paymentGroup.value;
        const invoiceData: any = {
            ...detailsData,
            ...paymentData,
            fournisseurId: detailsData.fournisseurId || null,
            dateEcheance: detailsData.dateEcheance || undefined,
            montantHT: Number(detailsData.montantHT),
            montantTVA: Number(detailsData.montantTVA),
            montantTTC: Number(detailsData.montantTTC),
            isBL: this.isBLMode,
            clientId: detailsData.clientId || undefined,
            ficheId: detailsData.ficheId || undefined
        };
        const newAttachments: any[] = [];
        const existingAttachments: string[] = [];
        for (const file of this.attachmentFiles) {
            if (file.file) {
                const base64 = await this.fileToBase64(file.file);
                newAttachments.push({ base64, name: file.name });
            } else if (file.preview) {
                existingAttachments.push(String(file.preview));
            }
        }
        invoiceData.newAttachments = newAttachments;
        invoiceData.existingAttachments = existingAttachments;
        this.saveInvoice(invoiceData);
    }

    private saveInvoice(invoiceData: any) {
        delete invoiceData.tauxTVA;

        if (this.data?.isGrouping && this.data.blIds) {
            // SPECIAL CASE: Consolidating BLs into one Invoice
            this.financeService.groupBLsToInvoice(this.data.blIds, invoiceData).subscribe({
                next: (result) => {
                    this.snackBar.open('Documents groupés avec succès', 'Fermer', { duration: 3000 });
                    this.finalize(result);
                },
                error: (err) => {
                    this.submitting = false;
                    const msg = this.getErrorMessage(err);
                    this.snackBar.open(msg || 'Erreur lors du groupement des documents', 'Fermer', { duration: 7000 });
                }
            });
            return;
        }

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
            // [FIX] Auto-apply modalities if not already done, to ensure correct monthly distribution
            if (this.echeances.length === 0 && this.selectedSupplier) {
                this.applyPaymentConditions(this.selectedSupplier);
                // Update local invoiceData with new echeances
                invoiceData.echeances = this.echeances.getRawValue();
            }

            // Before creating invoice, check expense ceiling for EACH month affected by echeances
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            // 1. Group impact by Month
            const impacts: { month: number, year: number, amount: number, key: string }[] = [];
            (invoiceData.echeances || []).forEach((ech: any) => {
                const date = new Date(ech.dateEcheance);
                const m = date.getMonth();
                const y = date.getFullYear();
                const key = `${y}-${m}`;

                let impact = impacts.find(i => i.key === key);
                if (!impact) {
                    impact = { month: m, year: y, amount: 0, key };
                    impacts.push(impact);
                }
                impact.amount += (Number(ech.montant) || 0);
            });

            // Default to current month if no installments
            if (impacts.length === 0) {
                impacts.push({ month: currentMonth, year: currentYear, amount: Number(invoiceData.montantTTC) || 0, key: `${currentYear}-${currentMonth}` });
            }

            const centreId = invoiceData.centreId || this.currentCentre()?.id;

            if (centreId) {
                // Fetch context for current Month and Yearly Projection
                forkJoin({
                    summary: this.financeService.getTreasurySummary(currentYear, currentMonth + 1, centreId),
                    projection: this.financeService.getYearlyProjection(currentYear, centreId)
                }).pipe(
                    switchMap(({ summary, projection }) => {
                        const threshold = summary?.monthlyThreshold || 50000;

                        // Check each impacted month
                        for (const impact of impacts) {
                            let baseExpenses = 0;
                            if (impact.month === currentMonth && impact.year === currentYear) {
                                // USE totalScheduled for dash consistency
                                baseExpenses = summary.totalScheduled || 0;
                            } else if (impact.year === currentYear) {
                                baseExpenses = projection[impact.month]?.totalExpenses || 0;
                            }

                            const totalWithEntry = baseExpenses + impact.amount;

                            if (totalWithEntry > threshold) {
                                const dialogRef = this.dialog.open(CeilingWarningDialogComponent, {
                                    width: '600px',
                                    disableClose: true,
                                    data: {
                                        amount: impact.amount,
                                        currentDetails: {
                                            totalExpenses: baseExpenses, // Mapping to totalScheduled logic
                                            monthlyThreshold: threshold,
                                            balance: summary.balance
                                        },
                                        projection: projection,
                                        currentMonth: impact.month,
                                        currentYear: impact.year
                                    }
                                });
                                return dialogRef.afterClosed();
                            }
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
                        // This moves only the overflowing month echeances? 
                        // Simplification: move ALL installments of the "first failed month" to the new date.
                        // But for now, let's keep the existing logic that moves current month items.
                        (invoiceData.echeances || []).forEach((ech: any) => {
                            const d = new Date(ech.dateEcheance);
                            // If we rescheduled, we move the echeances of the month that caused the warning
                            // For simplicity, we just assume the first failed month was the target.
                            // Better: match the month from warning data.
                        });
                        invoiceData.dateEcheance = targetDateStr;
                    }
                    this.createInvoiceAfterCeilingCheck(invoiceData);
                });
            } else {
                this.createInvoiceAfterCeilingCheck(invoiceData);
            }
        }
    }

    private createInvoiceAfterCeilingCheck(invoiceData: any) {
        this.financeService.createInvoice(invoiceData).subscribe({
            next: res => {
                this.snackBar.open('Enregistrement réussi', 'Fermer', { duration: 3000 });

                // CHECK FOR IMMEDIATE PAYMENT (ONLY FOR NEW BL)
                const directPayment = this.form.get('directPayment')?.value;
                if (directPayment?.paidImmediately && this.isBLMode) {
                    const expenseData = {
                        date: invoiceData.dateEmission,
                        montant: invoiceData.montantTTC,
                        categorie: invoiceData.type,
                        modePaiement: directPayment.modePaiement,
                        centreId: invoiceData.centreId || this.currentCentre()?.id,
                        description: `Règlement immédiat BL ${res.numeroFacture}`,
                        statut: 'VALIDEE',
                        reference: directPayment.banque || res.numeroFacture,
                        banque: directPayment.banque,
                        fournisseurId: res.fournisseurId,
                        factureFournisseurId: res.id
                    };

                    this.financeService.createExpense(expenseData).subscribe({
                        next: () => console.log('[BL-PAYMENT] Immediate payment recorded'),
                        error: (err) => {
                            console.error('[BL-PAYMENT] Error recording immediate payment', err);
                            this.snackBar.open('BL créé mais erreur lors du règlement immédiat', 'OK', { duration: 5000 });
                        }
                    });
                }

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

    private fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    }

}
