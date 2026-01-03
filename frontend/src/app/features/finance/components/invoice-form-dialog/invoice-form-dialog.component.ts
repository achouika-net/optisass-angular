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
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CameraCaptureDialogComponent } from '../../../../shared/components/camera-capture/camera-capture-dialog.component';
import { MatDialog } from '@angular/material/dialog';

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
                clientId: [data?.invoice?.clientId || (data as any)?.prefilledClientId || ''],
            }),
            payment: this.fb.group({
                echeances: this.fb.array([]),
                statut: [data?.invoice?.statut || 'EN_ATTENTE', Validators.required]
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
        return !!this.detailsGroup.get('clientId')?.value;
    }

    ngOnInit() {
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
                        pieceJointeUrl: invoice.pieceJointeUrl,
                        clientId: invoice.clientId
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

                this.autoUpdateStatus();

                if (this.isViewMode) {
                    this.form.disable();
                    this.supplierCtrl.disable();
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

                // If editing and has provider
                const currentId = this.detailsGroup.get('fournisseurId')?.value;
                if (currentId) {
                    const s = this.suppliers.find(x => x.id === currentId);
                    if (s) this.supplierCtrl.setValue(s.nom);
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
        console.log('[InvoiceForm] ========== onSupplierChange CALLED ==========');

        this.selectedSupplier = this.suppliers.find(s => s.id === id) || null;

        // Auto-schedule payment terms if available and creating new invoice logic
        if (this.selectedSupplier && this.echeances.length === 0 && !this.isEditMode) {
            const echeanceArray = this.selectedSupplier.convention?.echeancePaiement || [];
            const conditions = (echeanceArray[0] || this.selectedSupplier.conditionsPaiement2 || this.selectedSupplier.conditionsPaiement || '').trim();

            if (!conditions) return;

            const conditionsLower = conditions.toLowerCase();
            let finalDate = new Date(); // Default basis

            if (conditionsLower === 'comptant' || conditionsLower === 'espèces') {
                this.addEcheance({
                    type: 'ESPECES',
                    dateEcheance: finalDate.toISOString(),
                    statut: 'EN_ATTENTE',
                    montant: 0
                });
            } else if (conditionsLower.includes('30 jours') || conditionsLower.includes('30jours')) {
                finalDate.setDate(finalDate.getDate() + 30);
                this.addEcheance({
                    type: 'CHEQUE',
                    dateEcheance: finalDate.toISOString(),
                    statut: 'EN_ATTENTE',
                    montant: 0
                });
            } else if (conditionsLower.includes('60 jours') || conditionsLower.includes('60jours')) {
                finalDate.setDate(finalDate.getDate() + 60);
                // Generate 2 payments: 30, 60 days
                for (let i = 1; i <= 2; i++) {
                    const date = new Date();
                    date.setDate(date.getDate() + (30 * i));
                    this.addEcheance({
                        type: 'LCN',
                        dateEcheance: date.toISOString(),
                        statut: 'EN_ATTENTE',
                        montant: 0
                    });
                }
            } else if (conditionsLower.includes('90 jours') || conditionsLower.includes('90jours')) {
                finalDate.setDate(finalDate.getDate() + 90);
                // Generate 3 payments: 30, 60, 90 days
                for (let i = 1; i <= 3; i++) {
                    const date = new Date();
                    date.setDate(date.getDate() + (30 * i));
                    this.addEcheance({
                        type: 'CHEQUE',
                        dateEcheance: date.toISOString(),
                        statut: 'EN_ATTENTE',
                        montant: 0
                    });
                }
            } else if (conditionsLower.includes('fin de mois')) {
                // Last day of current month
                finalDate.setMonth(finalDate.getMonth() + 1);
                finalDate.setDate(0);
                this.addEcheance({
                    type: 'VIREMENT',
                    dateEcheance: finalDate.toISOString(),
                    statut: 'EN_ATTENTE',
                    montant: 0
                });
            }

            // Fix 1: Always update the invoice due date
            this.detailsGroup.get('dateEcheance')?.setValue(finalDate);

            // Fix 2: Always trigger redistribution to set amounts
            // This ensures that even if montantTTC was already set, the new installments get their share
            this.redistributeAmountAcrossEcheances();
        }
    }

    private redistributeAmountAcrossEcheances() {
        const montantTTC = this.detailsGroup.get('montantTTC')?.value || 0;
        const echeancesCount = this.echeances.length;

        if (echeancesCount > 0 && montantTTC > 0) {
            const montantParEcheance = Math.round((montantTTC / echeancesCount) * 100) / 100;

            this.echeances.controls.forEach((control, index) => {
                control.patchValue({ montant: montantParEcheance }, { emitEvent: false });
            });

            console.log(`[InvoiceForm] Redistributed ${montantTTC} MAD across ${echeancesCount} installments (${montantParEcheance} each)`);
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
            this.handleSupplierAndSave();
        } else {
            this.form.markAllAsTouched();
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
            }
        });
    }

    private saveInvoice() {
        const detailsData = this.detailsGroup.value;
        const paymentData = this.paymentGroup.value;

        const invoiceData = {
            ...detailsData,
            ...paymentData
        };

        delete invoiceData.tauxTVA;

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
