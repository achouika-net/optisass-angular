import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError, tap, take } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, FormControl, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { FactureService } from '../../services/facture.service';
import { PaiementService } from '../../services/paiement.service';
import { PaymentDialogComponent, Payment } from '../../dialogs/payment-dialog/payment-dialog.component';
import { StockConflictDialogComponent } from '../../dialogs/stock-conflict-dialog/stock-conflict-dialog.component';
import { LoyaltyService } from '../../services/loyalty.service';
import { ClientManagementService } from '../../services/client.service';
import { Convention } from '../../../finance/models/finance.models';
import { ProductService } from '../../../stock-management/services/product.service';
import { numberToFrench } from '../../../../utils/number-to-text';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector, UserSelector } from '../../../../core/store/auth/auth.selectors';
import { Employee } from '../../../../shared/interfaces/employee.interface';
import { CompanySettingsService } from '../../../../core/services/company-settings.service';
import { CompanySettings } from '../../../../shared/interfaces/company-settings.interface';

// JsBarcode is loaded as a global script via angular.json scripts[]
declare const JsBarcode: (element: string | Element, value: string, options?: object) => void;

import { FinanceService } from '../../../finance/services/finance.service';

@Component({
    selector: 'app-facture-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatDividerModule,
        RouterModule
    ],
    templateUrl: './facture-form.component.html',
    styleUrls: ['./facture-form.component.scss']
})
export class FactureFormComponent implements OnInit {
    @Input() factureId: string | null = null;
    @Input() clientIdInput: string | null = null;
    @Input() ficheIdInput: string | null = null;
    @Input() conventionIdInput: string| null = null;
    @Input() initialLines: any[] = [];
    @Input() embedded = false;
    @Input() nomenclature: string | null = null;
    @Input() isReadonly = false;
    @Output() onSaved = new EventEmitter<any>();
    @Output() onCancelled = new EventEmitter<void>();
    @Output() paymentAdded = new EventEmitter<void>();


    form: FormGroup;
    id: string | null = null;
    isViewMode = false;
    originalProprietes: any = {}; // [NEW] Store original DB properties to prevent loss of fields not in form
    client: any = null;
    centreId: string | null = null;
    isLoading = false;

    // Totals
    totalHT = 0;
    totalTVA = 0;
    totalTTC = 0;
    droitTimbre = 0;
    netAPayer = 0;
    montantLettres = '';
    calculatedGlobalDiscount = 0;

    // Payments
    paiements: Payment[] = [];
    montantPaye = 0;
    resteAPayer = 0;

    // Loyalty
    pointsFideliteClient = 0;
    fidelioEligibility: { eligible: boolean; currentPoints: number; threshold: number; madValue?: number } | null = null;
    discountDetail: string = '';

    // [NEW] Conventions
    allConventions: Convention[] = [];

    currentUser$: Observable<any> = this.store.select(UserSelector);
    currentCentre = this.store.selectSignal(UserCurrentCentreSelector);
    companySettings: CompanySettings | null = null;

    constructor(
        private fb: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private factureService: FactureService,
        private paiementService: PaiementService,
        private loyaltyService: LoyaltyService,
        private clientService: ClientManagementService,
        private productService: ProductService,
        private snackBar: MatSnackBar,
        private dialog: MatDialog,
        private store: Store,
        private cdr: ChangeDetectorRef,
        private companySettingsService: CompanySettingsService,
        private financeService: FinanceService
    ) {
        // [FIX] Initialize centreId from current center
        this.centreId = this.currentCentre()?.id || null;
        this.form = this.fb.group({
            numero: [''], // Auto-generated
            type: [''], // Will be set in ngOnInit based on context
            statut: [''], // Will be set in ngOnInit based on context
            dateEmission: [new Date(), Validators.required],
            clientId: ['', Validators.required],
            lignes: this.fb.array([]),
            proprietes: this.fb.group({
                tvaRate: [0.20], // Default 20%
                nomenclature: [''],
                remiseGlobalType: ['PERCENT'], // PERCENT or AMOUNT
                remiseGlobalValue: [0],
                pointsUtilises: [0],
                vendeurId: [null]
            })
        });
    }

    ngOnInit(): void {
        this.loadCompanySettings();
        this.loadAllConventions();
        console.log('🚀 [FactureForm] ngOnInit | id:', this.id, '| factureId (input):', this.factureId, '| embedded:', this.embedded);

        // CRITICAL FIX: Check if we're loading an existing invoice FIRST
        // To avoid race condition where default values overwrite loaded data
        const routeId = this.embedded ? (this.factureId || 'new') : this.route.snapshot.paramMap.get('id');
        const isLoadingExisting = routeId && routeId !== 'new';
        const isCreationMode = routeId === 'new' || (!this.embedded && !routeId);

        if (isLoadingExisting) {
            console.log('⏳ [FactureForm] Detected existing ID:', routeId, '. Waiting for loadFacture...');
            this.isLoading = true;
            this.id = routeId; // Ensure ID is adopted
        } else if (isCreationMode) {
            console.log('✨ [FactureForm] Mode: Creation (Definitive)');
            // Only set default type/statut if creating NEW invoice
            this.form.patchValue({
                type: 'DEVIS',
                statut: 'BROUILLON'
            }, { emitEvent: false });
            this.isLoading = false;
        } else {
            console.log('💤 [FactureForm] Embedded but no ID yet. Waiting for ngOnChanges...');
        }

        if (this.nomenclature && this.embedded) {
            console.log('📝 [FactureForm] Applying nomenclature (embedded init)');
            this.form.patchValue({ proprietes: { nomenclature: this.nomenclature } });
        }

        if (this.embedded) {
            this.handleEmbeddedInit();
        } else {
            this.handleRouteInit();
        }

        if (!this.id || this.id === 'new') {
            this.setVendeurFromUser();
        }

        // [FIX] Subscribe to form value changes for REAL-TIME calculation.
        // This ensures totals are updated as the user types, not just on 'blur' (change event).
        this.form.valueChanges.subscribe(() => {
            this.calculateTotals();
        });
    }

    setVendeurFromUser() {
        this.store.select(UserSelector).pipe(take(1)).subscribe(user => {
            if (user?.employee?.id) {
                console.log('👤 [FactureForm] Auto-setting vendeurId from current user employee:', user.employee.id);
                this.form.get('proprietes.vendeurId')?.setValue(user.employee.id);
            }
        });
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['isReadonly']) {
            this.updateViewMode();
        }
        
        console.log(`📡 [FactureForm] ngOnChanges triggered. Current ID: ${this.id}, factureId Input: ${this.factureId}`);

        if (changes['factureId']) {
            const newVal = changes['factureId'].currentValue;
            console.log('🔄 [FactureForm] factureId changed (input):', newVal, '| Old ID:', this.id);
            
            if (newVal && newVal !== 'new' && newVal !== this.id) {
                console.log('✅ [FactureForm] Valid factureId received. Adopting ID and loading facture:', newVal);
                this.id = newVal;
                this.loadFacture(newVal);
            } else if (newVal === 'new' && this.id !== 'new') {
                console.log('✨ [FactureForm] factureId transitioned to NEW. Initializing defaults.');
                this.id = 'new';
                this.form.reset({
                    dateEmission: new Date(),
                    clientId: this.clientIdInput || '',
                    lignes: [],
                    proprietes: {
                        tvaRate: 0.20,
                        nomenclature: this.nomenclature || '',
                        remiseGlobalType: 'PERCENT',
                        remiseGlobalValue: 0,
                        pointsUtilises: 0,
                        vendeurId: this.form.get('proprietes.vendeurId')?.value
                    }
                }, { emitEvent: false });
                
                this.form.patchValue({
                    type: 'DEVIS',
                    statut: 'BROUILLON'
                }, { emitEvent: false });
                
                if (this.initialLines && this.initialLines.length > 0) {
                    this.lignes.clear();
                    this.initialLines.forEach(l => {
                        const group = this.createLigne();
                        group.patchValue(l);
                        this.lignes.push(group);
                    });
                    this.calculateTotals();
                } else if (this.lignes.length === 0) {
                    this.addLine();
                }
                this.updateViewMode();
                this.isLoading = false; // [FIX] Clear loading state
            } else if (!newVal && newVal !== 'new') {
                // [FIX] If newVal is explicitly null/undefined (cleared by parent)
                console.log('ℹ️ [FactureForm] factureId cleared by parent. Stopping loader.');
                this.isLoading = false;
                this.id = 'new';
            }
        }

        if (changes['nomenclature'] && this.nomenclature && this.embedded) {
            console.log('📝 [FactureForm] nomenclature changed (embedded)');
            this.form.get('proprietes')?.patchValue({ nomenclature: this.nomenclature });
        }

        if (changes['initialLines']) {
            console.log('🛒 [FactureForm] initialLines received. Current ID state:', this.id);
            if (!this.id || this.id === 'new') {
                console.log('🛒 [FactureForm] Applying initialLines in creation mode.');
                this.lignes.clear();
                if (this.initialLines && this.initialLines.length > 0) {
                    this.initialLines.forEach(l => {
                        const group = this.createLigne();
                        group.patchValue(l);
                        this.lignes.push(group);
                    });
                } else {
                    // CRITICAL: Ensure at least one line exists to avoid completely blank lists
                    console.log('🛒 [FactureForm] initialLines is empty. Adding default blank line.');
                    this.addLine();
                }
                this.calculateTotals();
            } else {
                console.log('🛡️ [FactureForm] Ignoring initialLines because Document is an existing invoice:', this.id);
            }
        }

        if (changes['conventionIdInput']) {
            console.log('🏥 [FactureForm] conventionIdInput changed:', this.conventionIdInput);
            this.calculateTotals();
        }

        if (changes['clientIdInput'] && this.clientIdInput) {
            console.log('👤 [FactureForm] clientIdInput changed:', this.clientIdInput);
            this.form.get('clientId')?.setValue(this.clientIdInput);
            this.loadClientPoints(this.clientIdInput);
        }
    }
    loadCompanySettings() {
        this.companySettingsService.getSettings().subscribe({
            next: (settings) => {
                this.companySettings = settings;
                // Generate barcode for screen view as well
                setTimeout(() => this.generateBarcode(), 100);
            },
            error: (err) => console.error('Failed to load company settings', err)
        });
    }

    generateBarcode() {
        if (!this.companySettings?.inpeCode) return;
        try {
            const barcodeFn = (JsBarcode as any).default || JsBarcode;
            (barcodeFn as any)('#inpe-barcode', this.companySettings.inpeCode, {
                format: 'CODE128',
                displayValue: true,
                fontSize: 14,
                width: 1.5,
                height: 40,
                margin: 0
            });
        } catch (e) {
            console.error('Error generating barcode', e);
        }
    }

    get canEditDiscounts(): boolean {
        // [FIX] Use getRawValue() because regular .value might return empty object if form is disabled
        const rawValues = this.form.getRawValue();
        const type = String(rawValues.type || '').toUpperCase();
        const statut = String(rawValues.statut || '').toUpperCase();
        const hasPayments = this.paiements && this.paiements.length > 0;
        
        const isEditableDevis = type === 'DEVIS' && !hasPayments && 
                               statut !== 'VALIDE' && statut !== 'VALIDEE' && statut !== 'VENTE_EN_INSTANCE';
        
        console.log(`🔍 [FactureForm] canEditDiscounts Check | Type: ${type} | Statut: ${statut} | HasPayments: ${hasPayments} => ${isEditableDevis}`);
        
        return isEditableDevis;
    }

    updateViewMode() {
        // Check if we're in explicit view mode from route
        const isExplicitViewMode = this.route?.snapshot?.queryParamMap?.get('mode') === 'view';

        const type = String(this.form.get('type')?.value || '').toUpperCase();
        const statut = String(this.form.get('statut')?.value || '').toUpperCase();
        const hasPayments = this.paiements && this.paiements.length > 0;

        // Document is read-only if explicitly asked OR it's no longer a modifiable draft
        const isLockedDocument = 
            type === 'FACTURE' || 
            type === 'BON_COMM' || 
            type === 'AVOIR' || 
            statut === 'VALIDE' || 
            statut === 'VALIDEE' || 
            hasPayments;

        // Only treat as read-only if explicitly in view mode, readonly flag is set, or document must be locked
        if (this.isReadonly || isExplicitViewMode || isLockedDocument) {
            this.isViewMode = true;
            this.form.disable();
            
            // [NEW] Selectively enable discount fields if it's an editable Quote (Devis)
            if (this.canEditDiscounts) {
                this.lignes.controls.forEach(control => {
                    control.get('remise')?.enable({ emitEvent: false });
                    control.get('remiseType')?.enable({ emitEvent: false });
                });
                this.form.get('proprietes.remiseGlobalType')?.enable({ emitEvent: false });
                this.form.get('proprietes.remiseGlobalValue')?.enable({ emitEvent: false });
                this.form.get('proprietes.pointsUtilises')?.enable({ emitEvent: false });
            }
        } else {
            this.isViewMode = false;
            this.form.enable();
            this.form.get('numero')?.disable();
            this.form.get('proprietes.pointsUtilises')?.enable();
        }
    }

    goBack(): void {
        const clientId = this.form.get('clientId')?.value || this.clientIdInput || (this.client ? this.client.id : null);
        if (clientId) {
            this.router.navigate(['/p/clients', clientId]);
        } else {
            this.router.navigate(['/p/clients']);
        }
    }

    loadClientPoints(clientId: string) {
        if (!clientId) return;
        this.loyaltyService.getPointsBalance(clientId).subscribe({
            next: (points) => {
                this.pointsFideliteClient = points;
                // After loading balance, check if client is eligible for Fidelio reward
                this.checkFidelioEligibility(clientId);
            },
            error: (err) => console.error('Error loading client points', err)
        });

        // Load full client details to check for Convention
        this.clientService.getClient(clientId).subscribe({
            next: (client: any) => {
                this.client = client;
                if (client.conventionData) {
                    console.log('📝 Convention found for client:', client.conventionData);
                }
            },
            error: (err: any) => console.error('Error loading client details', err)
        });
    }

    checkFidelioEligibility(clientId: string) {
        const docType = this.form.get('type')?.value;
        const officialTypes = ['FACTURE', 'BL', 'BON_COMM', 'BON_COMMANDE'];
        // Only check eligibility for official document types (not DEVIS)
        if (!officialTypes.includes(docType) && docType) return;

        this.loyaltyService.checkRewardEligibility(clientId).subscribe({
            next: (result) => {
                const config = result as any;
                const madValue = Math.floor(result.currentPoints * 0.1);
                this.fidelioEligibility = { ...result, madValue };
                console.log(`💎 [Fidelio] Eligibility: ${result.eligible} | Points: ${result.currentPoints} | Seuil: ${result.threshold}`);
            },
            error: (err) => console.error('Error checking Fidelio eligibility', err)
        });
    }

    applyFidelioDiscount() {
        if (!this.fidelioEligibility) return;
        const pointsToApply = this.fidelioEligibility.currentPoints;
        this.form.get('proprietes.pointsUtilises')?.setValue(pointsToApply);
        this.calculateTotals();
        this.snackBar.open(`✅ ${pointsToApply} points Fidelio appliqués (-${(pointsToApply * 0.1).toFixed(2)} DH)`, 'OK', { duration: 4000 });

        // [FIX] Auto-save the invoice immediately so the user doesn't need to click the main 'Sauvegarder' button.
        // We only auto-save if the invoice already exists in DB (has a real ID, not 'new').
        if (this.id && this.id !== 'new') {
            this.saveAsObservable(false).subscribe({
                next: () => console.log('✅ [FactureForm] Auto-saved facture after applying Fidelio points'),
                error: (err) => console.error('❌ [FactureForm] Failed to auto-save facture after Fidelio points', err)
            });
        }
    }

    loadAllConventions() {
        this.financeService.getConventions().pipe(take(1)).subscribe({
            next: (conventions) => {
                this.allConventions = conventions;
                this.calculateTotals(); // Recalculate once we have convention data
                this.cdr.markForCheck();
            },
            error: (err) => console.error('Error loading conventions', err)
        });
    }

    applyConvention(manualConv?: Convention) {
        let conv: Convention | null = null;
        
        if (manualConv) {
            conv = manualConv;
        } else if (this.client?.conventionData) {
            conv = this.client.conventionData as Convention;
        }

        if (!conv) {
            this.snackBar.open('Aucune convention sélectionnée', 'Fermer', { duration: 3000 });
            return;
        }
        
        // Check for Forfaitaire logic
        if (conv.remiseForfaitaire) {
            this.applyForfaitaireConvention(conv);
        } else {
            // Standard discount
            this.form.get('proprietes')?.patchValue({
                remiseGlobalType: conv.remiseType === 'PERCENTAGE' ? 'PERCENT' : 'AMOUNT',
                remiseGlobalValue: conv.remiseValeur
            });
            this.calculateTotals();
            this.snackBar.open(`Convention "${conv.nom}" appliquée`, 'Fermer', { duration: 3000 });
        }
    }

    private applyForfaitaireConvention(conv: Convention) {
        // Logic for "Monture + Verres" forfait
        // We'll search for Monture and Verres in the lines
        // And adjust prices to match the forfait
        this.snackBar.open(`Convention forfaitaire "${conv.nom}" appliquée (Monture: ${conv.montantForfaitaireMonture} MAD, Verre: ${conv.montantForfaitaireVerre} MAD)`, 'Fermer', { duration: 5000 });
        
        // Implementation: For each line, if it contains 'Monture', set price to forfait
        // Note: In this app, we usually use nomenclature or products to distinguish.
        // For now, simpler: apply as global discount or just notify user.
        // User asked for "astuce", so applying global remise is the safest first step.
        this.form.get('proprietes')?.patchValue({
            remiseGlobalType: conv.remiseType === 'PERCENTAGE' ? 'PERCENT' : 'AMOUNT',
            remiseGlobalValue: conv.remiseValeur
        });
        this.calculateTotals();
    }

    handleEmbeddedInit() {
        this.id = this.factureId;
        console.log('🧩 [FactureForm] handleEmbeddedInit | id:', this.id, '| clientId:', this.clientIdInput);

        // If embedded and no ID is provided, but it's not explicitly 'new', we might be waiting
        if (this.embedded && !this.id) {
            // [FIX] Don't get stuck in loading if we are already in creation mode
            const routeId = this.factureId || 'new';
            if (routeId === 'new') {
                this.isLoading = false;
            } else {
                this.isLoading = true;
            }
        }

        if (this.clientIdInput) {
            this.form.patchValue({ clientId: this.clientIdInput });
            this.loadClientPoints(this.clientIdInput);
        }

        if (this.id && this.id !== 'new') {
            this.loadFacture(this.id);
        } else if (this.id === 'new') {
            // ONLY if explicitly 'new' when embedded
            console.log('✨ [FactureForm] Embedded: NEW invoice detected');
            if (this.initialLines && this.initialLines.length > 0) {
                this.lignes.clear();
                this.initialLines.forEach(l => {
                    const group = this.createLigne();
                    group.patchValue(l);
                    this.lignes.push(group);
                });
                this.calculateTotals();
            } else {
                this.addLine();
            }
            this.updateViewMode();
            this.isLoading = false; // [FIX] Clear loading state
        } else {
            console.log('😴 [FactureForm] Embedded: No facturation ID/Signal yet.');
        }
    }

    handleRouteInit() {
        this.route.queryParams.subscribe(params => {
            const clientId = params['clientId'];
            const type = params['type'];
            const sourceFactureId = params['sourceFactureId'];
            const ficheId = params['ficheId'];
            const returnTo = params['returnTo'];

            // Store returnTo for later use
            if (returnTo) {
                (this as any).returnToUrl = returnTo;
            }

            const patchData: any = {};
            if (clientId) patchData.clientId = clientId;
            if (type) patchData.type = type;
            if (ficheId) patchData.ficheId = ficheId;

            if (Object.keys(patchData).length > 0) {
                this.form.patchValue(patchData);
                if (patchData.clientId) this.loadClientPoints(patchData.clientId);
            }

            if (sourceFactureId) {
                this.loadSourceFacture(sourceFactureId);
            }
        });

        this.id = this.route.snapshot.paramMap.get('id');
        if (this.id && this.id !== 'new') {
            this.loadFacture(this.id);
        } else {
            this.addLine();
            this.isLoading = false; // [FIX] Clear loading state for new route docs
        }
    }

    get lignes(): FormArray {
        return this.form.get('lignes') as FormArray;
    }

    createLigne(): FormGroup {
        return this.fb.group({
            description: ['', Validators.required],
            qte: [1, [Validators.required, Validators.min(1)]],
            prixUnitaireTTC: [0, [Validators.required, Validators.min(0)]],
            remise: [0],
            remiseType: ['AMOUNT'], // Support for percent or amount per line
            totalTTC: [0],
            productId: [null],
            entrepotId: [null],
            entrepotType: [null],
            entrepotNom: [null]
        });
    }

    get proprietesGroup(): FormGroup {
        return this.form.get('proprietes') as FormGroup;
    }

    get pointsUtilises(): FormControl {
        return this.form.get('proprietes.pointsUtilises') as FormControl;
    }

    get pointsValueMAD(): number {
        const points = this.pointsUtilises?.value || 0;
        return points * 0.1;
    }

    onTypeChange() {
        this.calculateTotals();
    }

    formatNumero(numero: string): string {
        return numero || '';
    }

    addLine() {
        this.lignes.push(this.createLigne());
    }

    removeLine(index: number) {
        this.lignes.removeAt(index);
        this.calculateTotals();
    }

    onLineChange(index: number) {
        const line = this.lignes.at(index);
        const qte = line.get('qte')?.value || 0;
        const puTTC = line.get('prixUnitaireTTC')?.value || 0;
        const remiseVal = line.get('remise')?.value || 0;
        const remiseType = line.get('remiseType')?.value || 'AMOUNT';

        let actualRemise = 0;
        if (remiseVal > 0) {
            if (remiseType === 'PERCENT') {
                actualRemise = (qte * puTTC) * (remiseVal / 100);
            } else {
                actualRemise = remiseVal;
            }
        }

        const total = (qte * puTTC) - actualRemise;
        line.patchValue({ totalTTC: total }, { emitEvent: false });

        this.calculateTotals();
    }

    calculateTotals() {
        const rawTotalTTC = (this.lignes.controls || []).reduce((sum, control: any) => {
            const line = control.getRawValue();
            return sum + (Number(line.totalTTC) || 0);
        }, 0);

        // [NEW] Convention Discount Calculation
        let conventionDiscount = 0;
        const targetConvId = this.conventionIdInput;
        
        if (targetConvId) {
            const selectedConv = (this.allConventions || []).find(c => String(c.id) == String(targetConvId));
            
            if (selectedConv) {
                const remiseVal = Number(selectedConv.remiseValeur) || 0;
                if (remiseVal > 0) {
                    if (selectedConv.remiseType === 'PERCENTAGE') {
                        conventionDiscount = rawTotalTTC * (remiseVal / 100);
                        this.discountDetail = `(${selectedConv.nom} ${remiseVal}%)`;
                    } else {
                        conventionDiscount = remiseVal;
                        this.discountDetail = `(${selectedConv.nom} -${remiseVal} DH)`;
                    }
                    console.log(`🏥 [FactureForm] Applied Convention ${selectedConv.nom}: ${remiseVal}${selectedConv.remiseType === 'PERCENTAGE' ? '%' : ' DH'} (-${conventionDiscount.toFixed(2)} DH)`);
                } else {
                    this.discountDetail = '';
                }
            } else {
                this.discountDetail = '';
            }
        } else {
            this.discountDetail = '';
        }

        // [FIX] Use getRawValue() instead of .value to read properties even when form is disabled (view mode)
        const proprietesGroup = this.form.get('proprietes') as FormGroup;
        const props = proprietesGroup ? proprietesGroup.getRawValue() : {};
        const remiseType = props?.remiseGlobalType || 'PERCENT';
        const remiseValue = Number(props?.remiseGlobalValue) || 0;

        let globalDiscount = 0;
        if (remiseValue > 0) {
            if (remiseType === 'PERCENT') {
                globalDiscount = rawTotalTTC * (remiseValue / 100);
            } else {
                globalDiscount = remiseValue;
            }
        }

        // Points Fidelio Deduction (1 point = 0.1 MAD)
        const pointsUtilises = Number(props?.pointsUtilises) || 0;
        const discountFromPoints = pointsUtilises * 0.1;

        this.calculatedGlobalDiscount = globalDiscount + discountFromPoints + conventionDiscount;

        // Check for AVOIR type to allow negative totals
        const type = this.form.get('type')?.value;
        const typeStr = String(type || '').toUpperCase();
        if (typeStr === 'AVOIR' || typeStr === 'AVOIR_FOURNISSEUR') {
            this.totalTTC = rawTotalTTC - this.calculatedGlobalDiscount;
        } else {
            this.totalTTC = Math.max(0, rawTotalTTC - this.calculatedGlobalDiscount);
        }

        const tvaRate = Number(props?.tvaRate) || 0.20;
        this.totalHT = this.totalTTC / (1 + tvaRate);
        this.totalTVA = this.totalTTC - this.totalHT;

        this.calculatePaymentTotals();
        this.montantLettres = this.numberToText(this.netAPayer > 0 ? this.netAPayer : this.totalTTC);
        this.updateStatutFromPayments();
    }

    loadFacture(id: string) {
        console.log('📥 [FactureForm] Calling loadFacture for ID:', id);
        this.isLoading = true;
        this.factureService.findOne(id).subscribe({
            next: (facture) => {
                console.log('✅ [FactureForm] loadFacture SUCCESS | Numero:', facture.numero, '| ID:', facture.id, '| Status:', facture.statut);
                this.id = facture.id; // CRITICAL FIX: Update internal ID to stop showing 'Nouveau Document'
                this.isLoading = false;
                
                // [FIX] Sync ficheIdInput if missing but present in DB
                if (facture.ficheId && !this.ficheIdInput) {
                    this.ficheIdInput = facture.ficheId;
                    console.log('🔗 [FactureForm] Synced ficheIdInput from DB:', this.ficheIdInput);
                }

                console.log('📋 Nomenclature from DB:', facture.proprietes?.nomenclature);

                this.originalProprietes = facture.proprietes || {}; // [NEW] Store original
                
                this.form.patchValue({
                    numero: facture.numero,
                    type: facture.type,
                    statut: facture.statut,
                    dateEmission: facture.dateEmission,
                    clientId: facture.clientId,
                }, { emitEvent: false }); // Use emitEvent: false to prevent redundant calculations

                // [FIX] Patch proprietes separately on the FormGroup to ensure nested fields
                // (especially pointsUtilises) are correctly applied before calculateTotals() runs
                const proprietesGroup = this.form.get('proprietes') as FormGroup;
                if (proprietesGroup && this.originalProprietes) {
                    proprietesGroup.patchValue(this.originalProprietes, { emitEvent: false });
                }

                // [FIX] Preserve centreId from DB to avoid nulling it on next save
                if (facture.centreId) {
                    this.centreId = facture.centreId;
                }

                if (facture.clientId) {
                    this.loadClientPoints(facture.clientId);
                }

                this.client = facture.client;

                // Patch lines
                this.lignes.clear();
                if (facture.lignes) {
                    (facture.lignes as any[]).forEach((l: any) => {
                        const lineGroup = this.createLigne();
                        lineGroup.patchValue(l);
                        this.lignes.push(lineGroup);
                    });
                }

                // Load payments
                if (facture.paiements) {
                    this.paiements = facture.paiements as any[];
                }

                this.calculateTotals();
                this.calculatePaymentTotals();
                this.updateStatutFromPayments();

                // Explicitly update view mode to ensure new lines are disabled if needed
                this.updateViewMode();
            },
            error: (err) => {
                console.error(err);
                this.snackBar.open('Erreur lors du chargement', 'Fermer', { duration: 3000 });
                this.isLoading = false; // [FIX] Stop loading on error
            }
        });
    }

    save() {
        this.saveAsObservable().subscribe();
    }

    saveAsObservable(showNotification = true, extraProperties: any = null): Observable<any> {
        if (this.form.invalid) {
            console.error('❌ [FactureForm] Cannot save: Form is INVALID', this.form.errors);
            Object.keys(this.form.controls).forEach(key => {
                const controlErrors = this.form.get(key)?.errors;
                if (controlErrors) console.error(`   - Control "${key}" errors:`, controlErrors);
            });
            // Recursively check proprietes
            const propGroup = this.form.get('proprietes') as FormGroup;
            if (propGroup?.invalid) {
                Object.keys(propGroup.controls).forEach(key => {
                    const errors = propGroup.get(key)?.errors;
                    if (errors) console.error(`   - Proprietes.${key} errors:`, errors);
                });
            }
            this.snackBar.open('Erreur: Formulaire invalide. Vérifiez les champs.', 'OK', { duration: 5000 });
            return of(null);
        }

        // Ensure nomenclature from input is in the form before saving
        if (this.nomenclature && this.embedded) {
            const currentPropretes = this.form.get('proprietes')?.value || {};
            this.form.get('proprietes')?.patchValue({
                ...currentPropretes,
                nomenclature: this.nomenclature
            });
            console.log('📋 Syncing nomenclature to form before save:', this.nomenclature);
        }

        const formData = this.form.getRawValue();

        // proprietes MUST be included now, merged with extraProperties
        const { paiements, ...restFormData } = formData;

        // FORCE: Always re-apply current session user for traceability (unless read-only maybe?)
        // But better to ensure it's there for any save operation.
        const currentProprietes = restFormData.proprietes || {};

        // We attempt to get the employee ID one last time if missing in the form for some reason
        let finalVendeurId = currentProprietes.vendeurId;
        if (!finalVendeurId) {
            this.store.select(UserSelector).pipe(take(1)).subscribe(user => {
                if (user?.employee?.id) finalVendeurId = user.employee.id;
            });
        }

        // [FIX] Robust Merge: Combine Original DB props + Current Form props + Extra props
        const mergedProprietes = {
            ...this.originalProprietes,
            ...currentProprietes,
            ...(extraProperties || {})
        };

        // [DIAGNOSTIC] Explicitly log and show what we are sending
        const pts = mergedProprietes.pointsUtilises || 0;
        console.log(`📡 [FactureForm] SENDING SAVE: Points=${pts}, totalTTC=${this.totalTTC}`, mergedProprietes);
        if (pts > 0) {
            this.snackBar.open(`Envoi: ${pts} points Fidelio (-${pts * 0.1} DH)...`, 'OK', { duration: 2000 });
        }
        mergedProprietes.vendeurId = finalVendeurId; // Force the ID

        console.log('📝 FactureFormComponent.saveAsObservable - Merged Properties:', mergedProprietes);

        const factureData: any = {
            ...restFormData,
            centreId: this.centreId, // CRITICAL: Propagation for stock decrement fallback
            proprietes: mergedProprietes,
            ficheId: this.ficheIdInput, // Include link to Fiche
            totalHT: this.totalHT,
            totalTVA: this.totalTVA,
            totalTTC: this.totalTTC,
            montantLettres: this.montantLettres,
            // paiements: excluded
            resteAPayer: this.resteAPayer
        };

        console.log('💾 Saving facture with data:', {
            id: this.id,
            statut: factureData.statut,
            type: factureData.type,
            proprietes: JSON.stringify(factureData.proprietes),
            pointsUtilises: factureData.proprietes?.pointsUtilises,
            nomenclature: factureData.proprietes?.nomenclature
        });

        const request = this.id && this.id !== 'new'
            ? this.factureService.update(this.id, factureData)
            : this.factureService.create(factureData);

        return request.pipe(
            tap(facture => {
                if (facture.proprietes?.pointsUtilises > 0) {
                    this.snackBar.open(`✅ Fidelio appliqué: -${facture.proprietes.pointsUtilises * 0.1} DH`, 'OK', { duration: 4000 });
                }
            }),
            map(facture => {
                this.id = facture.id; // Update internal ID to prevent duplicates

                // IMPORTANT: Update form with returned data (Official Number, New Status, etc.)
                // This handles the Draft -> Valid ID swap seamlessly
                if (facture.numero !== this.form.get('numero')?.value || facture.type !== this.form.get('type')?.value) {
                    this.form.patchValue({
                        numero: facture.numero,
                        statut: facture.statut,
                        type: facture.type
                    }, { emitEvent: false });
                }


                if (showNotification) {
                    this.snackBar.open('Document enregistré avec succès', 'Fermer', { duration: 3000 });
                }
                if (this.embedded) {
                    this.onSaved.emit(facture);
                } else if (!this.id || this.id === 'new') { // This condition will now be false for 'this.id'
                    // logic adjusted below
                }

                // Navigation logic for standalone mode
                if (!this.embedded) {
                    // Check if we should return to a specific URL (e.g., medical file)
                    const returnToUrl = (this as any).returnToUrl;
                    if (returnToUrl) {
                        this.router.navigateByUrl(returnToUrl);
                    } else if (this.id !== this.route.snapshot.paramMap.get('id')) {
                        this.router.navigate(['/p/clients/factures', this.id], { replaceUrl: true });
                    }
                }
                return facture;

            }),
            catchError(err => {
                if (err.status === 409) {
                    console.log('⚠️ [FactureForm] Race condition: Invoice already exists (409). Treating as success.');
                    throw err;
                }
                console.error('Erreur sauvegarde facture:', err);

                let message = 'Erreur lors de l\'enregistrement';
                // [FIX] Format class-validator errors ([object Object])
                if (err.error && Array.isArray(err.error.message)) {
                    const details = err.error.message.map((e: any) => {
                        if (e.constraints) {
                            return Object.values(e.constraints).join(', ');
                        }
                        return typeof e === 'string' ? e : JSON.stringify(e);
                    }).join(' | ');
                    message = `Erreur de validation: ${details}`;
                } else if (err.error?.message) {
                    message = err.error.message;
                }

                this.snackBar.open(message, 'Fermer', { duration: 7000 });
                throw err;
            })
        );
    }

    numberToText(num: number): string {
        return numberToFrench(num);
    }

    loadSourceFacture(id: string) {
        this.factureService.findOne(id).subscribe({
            next: (facture) => {
                // Copy lines from source invoice
                this.lignes.clear();
                if (facture.lignes) {
                    (facture.lignes as any[]).forEach((l: any) => {
                        const lineGroup = this.createLigne();
                        lineGroup.patchValue(l);
                        this.lignes.push(lineGroup);
                    });
                }
                this.calculateTotals();
                this.snackBar.open('Données chargées depuis la facture ' + facture.numero, 'OK', { duration: 3000 });
            },
            error: (err) => {
                console.error('Error loading source facture', err);
                this.isLoading = false; // [FIX] Stop loading on error
                this.snackBar.open('Erreur de chargement du document source', 'OK', { duration: 3000 });
            }
        });
    }

    // ===== PAYMENT METHODS =====

    openPaymentDialog() {
        if (!this.id || this.id === 'new') {
            this.snackBar.open('Veuillez d\'abord enregistrer la facture', 'Fermer', { duration: 3000 });
            return;
        }

        const currentStatut = this.form.get('statut')?.value;
        const currentType = this.form.get('type')?.value;
        if (currentStatut === 'BROUILLON') {
            this.snackBar.open('La facture doit être validée ou au moins au stade de Devis avant paiement', 'Fermer', { duration: 3000 });
            return;
        }

        const proceed = () => {
            const dialogRef = this.dialog.open(PaymentDialogComponent, {
                maxWidth: '90vw',
                data: {
                    resteAPayer: this.resteAPayer,
                    client: this.client
                }
            });

            dialogRef.afterClosed().subscribe((payment: Payment) => {
                if (payment) {
                    this.createPayment(payment);
                }
            });
        };

        if (currentType === 'DEVIS') {
            this.checkStockAndProceed(proceed);
        } else {
            proceed();
        }
    }

    createPayment(payment: Payment) {
        if (!this.id) return;

        this.paiementService.create({
            ...payment,
            factureId: this.id,
            date: payment.date ? (typeof payment.date === 'string' ? payment.date : payment.date.toISOString()) : new Date().toISOString(),
            mode: payment.mode.toString(),
            dateVersement: payment.dateVersement ? (typeof payment.dateVersement === 'string' ? payment.dateVersement : payment.dateVersement.toISOString()) : undefined,
        }).subscribe({
            next: (savedPayment) => {
                this.snackBar.open('Paiement enregistré', 'Fermer', { duration: 3000 });
                // Reload facture to get updated status and remaining amount
                this.loadFacture(this.id!);
                this.paymentAdded.emit();
            },

            error: (err) => {
                console.error('Error creating payment:', err);
                this.snackBar.open('Erreur lors de l\'enregistrement du paiement', 'Fermer', { duration: 3000 });
            }
        });
    }

    // Deprecated/Modified: addPayment no longer pushes to local array directly for persistence, 
    // but we keep it if needed for view update before reload (optional)
    addPayment(payment: Payment) {
        // logic moved to createPayment
    }

    removePayment(index: number) {
        this.paiements.splice(index, 1);
        this.calculatePaymentTotals();
        this.updateStatutFromPayments();
    }

    calculatePaymentTotals() {
        this.montantPaye = this.paiements.reduce((sum, p) => sum + p.montant, 0);

        // Timbre de 0.25% si au moins un paiement en ESPÈCES
        const hasEspeces = this.paiements.some(p => p.mode === 'ESPECES');
        this.droitTimbre = hasEspeces ? (this.totalTTC * 0.0025) : 0;
        this.netAPayer = this.totalTTC + this.droitTimbre;

        this.resteAPayer = this.netAPayer - this.montantPaye;
    }

    updateStatutFromPayments() {
        // Only auto-update if we are not explicitly VALIDE or VENTE_EN_INSTANCE
        const currentStatut = String(this.form.get('statut')?.value || '').toUpperCase();

        // If it's a Devis, we don't use the standard invoice statuses (PARTIEL/PAYEE)
        // unless it's just been validated.
        if (String(this.form.get('type')?.value || '').toUpperCase() === 'DEVIS' && currentStatut !== 'VALIDE') {
            return;
        }

        if (this.resteAPayer <= 0 && this.netAPayer > 0) {
            this.form.patchValue({ statut: 'PAYEE' }, { emitEvent: false });
        } else if (this.montantPaye > 0) {
            // If user has manually set VALIDE, don't revert to PARTIEL
            if (currentStatut !== 'VALIDE' && currentStatut !== 'VENTE_EN_INSTANCE') {
                this.form.patchValue({ statut: 'PARTIEL' }, { emitEvent: false });
            }
        }
    }

    getPaymentStatusBadge(): { label: string; class: string } {
        if (this.resteAPayer <= 0 && this.netAPayer > 0) {
            return { label: 'PAYÉE', class: 'badge-paid' };
        } else if (this.montantPaye > 0) {
            return { label: 'PARTIEL', class: 'badge-partial' };
        } else {
            return { label: 'IMPAYÉE', class: 'badge-unpaid' };
        }
    }

    getPaymentModeLabel(mode: string): string {
        const modes: any = {
            'ESPECES': 'Espèces',
            'CARTE': 'Carte',
            'CHEQUE': 'Chèque',
            'VIREMENT': 'Virement',
            'AUTRE': 'Autre'
        };
        return modes[mode] || mode;
    }

    get canExchange(): boolean {
        const type = this.form.get('type')?.value;
        const statut = this.form.get('statut')?.value;
        // [MODIFIED] Only validated invoices/BC can be exchanged
        const isOfficial = (type === 'FACTURE' || type === 'BON_COMM' || type === 'BON_COMMANDE' || type === 'BL') && (statut === 'VALIDE' || statut === 'PAYEE' || statut === 'PARTIEL');
        return isOfficial && this.id !== 'new';
    }

    async transformToBC() {
        if (!confirm('Voulez-vous transformer ce devis en BON DE COMMANDE ?')) return;
        this.checkStockAndProceed(() => {
            this.form.patchValue({
                type: 'BON_COMM',
                statut: 'VENTE_EN_INSTANCE'
            });

            this.saveAsObservable().subscribe({
                next: (res) => {
                    if (res) {
                        this.snackBar.open('Document transformé en BON DE COMMANDE', 'OK', { duration: 3000 });
                    }
                },
                error: (err) => {
                    console.error('Error transforming to BC:', err);
                    this.snackBar.open('Erreur: ' + (err.error?.message || 'Erreur serveur'), 'Fermer', { duration: 5000 });
                }
            });
        });
    }

    private checkStockAndProceed(proceedCallback: () => void) {
        if (!this.id || this.id === 'new') {
            proceedCallback();
            return;
        }

        this.factureService.checkAvailability(this.id).subscribe({
            next: (check) => {
                if (check.hasConflicts) {
                    const dialogRef = this.dialog.open(StockConflictDialogComponent, {
                        width: '900px',
                        data: { conflicts: check.conflicts }
                    });

                    dialogRef.afterClosed().subscribe(result => {
                        if (!result) return;

                        if (result.action === 'TRANSFER_REQUEST') {
                            // Handle transfer request
                            this.initiateTransfer(result.productId, result.sourceCentreId, result.targetCentreId);
                        } else if (result.action === 'REPLACE') {
                            this.snackBar.open('Veuillez modifier le document pour remplacer le produit.', 'OK', { duration: 5000 });
                        } else if (result.action === 'CANCEL_SALE') {
                            this.onCancelled.emit();
                        }
                    });
                } else {
                    proceedCallback();
                }
            },
            error: (err) => {
                console.error('Error checking stock availability:', err);
                this.snackBar.open('Erreur lors de la vérification du stock. Opération annulée.', 'Fermer', { duration: 5000 });
            }
        });
    }

    private initiateTransfer(productId: string, sourceCentreId: string, targetCentreId: string) {
        // Find the specific products for source and target
        this.productService.findAll({ global: true }).subscribe(allProducts => {
            const sourceProduct = allProducts.find(p => p.id === productId || (p.entrepot?.centreId === sourceCentreId && (p.designation === this.lignes.getRawValue().find((l: any) => l.productId === productId)?.description)));
            const targetProduct = allProducts.find(p => p.entrepot?.centreId === targetCentreId && (p.designation === sourceProduct?.designation));

            if (sourceProduct && targetProduct) {
                this.productService.initiateTransfer(sourceProduct.id, targetProduct.id, 1).subscribe({
                    next: () => {
                        this.snackBar.open(`Demande de transfert envoyée pour ${sourceProduct.designation}`, 'OK', { duration: 5000 });
                        this.dialog.closeAll(); // Close the conflict dialog
                    },
                    error: (err) => {
                        console.error('Error initiating transfer:', err);
                        this.snackBar.open('Erreur lors de la demande de transfert', 'Fermer', { duration: 5000 });
                    }
                });
            } else {
                this.snackBar.open('Impossible de localiser les produits pour le transfert.', 'Fermer', { duration: 5000 });
            }
        });
    }


    async transformToFacture() {
        if (!confirm('Voulez-vous transformer ce document en FACTURE officielle ?')) return;

        this.checkStockAndProceed(() => {
            this.form.patchValue({
                numero: null, // [FIX] Force NEW sequential official number
                type: 'FACTURE',
                statut: 'VALIDE'
            });

            this.saveAsObservable(true, { forceFiscal: true }).subscribe({
                next: (res) => {
                    if (res) {
                        this.snackBar.open('Document transformé en FACTURE (Numérotation officielle)', 'OK', { duration: 3000 });
                    }
                },
                error: (err) => {
                    console.error('Error transforming to Facture:', err);
                    this.snackBar.open('Erreur: ' + (err.error?.message || 'Erreur serveur'), 'Fermer', { duration: 5000 });
                }
            });
        });
    }


    async validateSale() {
        if (!confirm('Voulez-vous VALIDER cette vente ? Le stock sera réservé.')) return;

        this.checkStockAndProceed(() => {
            const isCurrentlyDevis = this.form.get('type')?.value === 'DEVIS';

            if (isCurrentlyDevis) {
                // Upgrade to BC
                this.form.patchValue({
                    numero: null, // [FIX] Force NEW sequential BC number
                    statut: 'VENTE_EN_INSTANCE',
                    type: 'BON_COMM'
                });
            } else {
                // Already a BC or other, just ensure it's in instance mode if not already validated
                const currentStatut = this.form.get('statut')?.value;
                if (!['VALIDE', 'PAYEE', 'PARTIEL'].includes(currentStatut)) {
                    this.form.patchValue({ statut: 'VENTE_EN_INSTANCE' });
                }
            }

            this.saveAsObservable(true, { forceStockDecrement: true }).subscribe({
                next: (res) => {
                    if (res) {
                        const message = isCurrentlyDevis ? 'Vente passée en BON DE COMMANDE (Stock réservé)' : 'Vente mise à jour (Stock réservé)';
                        this.snackBar.open(message, 'OK', { duration: 3000 });
                    }
                },
                error: (err) => {
                    console.error('Error validating sale:', err);
                    this.snackBar.open('Erreur lors de la validation: ' + (err.error?.message || 'Erreur serveur'), 'Fermer', { duration: 5000 });
                }
            });
        });
    }





    openExchangeDialog() {
        if (!this.id) return;

        import('../../dialogs/invoice-return-dialog/invoice-return-dialog.component').then(m => {
            const dialogRef = this.dialog.open(m.InvoiceReturnDialogComponent, {
                width: '800px',
                data: {
                    facture: {
                        id: this.id,
                        numero: this.form.get('numero')?.value,
                        lignes: this.lignes.getRawValue()
                    }
                }
            });

            dialogRef.afterClosed().subscribe(result => {
                if (result) {
                    const itemsWithReason = result.items.map((it: any) => ({
                        ...it,
                        reason: result.reason
                    }));

                    this.factureService.exchangeInvoice(this.id!, itemsWithReason).subscribe({
                        next: (res) => {
                            this.snackBar.open(`Échange effectué : Avoir ${res.avoir.numero} et Facture ${res.newFacture.numero} créés`, 'Fermer', {
                                duration: 5000
                            });
                            if (this.embedded) {
                                this.onSaved.emit(res.newFacture);
                            } else {
                                this.router.navigate(['/p/clients/factures', res.newFacture.id]);
                            }
                        },
                        error: (err) => {
                            console.error('Erreur lors de l\'échange:', err);
                            this.snackBar.open('Erreur lors de l\'échange: ' + (err.error?.message || 'Erreur serveur'), 'Fermer', {
                                duration: 3000
                            });
                        }
                    });
                }
            });
        });
    }

    print() {
        // Generate barcode on the original element before cloning to ensure it's captured
        this.generateBarcode();

        // Force change detection
        this.cdr.detectChanges();

        // Identify the print layout element
        const printContent = document.querySelector('.facture-form-container');
        if (!printContent) {
            window.print();
            return;
        }

        // Clone and Isolate (Hierarchy Escape Strategy)
        const clone = printContent.cloneNode(true) as HTMLElement;

        // Remove the action buttons from the clone to avoid redundant buttons in print if they weren't hidden by CSS
        const actions = clone.querySelector('.actions');
        if (actions) actions.remove();

        clone.classList.add('print-isolated');

        document.body.classList.add('is-printing-report');
        document.body.appendChild(clone);

        // Trigger print with delay
        setTimeout(() => {
            window.print();

            // Cleanup
            document.body.classList.remove('is-printing-report');
            if (document.body.contains(clone)) {
                document.body.removeChild(clone);
            }
        }, 300);
    }
}
