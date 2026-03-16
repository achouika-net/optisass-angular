import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CameraCaptureDialogComponent } from '../../../../shared/components/camera-capture/camera-capture-dialog.component';
import { OrderActionDialogComponent } from '../../../../shared/components/order-action-dialog/order-action-dialog.component';
import { CommonModule } from '@angular/common';
import { AdaptationModerneComponent } from './components/adaptation-moderne/adaptation-moderne.component';
import { FormBuilder, FormGroup, FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { FicheService } from '../../services/fiche.service';
import { ClientManagementService } from '../../services/client.service';
import { FactureService } from '../../services/facture.service';
import { FinanceService } from '../../../finance/services/finance.service';
import { FicheLentillesCreate, TypeFiche, StatutFiche } from '../../models/fiche-client.model';
import { Client, ClientParticulier, ClientProfessionnel, isClientParticulier, isClientProfessionnel } from '../../models/client.model';
import { ContactLensType, ContactLensUsage } from '../../../../shared/interfaces/product.interface';
import { FactureFormComponent } from '../facture-form/facture-form.component';
import { PaymentListComponent } from '../../components/payment-list/payment-list.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StockSearchDialogComponent } from '../../../stock-management/dialogs/stock-search-dialog/stock-search-dialog.component';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ProductService } from '../../../stock-management/services/product.service';
import { Product, ProductStatus } from '../../../../shared/interfaces/product.interface';
import { CompanySettingsService } from '../../../../core/services/company-settings.service';
import { CompanySettings } from '../../../../shared/interfaces/company-settings.interface';
import { Store } from '@ngrx/store';
import { UserSelector } from '../../../../core/store/auth/auth.selectors';
import { Observable, BehaviorSubject, Subject, timer, forkJoin, of, firstValueFrom } from 'rxjs';
import { takeUntil, filter, distinctUntilChanged, switchMap, debounceTime, startWith, map, catchError, take, tap } from 'rxjs/operators';

interface PrescriptionFile {
    name: string;
    type: string;
    size: number;
    preview: string | SafeResourceUrl;
    file: File;
    uploadDate: Date;
}

@Component({
    selector: 'app-lentilles-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        MatTabsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatCheckboxModule,
        MatDividerModule,
        MatButtonToggleModule,
        RouterModule,
        AdaptationModerneComponent,
        FactureFormComponent,
        PaymentListComponent,
        MatDialogModule,
        MatProgressSpinnerModule,
        MatAutocompleteModule
    ],
    templateUrl: './lentilles-form.component.html',
    styleUrls: ['./lentilles-form.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [ProductService]
})
export class LentillesFormComponent implements OnInit, OnDestroy {
    ficheForm: FormGroup;
    clientId: string | null = null;
    client: Client | null = null;
    activeTab = 0;
    loading = false;
    isEditMode = false;
    ficheId: string | null = null;

    // Enums for dropdowns
    lensTypes = Object.values(ContactLensType);
    lensUsages = Object.values(ContactLensUsage);

    // Linked Invoice
    private linkedFactureSubject = new BehaviorSubject<any>(null);
    linkedFacture$ = this.linkedFactureSubject.asObservable();
    linkedFacture: any = null;
    companySettings: any = null;

    // Transfer tracking
    receptionComplete = false;
    isReserved = false;
    isTransit = false;
    currentFiche: any = null;
    initialProductStatus: string | null = null;
    private destroy$ = new Subject<void>();
    currentUser$: Observable<any> = this.store.select(UserSelector).pipe(filter(u => !!u));

    // File Upload & OCR
    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
    @ViewChild(FactureFormComponent) factureComponent?: FactureFormComponent;

    prescriptionFiles: PrescriptionFile[] = [];
    isProcessingOcr = false;
    viewingFile: PrescriptionFile | null = null;
    initialLines: any[] = []; // To track changes for dirty check
    
    // Fournisseur Autocomplete
    allSuppliers: any[] = [];
    filteredSuppliers$?: Observable<any[]>;
    fournisseurCtrl = new FormControl('');

    constructor(
        private fb: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private ficheService: FicheService,
        private clientService: ClientManagementService,
        private factureService: FactureService,
        private financeService: FinanceService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef,
        private sanitizer: DomSanitizer,
        private productService: ProductService,
        private store: Store,
        private companySettingsService: CompanySettingsService,
        private ngZone: NgZone
    ) {
        this.ficheForm = this.initForm();
    }

    ngOnInit(): void {
        this.loadSuppliers();

        this.loadCompanySettings();

        // Use standalone control for autocomplete (stays enabled even in view mode)
        this.filteredSuppliers$ = this.fournisseurCtrl.valueChanges.pipe(
            startWith(''),
            debounceTime(300),
            map(value => this._filterSuppliers(value || ''))
        );

        // Sync standalone fournisseur control -> main form
        this.fournisseurCtrl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((value: any) => {
            const formCtrl = this.ficheForm.get('suiviCommande.fournisseur');
            if (formCtrl) {
                const supplierName = typeof value === 'string' ? value : (value?.nom || '');
                if (formCtrl.value !== supplierName) {
                    formCtrl.setValue(supplierName);
                }
            }
        });

        // REACTIVE INVOICE SYNC: Keep initialInvoiceLines updated when lens selection changes
        this.ficheForm.get('lentilles')?.valueChanges.pipe(
            takeUntil(this.destroy$),
            debounceTime(500)
        ).subscribe(() => {
            console.log('🔄 [Lentille] Form changed, syncing initialInvoiceLines...');
            this.initialLines = this.getInvoiceLines();
            this.cdr.markForCheck();
        });

        this.route.paramMap.subscribe(params => {
            this.clientId = params.get('clientId');
            this.ficheId = params.get('ficheId');

            if (this.clientId) {
                this.loadClient();
            }

            if (this.ficheId && this.ficheId !== 'new') {
                this.isEditMode = false;
                this.ficheForm.disable();
                this.loadFiche();
                this.loadLinkedInvoice();
            } else {
                // Initial state for new fiche
                this.ficheId = 'new';
                this.isEditMode = true;
                this.ficheForm.enable();
                this.ficheForm.reset(this.initForm().getRawValue());
                // Default dates
                this.ficheForm.patchValue({
                    ordonnance: { datePrescription: new Date() },
                    adaptation: { dateEssai: new Date() }
                });
                this.initialLines = [];
                this.linkedFactureSubject.next(null);
                this.cdr.markForCheck();
            }
        });

        // REACTIVE RECEPTION CHECK: Trigger whenever the invoice status changes
        this.linkedFacture$.subscribe(facture => {
            if (facture?.statut === 'VENTE_EN_INSTANCE' && this.currentFiche) {
                console.log('🔄 [RECEPTION] Reactive trigger (Invoice changed or loaded)');
                this.checkReceptionForInstance(this.currentFiche);
            }
        });

        // POLLING: Check reception status every 30 seconds if waiting
        this.ngZone.runOutsideAngular(() => {
            timer(30000, 30000).pipe(
                takeUntil(this.destroy$)
            ).subscribe(() => {
                if ((this.isReserved || this.isTransit) && !this.receptionComplete && this.currentFiche) {
                    console.log('🔄 [POLLING] Checking reception status...');
                    this.checkReceptionForInstance(this.currentFiche);
                }
            });
        });

        // AUTO-SAVE: Debounced listener for suiviCommande changes
        this.ficheForm.get('suiviCommande')?.valueChanges.pipe(
            takeUntil(this.destroy$)
        ).subscribe(() => {
            // Force immediate UI update for timeline events rendering
            this.cdr.markForCheck();
            this.cdr.detectChanges();

            if (this.ficheId && this.ficheId !== 'new') {
                this.debouncedSaveSuivi();
            }
        });

        // [NEW] Automated Status Transition for Suivi Commande
        const trackingControl = this.ficheForm.get('suiviCommande.trackingNumber');
        if (trackingControl) {
            trackingControl.valueChanges.pipe(
                debounceTime(500),
                distinctUntilChanged(),
                filter(val => !!val && this.suiviStatut === 'COMMANDE'),
                takeUntil(this.destroy$)
            ).subscribe(() => {
                console.log('🚚 [Suivi] BL detected, auto-transitioning to RECU');
                this.setOrderStatus('RECU');
            });
        }
    }

    private debouncedSaveSuivi = this.debounce(() => {
        this.saveSuiviCommande();
    }, 2000);

    private debounce(fn: Function, ms: number) {
        let timeoutId: any;
        return (...args: any[]) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    initForm(): FormGroup {
        return this.fb.group({
            // Ordonnance
            ordonnance: this.fb.group({
                datePrescription: [new Date()],
                prescripteur: [''],
                dateControle: [''],
                od: this.fb.group({
                    sphere: [''],
                    cylindre: [''],
                    axe: [''],
                    addition: [''],
                    k1: [''],
                    k2: [''],
                    acuiteVisuelle: ['']
                }),
                og: this.fb.group({
                    sphere: [''],
                    cylindre: [''],
                    axe: [''],
                    addition: [''],
                    k1: [''],
                    k2: [''],
                    acuiteVisuelle: ['']
                })
            }),

            // Sélection Lentilles
            lentilles: this.fb.group({
                type: [ContactLensType.MENSUELLE, Validators.required],
                usage: [ContactLensUsage.MYOPIE, Validators.required],
                diffLentilles: [false],
                od: this.fb.group({
                    marque: ['', Validators.required],
                    modele: [''],
                    rayon: [''],
                    diametre: [''],
                    sphere: [''],
                    cylindre: [''],
                    axe: [''],
                    addition: [''],
                    prix: [0],
                    acuiteVisuelle: [''],
                    mouvement: [''],
                    centrage: [''],
                    keratoH: [''],
                    keratoV: [''],
                    keratoAxe: [''],
                    keratoMoy: [''],
                    productId: [null],
                    entrepotId: [null],
                    entrepotType: [null],
                    entrepotNom: [null]
                }),
                og: this.fb.group({
                    marque: ['', Validators.required],
                    modele: [''],
                    rayon: [''],
                    diametre: [''],
                    sphere: [''],
                    cylindre: [''],
                    axe: [''],
                    addition: [''],
                    prix: [0],
                    acuiteVisuelle: [''],
                    mouvement: [''],
                    centrage: [''],
                    keratoH: [''],
                    keratoV: [''],
                    keratoAxe: [''],
                    keratoMoy: [''],
                    productId: [null],
                    entrepotId: [null],
                    entrepotType: [null],
                    entrepotNom: [null]
                })
            }),

            // Adaptation
            adaptation: this.fb.group({
                dateEssai: [new Date()],
                dateControle: [''],
                docteur: [''],
                // Automatic Measures
                hvid: [''], pupilPhot: [''], pupilMes: [''], but: [''], k1: [''], k2: [''], schirmer: [''],
                // Clinical Params (Global for Modern Adaptation)
                blinkFreq: [''], blinkAmp: [''], tonus: [''],
                // Suggestions
                suggestedType: [''], suggestedDiameter: [''], suggestedBC: [''], suggestedMaterial: [''],
                // OD
                od: this.fb.group({
                    frequenceCillement: ['normal'], amplitudeCillement: ['complet'], tonusPalpebral: ['normal'],
                    reactionPupillaire: ['normale'], secretionLacrimale: [''], but: [''], etatPaupieres: ['']
                }),
                // OG
                og: this.fb.group({
                    frequenceCillement: ['normal'], amplitudeCillement: ['complet'], tonusPalpebral: ['normal'],
                    reactionPupillaire: ['normale'], secretionLacrimale: [''], but: [''], etatPaupieres: ['']
                }),
                remarques: ['']
            }),

            // Suivi Commande
            suiviCommande: this.fb.group({
                statut: ['A_COMMANDER'], // A_COMMANDER, COMMANDE, RECU, LIVRE_CLIENT
                dateCommande: [null],
                dateReception: [null],
                dateLivraison: [null],
                fournisseur: [''],
                referenceCommande: [''],
                trackingNumber: [''],
                commentaire: [''],
                journal: [[]],
                hasCasse: [false],
                casseCount: [0],
                casseHistorique: [[]],
                nextBcMotive: [''],
                bcHistorique: [[]]
            })
        });
    }

    loadClient(): void {
        if (!this.clientId) return;
        this.clientService.getClient(this.clientId).subscribe(client => {
            this.client = client || null;
            this.cdr.markForCheck();
        });
    }

    loadFiche(): void {
        if (!this.ficheId) return;

        this.ficheService.getFicheById(this.ficheId).subscribe({
            next: (fiche: any) => {
                if (!fiche) {
                    console.error('❌ [loadFiche] No fiche returned from server');
                    return;
                }

                console.log('📥 [loadFiche] Raw fiche:', JSON.stringify({
                    id: fiche.id,
                    lentilles_od: fiche.lentilles?.od,
                    lentilles_og: fiche.lentilles?.og,
                    lentilles_type: fiche.lentilles?.type,
                }, null, 2));

                // Re-enable form temporarily to ensure patchValue works properly
                const wasDisabled = !this.isEditMode;
                if (wasDisabled) this.ficheForm.enable();

                const formPatch = {
                    ...fiche,
                    ordonnance: fiche.ordonnance || fiche.prescription || {},
                    lentilles: fiche.lentilles || {},
                    adaptation: fiche.adaptation || {},
                    suiviCommande: fiche.suiviCommande || {}
                };

                // FIX: Slice dates for HTML native input type="date"
                if (formPatch.suiviCommande) {
                    if (formPatch.suiviCommande.dateCommande) formPatch.suiviCommande.dateCommande = typeof formPatch.suiviCommande.dateCommande === 'string' ? formPatch.suiviCommande.dateCommande.substring(0, 10) : this.toISODate(formPatch.suiviCommande.dateCommande);
                    if (formPatch.suiviCommande.dateReception) formPatch.suiviCommande.dateReception = typeof formPatch.suiviCommande.dateReception === 'string' ? formPatch.suiviCommande.dateReception.substring(0, 10) : this.toISODate(formPatch.suiviCommande.dateReception);
                    if (formPatch.suiviCommande.dateLivraison) formPatch.suiviCommande.dateLivraison = typeof formPatch.suiviCommande.dateLivraison === 'string' ? formPatch.suiviCommande.dateLivraison.substring(0, 10) : this.toISODate(formPatch.suiviCommande.dateLivraison);
                }

                this.ficheForm.patchValue(formPatch);

                // Explicitly patch critical sub-groups to ensure nested data loads
                if (fiche.lentilles) {
                    const lentillesGroup = this.ficheForm.get('lentilles') as FormGroup;
                    if (lentillesGroup) {
                        lentillesGroup.patchValue(fiche.lentilles);

                        // Explicitly patch OD
                        if (fiche.lentilles.od) {
                            const odGroup = lentillesGroup.get('od') as FormGroup;
                            if (odGroup) odGroup.patchValue(fiche.lentilles.od);
                        }

                        // Explicitly patch OG
                        if (fiche.lentilles.og) {
                            const ogGroup = lentillesGroup.get('og') as FormGroup;
                            if (ogGroup) ogGroup.patchValue(fiche.lentilles.og);
                        }
                    }
                }

                // Sync the standalone fournisseur control
                const fournisseur = fiche.suiviCommande?.fournisseur;
                if (fournisseur !== undefined) {
                    this.fournisseurCtrl.setValue(fournisseur, { emitEvent: false });
                }

                // Re-disable if was in view mode, but KEEP suiviCommande enabled for tracking updates
                if (wasDisabled) {
                    this.ficheForm.disable();
                    this.ficheForm.get('suiviCommande')?.enable({ emitEvent: false });
                }

                this.currentFiche = fiche;
                this.initialLines = this.getInvoiceLines();

                if (this.linkedFacture?.statut === 'VENTE_EN_INSTANCE') {
                    this.checkReceptionForInstance(fiche);
                }

                console.log('✅ [loadFiche] Form populated. lentilles.od.marque:', 
                    this.ficheForm.get('lentilles.od.marque')?.value);

                this.cdr.markForCheck();
            },
            error: (err) => console.error('Error loading fiche:', err)
        });
    }

    loadLinkedInvoice() {
        // Don't load invoice for new fiches
        if (!this.ficheId || this.ficheId === 'new') {
            console.log('⏩ [Lentille] Skipping loadLinkedInvoice: ficheId is new');
            this.linkedFactureSubject.next(null);
            return;
        }

        if (!this.clientId) {
            console.log('⚠️ [Lentille] loadLinkedInvoice: clientId is missing');
            return;
        }

        console.log('🔍 [Lentille] Searching for linked facture for ficheId:', this.ficheId);
        this.factureService.findAll({ ficheId: this.ficheId }).subscribe({
            next: (factures: any[]) => {
                // Backend already filters by ficheId with take=1 on controller.
                // Use factures[0] directly rather than secondary find() which fails if ficheId
                // is not surfaced as a top-level field in the serialized response.
                const found = factures.length > 0 ? factures[0] : null;
                if (found) {
                    console.log('🔗 [Lentille] Linked Facture found:', found.numero, '| Status:', found.statut, '| Type:', found.type);
                    this.linkedFacture = found;
                    this.linkedFactureSubject.next(found);
                    
                    if (this.currentFiche && found.statut === 'VENTE_EN_INSTANCE') {
                        this.checkReceptionForInstance(this.currentFiche);
                    }
                } else {
                    console.log('❓ [Lentille] No linked facture found for ficheId:', this.ficheId);
                    this.linkedFactureSubject.next(null);
                }
                this.cdr.markForCheck();
            },
            error: (err) => {
                console.error('âŒ [Lentille] Error loading factures:', err);
                this.linkedFactureSubject.next(null);
            }
        });
    }

    validerVente(): void {
        const currentFacture = this.linkedFactureSubject.value;
        if (!currentFacture || currentFacture.type !== 'DEVIS') return;

        this.loading = true;
        // CRITICAL: Always get fresh lines from the form
        const lines = this.getInvoiceLines();
        const total = lines.reduce((acc, l) => acc + l.totalTTC, 0);

        if (lines.length === 0) {
            this.snackBar.open('Erreur: Aucune lentille sélectionnée ou prix non défini', 'Fermer', { duration: 3000 });
            this.loading = false;
            return;
        }

        const updateData: any = {
            type: 'BON_COMM',
            statut: 'VALIDE',
            lignes: lines,
            totalTTC: total,
            proprietes: {
                ...(currentFacture.proprietes || {}),
                nomenclature: this.nomenclatureString || '',
                validatedAt: new Date()
            }
        };

        this.factureService.update(currentFacture.id, updateData).subscribe({
            next: (res) => {
                this.loading = false;
                this.snackBar.open('Vente validée : Devis transformé en Bon de Commande', 'Fermer', { duration: 5000 });
                this.onInvoiceSaved(res);
            },
            error: (err) => {
                this.loading = false;
                console.error('Validation error:', err);
                this.snackBar.open('Erreur lors de la validation', 'Fermer', { duration: 3000 });
            }
        });
    }

    transformerEnFacture(): void {
        const currentFacture = this.linkedFactureSubject.value;
        if (!currentFacture || currentFacture.type !== 'BON_COMM') return;

        this.loading = true;
        const updateData: any = {
            type: 'FACTURE',
            statut: 'VALIDE',
            proprietes: {
                ...(currentFacture.proprietes || {}),
                facturedAt: new Date()
            }
        };

        this.factureService.update(currentFacture.id, updateData).subscribe({
            next: (res) => {
                this.loading = false;
                this.snackBar.open('Facture générée avec succès', 'Fermer', { duration: 5000 });
                this.onInvoiceSaved(res);
            },
            error: (err) => {
                this.loading = false;
                this.snackBar.open('Erreur lors de la génération de la facture', 'Fermer', { duration: 3000 });
            }
        });
    }

    // --- Getters ---
    get ordonnanceGroup(): FormGroup { return this.ficheForm.get('ordonnance') as FormGroup; }
    get lentillesGroup(): FormGroup { return this.ficheForm.get('lentilles') as FormGroup; }
    get adaptationGroup(): FormGroup { return this.ficheForm.get('adaptation') as FormGroup; }
    get suiviCommandeGroup(): FormGroup { return this.ficheForm.get('suiviCommande') as FormGroup; }
    get diffLentilles(): boolean { return this.lentillesGroup.get('diffLentilles')?.value; }

    get clientDisplayName(): string {
        if (!this.client) return '';
        if (isClientProfessionnel(this.client)) return this.client.raisonSociale.toUpperCase();
        if (isClientParticulier(this.client)) return `${this.client.nom?.toUpperCase()} ${this.client.prenom}`;
        return 'Client';
    }

    get clientCinValue(): string {
        if (!this.client) return '';
        if (isClientProfessionnel(this.client)) return this.client.identifiantFiscal || '';
        if (isClientParticulier(this.client)) return this.client.numeroPieceIdentite || this.client.cinParent || '';
        return '';
    }

    // --- Order Tracking Logic ---


    // --- Invoice Generation ---
    get initialInvoiceLines(): any[] {
        return this.getInvoiceLines();
    }

    get nomenclatureString(): string {
        const lentilles = this.ficheForm.get('lentilles')?.getRawValue() || {};
        const ordonnance = this.ficheForm.get('ordonnance')?.getRawValue() || {};
        const type = lentilles.type || '';
        const usage = lentilles.usage || '';
        const diff = lentilles.diffLentilles;

        const formatEye = (l: any, o: any) => {
            const details = [];
            if (l.marque) details.push(l.marque);
            if (l.modele) details.push(l.modele);
            if (l.rayon) details.push(`BC ${l.rayon}`);
            if (l.diametre) details.push(`DIA ${l.diametre}`);

            const powers = [];
            if (o.sphere && o.sphere !== '0' && o.sphere !== '+0.00' && o.sphere !== '') powers.push(`Sph ${o.sphere}`);
            if (o.cylindre && o.cylindre !== '0' && o.cylindre !== '+0.00' && o.cylindre !== '') powers.push(`Cyl ${o.cylindre}`);
            if (o.axe && o.axe !== '0°' && o.axe !== '') powers.push(`Axe ${o.axe}`);
            if (o.addition && o.addition !== '0' && o.addition !== '+0.00' && o.addition !== '') powers.push(`Add ${o.addition}`);

            if (powers.length > 0) details.push(`(${powers.join(' ')})`);

            return details.join(' ').trim();
        };

        const odStr = formatEye(lentilles.od || {}, ordonnance.od || {});

        if (!diff) {
            return `Lentilles ${type} ${usage}: ${odStr}`.trim();
        } else {
            const ogStr = formatEye(lentilles.og || {}, ordonnance.og || {});
            return `Lentilles ${type} ${usage} - OD: ${odStr} / OG: ${ogStr}`.trim();
        }
    }




    onTabChange(event: any): void {
        this.activeTab = event.index;
        this.cdr.markForCheck();
        setTimeout(() => {
            this.cdr.detectChanges();
        }, 100);
    }

    // --- Navigation ---
    setActiveTab(index: number): void { 
        this.activeTab = index; 
        this.cdr.markForCheck();
        setTimeout(() => this.cdr.detectChanges(), 50);
    }
    nextTab(): void { 
        if (this.activeTab < 5) this.activeTab++; 
        this.cdr.markForCheck();
        setTimeout(() => this.cdr.detectChanges(), 50);
    }
    prevTab(): void { 
        if (this.activeTab > 0) this.activeTab--; 
        this.cdr.markForCheck();
        setTimeout(() => this.cdr.detectChanges(), 50);
    }
    goBack(): void {
        if (this.clientId) {
            this.router.navigate(['/p/clients', this.clientId]);
        } else {
            this.router.navigate(['/p/clients']);
        }
    }

    toggleEditMode(): void {
        this.isEditMode = !this.isEditMode;
        if (this.isEditMode) {
            this.ficheForm.enable();
        } else {
            this.ficheForm.disable();
            // Keep Suivi Commande interactive even in view mode
            this.ficheForm.get('suiviCommande')?.enable({ emitEvent: false });
            if (this.ficheId && this.ficheId !== 'new') {
                this.loadFiche();
            }
        }
    }

    // --- Stock Search ---
    openStockSearch(target: 'od' | 'og') {
        const dialogRef = this.dialog.open(StockSearchDialogComponent, {
            width: '95vw',
            maxWidth: '1600px',
            height: '85vh',
            data: {
                context: 'sales',
                initialTypeFilter: 'len'
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && (result.action === 'SELECT' || result.action === 'ORDER_AND_SELL') && result.product) {
                this.fillProductDetails(result.product, target);
            } else if (result && !result.action && result.id) {
                this.fillProductDetails(result, target);
            }
        });
    }

    fillProductDetails(product: any, target: 'od' | 'og') {
        const group = this.lentillesGroup.get(target) as FormGroup;
        if (!group) return;

        // Map product specificData to form
        const spec = product.specificData || {};
        const currentAchs = group.getRawValue();

        group.patchValue({
            marque: product.marque || currentAchs.marque || '',
            modele: product.modele || product.modeleCommercial || currentAchs.modele || '',
            rayon: spec.rayonCourbure || currentAchs.rayon || '',
            diametre: spec.diametre || currentAchs.diametre || '',
            
            // Ne pas écraser la correction saisie si le stock ne l'a pas
            sphere: spec.puissanceSph || currentAchs.sphere || '',
            cylindre: spec.puissanceCyl || currentAchs.cylindre || '',
            axe: spec.axe || currentAchs.axe || '',
            addition: spec.addition || currentAchs.addition || '',
            
            prix: product.prixVenteTTC || 0,
            productId: product.id,
            entrepotId: product.entrepotId,
            entrepotType: product.entrepot?.type || null,
            entrepotNom: product.entrepot?.nom || null
        });

        this.ficheForm.markAsDirty();
        this.cdr.markForCheck();
    }

    onPaymentAdded(): void {
        const currentFacture = this.linkedFactureSubject.value;
        
        // Auto-transform DEVIS to BON_COMM on first payment
        if (currentFacture && currentFacture.type === 'DEVIS') {
            console.log('💰 Payment added to Devis, auto-validating to BC...');
            this.validerVente();
        } else {
            this.loadLinkedInvoice();
            this.snackBar.open('Paiement ajouté avec succès', 'Fermer', { duration: 3000 });
        }
    }

    archiveFicheFacture(facture: any) {
        console.log('📦 Archiving Devis and Decrementing Stock for:', facture.numero);
        this.loading = true;

        const lines = this.initialInvoiceLines;
        const total = lines.reduce((acc, l) => acc + l.totalTTC, 0);
        const tvaRate = 0.20;
        const totalHT = total / (1 + tvaRate);
        const tva = total - totalHT;

        const updateData: any = {
            statut: 'ARCHIVE',
            lignes: lines,
            totalTTC: total,
            totalHT: totalHT,
            totalTVA: tva,
            proprietes: {
                ...(facture.proprietes || {}),
                nomenclature: this.nomenclatureString || '',
                forceStockDecrement: true,
                instancedAt: new Date()
            }
        };

        this.factureService.update(facture.id, updateData as any).subscribe({
            next: (res) => {
                this.loading = false;
                this.snackBar.open('Vente mise en instance et stock décrémenté', 'Fermer', { duration: 5000 });
                this.onInvoiceSaved(res);
            },
            error: (err) => {
                this.loading = false;
                console.error('Error archiving quote:', err);
                alert("Erreur lors de l'archivage: " + (err.message || 'Erreur inconnue'));
            }
        });
    }

    // --- Submit ---
    async onSubmit() {
        console.log('🚀 [onSubmit] Process started. Active Tab:', this.activeTab);
        console.log('📋 [onSubmit] FactureComponent available:', !!this.factureComponent);
        console.log('🚀 [DIAGNOSTIC] onSubmit starting for Lentilles...');
        if (this.ficheForm.invalid || !this.clientId || this.loading) {
            console.warn('⚠️ [DIAGNOSTIC] Form Invalid, No Client ID, or Loading', {
                invalid: this.ficheForm.invalid,
                clientId: this.clientId,
                loading: this.loading
            });
            this.ficheForm.markAllAsTouched();
            this.snackBar.open('Veuillez remplir tous les champs obligatoires (en rouge)', 'Fermer', { duration: 4000 });
            return;
        }
        this.loading = true;
        const formValue = this.ficheForm.getRawValue();

        // 1. Calculate Total
        const prixOD = parseFloat(formValue.lentilles.od.prix) || 0;
        const prixOG = parseFloat(formValue.lentilles.diffLentilles ? formValue.lentilles.og.prix : formValue.lentilles.od.prix) || 0;
        const montantTotal = prixOD + prixOG;

        // Sync standalone fournisseurCtrl to the form's suiviCommande.fournisseur before saving
        if (this.fournisseurCtrl?.value) {
            const supplierVal = this.fournisseurCtrl.value;
            const supplierName = typeof supplierVal === 'string' ? supplierVal : ((supplierVal as any)?.nom || '');
            formValue.suiviCommande = {
                ...formValue.suiviCommande,
                fournisseur: supplierName
            };
            console.log('🔄 [SYNC] fournisseurCtrl synced to suiviCommande.fournisseur:', supplierName);
        }

        // 2. Prepare Fiche Data
        const payload: any = {
            clientId: this.clientId,
            type: TypeFiche.LENTILLES,
            statut: this.currentFiche?.statut || StatutFiche.EN_COURS,
            montantTotal,
            montantPaye: this.currentFiche?.montantPaye || 0,
            ordonnance: formValue.ordonnance,
            prescription: formValue.ordonnance,
            lentilles: formValue.lentilles,
            adaptation: formValue.adaptation,
            suiviCommande: formValue.suiviCommande
        };

        console.log('📦 [onSubmit] Lentilles payload:', {
            'od.marque': payload.lentilles?.od?.marque,
            'od.modele': payload.lentilles?.od?.modele,
            'od.productId': payload.lentilles?.od?.productId,
            'od.entrepotId': payload.lentilles?.od?.entrepotId,
            'og.marque': payload.lentilles?.og?.marque,
            'og.productId': payload.lentilles?.og?.productId,
        });

        const operation = (this.ficheId && this.ficheId !== 'new')
            ? this.ficheService.updateFiche(this.ficheId, payload)
            : this.ficheService.createFicheLentilles(payload);

        // 3. ASYNC Payment Check (Same as Monture)
        let hasPayment = false;
        if (this.ficheId && this.ficheId !== 'new' && this.clientId) {
            try {
                const allF = await firstValueFrom(this.factureService.findAll({ clientId: this.clientId }));
                const currentF = allF.find(f => f.ficheId === this.ficheId);
                if (currentF) {
                    const paid = (currentF.paiements as any[])?.reduce((acc, p) => acc + (p.montant || 0), 0) || 0;
                    hasPayment = paid > 0 || currentF.statut === 'PARTIEL' || currentF.statut === 'PAYEE';
                    console.log('✅ [DIAGNOSTIC] Async Payment Check Success:', { paid, status: currentF.statut, hasPayment });
                }
            } catch (e) {
                console.error('❌ [DIAGNOSTIC] Async Payment Check Failed:', e);
            }
        }

        let userForcedStatut: string | null = null;
        let userForcedType: string | null = null;

        // 4. Protection of existing official invoices
        const existingInvoice = this.linkedFactureSubject.value;
        const hasExistingOfficialInvoice = existingInvoice &&
            (existingInvoice.type === 'FACTURE' ||
                existingInvoice.statut === 'VALIDE' ||
                existingInvoice.statut === 'PAYEE' ||
                existingInvoice.statut === 'PARTIEL');

        if (hasExistingOfficialInvoice) {
            console.log('🛡️ [INVOICE PROTECTION] Existing official invoice detected. Skipping status override.');
        } else if (hasPayment) {
            console.log('💰 Payment detected -> Upgrading to BON_COMM');
            userForcedType = 'BON_COMM';
            userForcedStatut = 'VENTE_EN_INSTANCE';
            this.snackBar.open('Acpte détecté : Vente passée en "Bon de Commande".', 'OK', { duration: 4000 });
        }

        operation.pipe(
            switchMap(fiche => {
                const isNew = !this.ficheId || this.ficheId === 'new';
                this.ficheId = fiche.id;
                this.isEditMode = false;
                this.ficheForm.disable();

                // 5. Sync with FactureComponent if it exists
                if (this.factureComponent) {
                    console.log('🔗 [onSubmit] Syncing with FactureComponent. Fiche ID:', fiche.id);
                    this.factureComponent.ficheIdInput = fiche.id;
                    
                    const freshLines = this.getInvoiceLines();
                    const freshNomenclature = this.nomenclatureString;

                    if (freshNomenclature) {
                        this.factureComponent.form.patchValue({ proprietes: { nomenclature: freshNomenclature } });
                    }

                    if (freshLines && freshLines.length > 0) {
                        const fa = this.factureComponent.lignes;
                        fa.clear();
                        freshLines.forEach(l => {
                            const group = this.factureComponent.createLigne();
                            group.patchValue(l);
                            fa.push(group);
                        });
                        this.factureComponent.calculateTotals();
                    }

                    if (userForcedStatut) {
                        this.factureComponent.form.patchValue({ statut: userForcedStatut }, { emitEvent: false });
                    }
                    if (userForcedType) {
                        this.factureComponent.form.patchValue({ type: userForcedType }, { emitEvent: false });
                    }

                    // Dirty check for invoice
                    const currentLines = this.getInvoiceLines();
                    const linesChanged = JSON.stringify(currentLines) !== JSON.stringify(this.initialLines);
                    const isNewInvoice = !this.factureComponent.id || this.factureComponent.id === 'new';

                    if (!linesChanged && !isNewInvoice && !userForcedStatut && !userForcedType) {
                        console.log('📋 [INVOICE SKIP] No changes to invoice lines or status.');
                        return of({ fiche, isNew });
                    }

                    return this.factureComponent.saveAsObservable(true).pipe(
                        map(() => ({ fiche, isNew })),
                        catchError(err => {
                            if (err.status === 409) return of({ fiche, isNew });
                            throw err;
                        })
                    );
                }
                return of({ fiche, isNew });
            })
        ).subscribe({
            next: ({ fiche, isNew }) => {
                this.loading = false;
                this.isEditMode = false;
                this.ficheForm.disable();
                this.snackBar.open('Fiche enregistrée avec succès', 'OK', { duration: 3000 });
                
                // Track "Vente Validée" in journal if we just converted from Devis
                if (formValue.statut === 'VALIDE' && this.currentFiche?.statut === 'DEVIS_EN_COURS') {
                    this.addToJournal('Vente Validée', 'Facture validée et stock décrémenté', 'deliver');
                }

                if (isNew) {
                    this.router.navigate(['/p/clients', this.clientId, 'fiche-lentilles', fiche.id]);
                } else {
                    this.loadFiche();
                    this.loadLinkedInvoice();
                }
            },
            error: (err) => {
                console.error(err);
                this.loading = false;
                this.snackBar.open('Erreur lors de l\'enregistrement', 'Erreur', { duration: 3000 });
            }
        });
    }

    // --- Suivi Commande Logic ---

    get suiviStatut(): string {
        return this.ficheForm.get('suiviCommande.statut')?.value || 'A_COMMANDER';
    }

    private generateBCNumber(): string {
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `BC-L${year}${month}${day}-${random}`;
    }

    setOrderStatus(statut: string): void {
        const group = this.ficheForm.get('suiviCommande');
        if (!group) return;

        const now = new Date();
        const currentJournal = group.get('journal')?.value || [];
        let description = '';

        if (statut === 'COMMANDE') {
            const bcNum = this.generateBCNumber();
            group.patchValue({
                statut: statut,
                dateCommande: now,
                referenceCommande: bcNum
            });
            const supplier = group.get('fournisseur')?.value;
            description = `Commande envoyée au fournisseur ${supplier ? ': ' + supplier : ''} (BC: ${bcNum})`;
        } else if (statut === 'RECU') {
            group.patchValue({
                statut: statut,
                dateReception: now
            });
            description = 'Produit reçu à l\'atelier';
        } else if (statut === 'LIVRE_CLIENT') {
            group.patchValue({
                statut: statut,
                dateLivraison: now
            });
            description = 'Équipement livré au client';
        }

        if (description) {
            const bcNumber = group.get('referenceCommande')?.value;
            const newEntry = {
                date: now,
                description: description,
                type: statut.toLowerCase(),
                bcNumber: bcNumber,
                fournisseur: group.get('fournisseur')?.value
            };
            group.patchValue({
                journal: [newEntry, ...currentJournal]
            });

            // Capture BC in history if it's a new command
            if (statut === 'COMMANDE' && bcNumber) {
                const motive = group.get('nextBcMotive')?.value || 'Standard';
                const bcRecord = {
                    numero: bcNumber,
                    date: now,
                    fournisseur: group.get('fournisseur')?.value,
                    motive: motive,
                    ficheId: this.ficheId,
                    ficheNumero: this.currentFiche?.numero,
                    client: this.clientDisplayName,
                    // Store snapshots of lens data for re-print accuracy
                    lentilles: JSON.parse(JSON.stringify(this.ficheForm.get('lentilles')?.value || {})),
                    ordonnance: JSON.parse(JSON.stringify(this.ficheForm.get('ordonnance')?.value || {}))
                };
                
                const history = group.get('bcHistorique')?.value || [];
                group.patchValue({
                    bcHistorique: [bcRecord, ...history],
                    nextBcMotive: '' // Reset motive
                });
            }
        }

        this.cdr.markForCheck();
        
        // Auto-save
        if (this.ficheId && this.ficheId !== 'new' && !this.isEditMode) {
            this.saveSuiviCommande();
        }
    }

    /**
     * Prints the premium technical sheet for lenses
     */
    public printFicheTechnique(): void {
        const ord = this.ficheForm.get('ordonnance')?.value || {};
        const lentilles = this.ficheForm.get('lentilles')?.value || {};
        const adaptation = this.ficheForm.get('adaptation')?.value || {};
        const suivi = this.ficheForm.get('suiviCommande')?.value || {};
        const today = new Date().toLocaleDateString('fr-FR');
        const ref = suivi.referenceCommande || 'N/A';
        const client = this.clientDisplayName || 'Client';

        // Dynamic Logo and Company Name
        const logoUrl = this.companySettings?.logoUrl || `${window.location.origin}/assets/images/logo.png`;
        const companyName = this.companySettings?.name || 'OPTISASS';

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            this.snackBar.open('Activez les popups pour imprimer', 'OK', { duration: 5000, verticalPosition: 'top' });
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>Fiche Technique Lentilles - ${client}</title>
                <style>
                    @page { size: A4 portrait; margin: 0 !important; }
                    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 12mm; line-height: 1.4; font-size: 9.5pt; background: #fff; }
                    
                    .header { display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
                    .logo-box { display: flex; align-items: center; gap: 12px; }
                    .logo-img { height: 65px; width: auto; object-fit: contain; }
                    .company-info { text-align: right; }
                    .company-info h1 { margin: 0; font-size: 18pt; font-weight: 950; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px; }
                    .doc-title { margin-top: 4px; font-size: 13pt; color: #3b82f6; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
                    
                    .section { margin-bottom: 20px; }
                    .section-title { color: #94a3b8; font-size: 8.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; display: flex; align-items: center; gap: 8px; }
                    .title-dot { width: 6px; height: 6px; background: #3b82f6; border-radius: 50%; }

                    .client-box { background: #f8fafc; border-radius: 8px; padding: 12px 15px; margin-bottom: 20px; border-left: 4px solid #0f172a; }
                    .client-box strong { font-size: 11pt; color: #0f172a; }

                    .tables-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; background: white; }
                    th { text-align: left; font-size: 8pt; text-transform: uppercase; color: #64748b; padding: 8px; font-weight: 800; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
                    td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; font-size: 9.5pt; font-weight: 600; }
                    .eye-cell { font-weight: 900; color: #3b82f6; width: 35px; }

                    .adaptation-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px; }
                    .ad-item { background: #fff; border: 1px solid #e2e8f0; padding: 8px 10px; border-radius: 6px; }
                    .ad-label { font-size: 7.5pt; color: #94a3b8; font-weight: 800; text-transform: uppercase; margin-bottom: 2px; }
                    .ad-val { font-size: 9pt; color: #1e293b; font-weight: 700; }

                    .sig-row { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; }
                    .sig-box { text-align: center; }
                    .sig-line { margin-top: 40px; border-top: 1.5px solid #0f172a; padding-top: 5px; font-size: 8pt; font-weight: 800; text-transform: uppercase; }

                    @media print { body { padding: 5mm; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo-box">
                        <img src="${logoUrl}" class="logo-img" alt="Logo">
                    </div>
                    <div class="company-info">
                        <h1>${companyName}</h1>
                        <div class="doc-title">Fiche Technique Lentilles</div>
                        <div style="font-size: 8pt; color: #64748b; font-weight: 700; margin-top: 2px;">RÉF: ${ref} | LE: ${today}</div>
                    </div>
                </div>

                <div class="client-box">
                    <strong>CLIENT:</strong> ${client}<br>
                    <span style="font-size: 8pt; color: #64748b;">Dossier N°: ${this.ficheId}</span>
                </div>

                <div class="section">
                    <div class="section-title"><span class="title-dot"></span> Correction & Lentilles</div>
                    <div class="tables-grid">
                        <div>
                            <table>
                                <thead><tr><th class="eye-cell"></th><th>Sphère</th><th>Cylindre</th><th>Axe</th><th>Add</th></tr></thead>
                                <tbody>
                                    <tr><td class="eye-cell">OD</td><td>${ord.od?.sphere || '0.00'}</td><td>${ord.od?.cylindre || '0.00'}</td><td>${ord.od?.axe || '0'}°</td><td>${ord.od?.addition || '0.00'}</td></tr>
                                    <tr><td class="eye-cell">OG</td><td>${ord.og?.sphere || '0.00'}</td><td>${ord.og?.cylindre || '0.00'}</td><td>${ord.og?.axe || '0'}°</td><td>${ord.og?.addition || '0.00'}</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div>
                            <table>
                                <thead><tr><th class="eye-cell"></th><th>Marque</th><th>Modèle</th><th>Rayon</th><th>Dia</th></tr></thead>
                                <tbody>
                                    <tr><td class="eye-cell">OD</td><td>${lentilles.od?.marque || '-'}</td><td>${lentilles.od?.modele || '-'}</td><td>${lentilles.od?.rayon || '-'}</td><td>${lentilles.od?.diametre || '-'}</td></tr>
                                    <tr><td class="eye-cell">OG</td><td>${(lentilles.diffLentilles ? lentilles.og?.marque : lentilles.od?.marque) || '-'}</td><td>${(lentilles.diffLentilles ? lentilles.og?.modele : lentilles.od?.modele) || '-'}</td><td>${(lentilles.diffLentilles ? lentilles.og?.rayon : lentilles.od?.rayon) || '-'}</td><td>${(lentilles.diffLentilles ? lentilles.og?.diametre : lentilles.od?.diametre) || '-'}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title"><span class="title-dot"></span> Adaptation & Examen Clinique</div>
                    <div class="adaptation-row">
                        <div class="ad-item"><div class="ad-label">Type</div><div class="ad-val">${lentilles.type || '-'}</div></div>
                        <div class="ad-item"><div class="ad-label">Usage</div><div class="ad-val">${lentilles.usage || '-'}</div></div>
                        <div class="ad-item"><div class="ad-label">Mouvement OD</div><div class="ad-val">${lentilles.od?.mouvement || '-'}</div></div>
                        <div class="ad-item"><div class="ad-label">Mouvement OG</div><div class="ad-val">${(lentilles.diffLentilles ? lentilles.og?.mouvement : lentilles.od?.mouvement) || '-'}</div></div>
                    </div>
                    <div class="adaptation-row">
                        <div class="ad-item"><div class="ad-label">Centrage OD</div><div class="ad-val">${lentilles.od?.centrage || '-'}</div></div>
                        <div class="ad-item"><div class="ad-label">Centrage OG</div><div class="ad-val">${(lentilles.diffLentilles ? lentilles.og?.centrage : lentilles.od?.centrage) || '-'}</div></div>
                        <div class="ad-item"><div class="ad-label">Séc. Lacrym (OD/OG)</div><div class="ad-val">${adaptation.od?.secretionLacrimale || '-'}/${adaptation.og?.secretionLacrimale || '-'} mm</div></div>
                        <div class="ad-item"><div class="ad-label">B.U.T (OD/OG)</div><div class="ad-val">${adaptation.od?.but || '-'}/${adaptation.og?.but || '-'} sec</div></div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title"><span class="title-dot"></span> Kératométrie</div>
                    <table>
                        <thead><tr><th class="eye-cell"></th><th>K1 (H)</th><th>K2 (V)</th><th>Axe</th><th>K.Moy</th></tr></thead>
                        <tbody>
                            <tr><td class="eye-cell">OD</td><td>${lentilles.od?.keratoH || '-'}</td><td>${lentilles.od?.keratoV || '-'}</td><td>${lentilles.od?.keratoAxe || '-'}°</td><td>${lentilles.od?.keratoMoy || '-'}</td></tr>
                            <tr><td class="eye-cell">OG</td><td>${(lentilles.diffLentilles ? lentilles.og?.keratoH : lentilles.od?.keratoH) || '-'}</td><td>${(lentilles.diffLentilles ? lentilles.og?.keratoV : lentilles.od?.keratoV) || '-'}</td><td>${(lentilles.diffLentilles ? lentilles.og?.keratoAxe : lentilles.od?.keratoAxe) || '-'}°</td><td>${(lentilles.diffLentilles ? lentilles.og?.keratoMoy : lentilles.od?.keratoMoy) || '-'}</td></tr>
                        </tbody>
                    </table>
                </div>

                <div class="sig-row">
                    <div class="sig-box"><div class="sig-line">Opticien / Adaptateur</div></div>
                    <div class="sig-box"><div class="sig-line">Cachet Établissement</div></div>
                </div>

                <script>
                    window.onload = function() { window.print(); setTimeout(() => window.close(), 1000); }
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    /**
     * Prints the premium Bon de Commande for lenses
     */
    public printBC(): void {
        const ord = this.ficheForm.get('ordonnance')?.value || {};
        const lentilles = this.ficheForm.get('lentilles')?.value || {};
        const suivi = this.ficheForm.get('suiviCommande')?.value || {};
        const today = new Date().toLocaleDateString('fr-FR');
        const ref = suivi.referenceCommande || 'N/A';

        // Dynamic Logo and Company Name
        const logoUrl = this.companySettings?.logoUrl || `${window.location.origin}/assets/images/logo.png`;
        const companyName = this.companySettings?.name || 'OPTISASS';

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            this.snackBar.open('Activez les popups pour imprimer', 'OK', { duration: 5000, verticalPosition: 'top' });
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <title>Bon de Commande Lentilles - ${ref}</title>
                <style>
                    @page { size: A4 portrait; margin: 0 !important; }
                    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 15mm; line-height: 1.5; font-size: 10pt; background: #fff; }
                    
                    .header { display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
                    .logo-box { display: flex; align-items: center; gap: 15px; }
                    .logo-img { height: 75px; width: auto; object-fit: contain; }
                    .company-info { text-align: right; }
                    .company-info h1 { margin: 0; font-size: 22pt; font-weight: 950; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px; }
                    .doc-title { margin-top: 5px; font-size: 16pt; color: #3b82f6; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; }
                    
                    .meta-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 35px; }
                    .info-card { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; }
                    .info-card label { display: block; font-size: 8.5pt; color: #64748b; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; }
                    .info-card p { margin: 0; font-size: 13pt; font-weight: 800; color: #1e293b; }

                    .section-label { color: #94a3b8; font-size: 9pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
                    
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th { text-align: left; font-size: 8.5pt; text-transform: uppercase; color: #94a3b8; padding: 12px 10px; font-weight: 800; border-bottom: 2px solid #e2e8f0; }
                    td { padding: 15px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11pt; font-weight: 500; }
                    .eye-row { font-weight: 900; color: #3b82f6; width: 60px; }

                    .cachet-section { text-align: center; margin-top: 60px; }
                    .cachet-box { display: inline-block; width: 240px; height: 110px; border: 2px dashed #cbd5e1; border-radius: 16px; margin-top: 10px; }

                    @media print { body { padding: 10mm 15mm; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo-box"><img src="${logoUrl}" class="logo-img"></div>
                    <div class="company-info">
                        <h1>${companyName}</h1>
                        <div class="doc-title">Bon de Commande Lentilles</div>
                    </div>
                </div>

                <div class="meta-info">
                    <div class="info-card"><label>Fournisseur</label><p>${suivi.fournisseur || '-'}</p></div>
                    <div class="info-card"><label>Référence BC / Date</label><p>${ref} — ${today}</p></div>
                </div>

                <div class="section-label">Détails de la Commande</div>
                <table>
                    <thead>
                        <tr>
                            <th>Oeil</th>
                            <th>Produit (Marque / Modèle)</th>
                            <th>Sphère</th>
                            <th>Cyl / Axe</th>
                            <th>Rayon / Dia</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="eye-row">OD</td>
                            <td>${lentilles.od?.marque || ''} ${lentilles.od?.modele || ''}</td>
                            <td>${ord.od?.sphere || '0.00'}</td>
                            <td>${ord.od?.cylindre || '0.00'} / ${ord.od?.axe || '0'}°</td>
                            <td>${lentilles.od?.rayon || '-'} / ${lentilles.od?.diametre || '-'}</td>
                        </tr>
                        <tr>
                            <td class="eye-row">OG</td>
                            <td>${(lentilles.diffLentilles ? lentilles.og?.marque : lentilles.od?.marque) || ''} ${(lentilles.diffLentilles ? lentilles.og?.modele : lentilles.od?.modele) || ''}</td>
                            <td>${ord.og?.sphere || '0.00'}</td>
                            <td>${ord.og?.cylindre || '0.00'} / ${ord.og?.axe || '0'}°</td>
                            <td>${(lentilles.diffLentilles ? lentilles.og?.rayon : lentilles.od?.rayon) || '-'} / ${(lentilles.diffLentilles ? lentilles.og?.diametre : lentilles.od?.diametre) || '-'}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="cachet-section">
                    <p style="font-weight: 800; color: #475569;">Cachet du Magasin</p>
                    <div class="cachet-box"></div>
                </div>

                <script>
                    window.onload = function() { window.print(); setTimeout(() => window.close(), 1000); }
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }


    /**
     * Reset the process for damage handling
     */
    reportCasse(): void {
        const confirmCasse = confirm("Voulez-vous déclarer une casse et relancer le processus de commande ?");
        if (!confirmCasse) return;

        const group = this.ficheForm.get('suiviCommande');
        if (!group) return;

        const now = new Date();
        const currentJournal = group.get('journal')?.value || [];
        const count = group.get('casseCount')?.value || 0;

        // Reset to A_COMMANDER and increment count
        group.patchValue({
            statut: 'A_COMMANDER',
            dateCommande: null,
            dateReception: null,
            dateLivraison: null,
            casseCount: count + 1,
            hasCasse: true
        });

        // Add to journal with motive
        const newEntry = {
            date: now,
            description: `⚠️ Casse déclarée (Relance N°${count + 1})`,
            type: 'casse'
        };

        group.patchValue({
            journal: [newEntry, ...currentJournal],
            nextBcMotive: 'Casse'
        });

        this.snackBar.open('Processus de commande relancé pour casse.', 'OK', { duration: 3000 });
        this.cdr.markForCheck();
        
        if (this.ficheId && this.ficheId !== 'new') {
            this.saveSuiviCommande();
        }
    }

    getStepState(stepStatus: string): string {
        const current = this.suiviStatut;
        const levels = ['A_COMMANDER', 'COMMANDE', 'RECU', 'LIVRE_CLIENT'];
        const currentIndex = levels.indexOf(current);
        const stepIndex = levels.indexOf(stepStatus);

        if (currentIndex > stepIndex) return 'completed';
        if (currentIndex === stepIndex) return 'active';
        return 'pending';
    }

    getProgressBarWidth(): string {
        const status = this.suiviStatut;
        if (status === 'A_COMMANDER') return '0%';
        if (status === 'COMMANDE') return '33%';
        if (status === 'RECU') return '66%';
        if (status === 'LIVRE_CLIENT') return '100%';
        return '0%';
    }

    getStepClass(stepStatus: string): string {
        const state = this.getStepState(stepStatus);
        if (state === 'completed') return 'bg-blue-500 text-white shadow-blue-200 border-2 border-blue-500';
        if (state === 'active') return 'bg-blue-50 text-blue-600 border-2 border-blue-500 shadow-blue-100';
        return 'bg-gray-50 text-gray-400 border-2 border-gray-200 shadow-none';
    }

    getStepTextClass(stepStatus: string): string {
        const state = this.getStepState(stepStatus);
        if (state === 'completed') return 'text-white';
        if (state === 'active') return 'text-blue-600';
        return 'text-gray-400';
    }

    getTextClass(stepStatus: string): string {
        const state = this.getStepState(stepStatus);
        const isCurrent = this.suiviStatut === stepStatus;

        if (isCurrent) return 'text-blue-600';
        if (state === 'completed') return 'text-gray-800';
        return 'text-gray-400 font-medium';
    }

    getNextStatusIcon(): string {
        const status = this.suiviStatut;
        if (status === 'A_COMMANDER') return 'send';
        if (status === 'COMMANDE') return 'task_alt';
        if (status === 'RECU') return 'storefront';
        return 'check_circle';
    }

    getNextStatusText(current: boolean = false): string {
        const status = this.suiviStatut;
        if (current) {
            switch (status) {
                case 'A_COMMANDER': return 'À COMMANDER';
                case 'COMMANDE': return 'EN COMMANDE';
                case 'RECU': return 'REÇU ATELIER';
                case 'LIVRE_CLIENT': return 'LIVRÉ CLIENT';
                default: return 'À COMMANDER';
            }
        } else {
            switch (status) {
                case 'A_COMMANDER': return 'Marquer comme Commandé';
                case 'COMMANDE': return 'Marquer comme Reçu';
                case 'RECU': return 'Marquer comme Livré au Client';
                case 'LIVRE_CLIENT': return 'Livraison Terminée';
                default: return 'Marquer comme Commandé';
            }
        }
    }

    advanceOrderStatus(): void {
        const status = this.suiviStatut;
        if (status === 'A_COMMANDER') {
            this.setOrderStatus('COMMANDE');
            this.showOrderActions();
        }
        else if (status === 'COMMANDE') this.setOrderStatus('RECU');
        else if (status === 'RECU') this.setOrderStatus('LIVRE_CLIENT');

        // Trigger safe save if we are just advancing status outside of full edit
        if (!this.isEditMode) {
            this.saveSuiviCommande();
        }
    }

    private saveSuiviCommande(): void {
        if (!this.ficheId || this.ficheId === 'new') return;
        
        const suiviData = this.ficheForm.get('suiviCommande')?.getRawValue();
        if (!suiviData) return;

        console.log('📤 [SUIVI] Auto-saving lentilles suivi...', suiviData);
        // [FIX] REMOVED REDUNDANT 'content' NESTING
        const payload = {
            suiviCommande: suiviData
        };

        this.ficheService.updateFiche(this.ficheId, payload as any).subscribe({
            next: () => {
                console.log('✅ [SUIVI] Saved successfully');
                this.snackBar.open('Suivi mis à jour', 'OK', { duration: 2000 });
            },
            error: (err) => console.error('❌ [SUIVI] Error auto-saving suivi:', err)
        });
    }

    /**
     * Shows the dialog with options to print or email the purchase order
     */
    public showOrderActions(): void {
        const group = this.ficheForm.get('suiviCommande');
        if (!group) return;

        const bcNumber = group.get('referenceCommande')?.value;
        const supplierName = group.get('fournisseur')?.value;
        const clientName = this.client ? 
            (isClientParticulier(this.client) ? `${this.client.prenom} ${this.client.nom}` : (this.client as any).nom || 'Client Inconnu') : 
            'Client Inconnu';

        const dialogRef = this.dialog.open(OrderActionDialogComponent, {
            width: 'auto',
            minWidth: '600px',
            maxWidth: '95vw',
            data: {
                bcNumber,
                ficheId: this.ficheId,
                clientName,
                supplierName
            }
        });

        dialogRef.afterClosed().subscribe(action => {
            if (action === 'print') {
                this.printBC();
            } else if (action === 'email') {
                this.emailOrder();
            } else if (action === 'whatsapp') {
                this.whatsappOrder();
            }
        });
    }

    /**
     * Calls the backend to send the purchase order via email
     */
    public emailOrder(): void {
        if (!this.ficheId || this.ficheId === 'new') return;

        this.loading = true;
        this.cdr.markForCheck();

        this.ficheService.sendOrderEmail(this.ficheId).subscribe({
            next: (res) => {
                this.loading = false;
                this.snackBar.open('Bon de commande envoyé par email avec succès', 'Fermer', { duration: 5000 });
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.loading = false;
                console.error('Error sending order email:', err);
                this.snackBar.open('Erreur lors de l\'envoi de l\'email: ' + (err.error?.message || err.message), 'Fermer', { duration: 5000 });
                this.cdr.markForCheck();
            }
        });
    }

    /**
     * Constructs a WhatsApp message and opens web.whatsapp.com
     */
    public whatsappOrder(): void {
        const group = this.ficheForm.get('suiviCommande');
        if (!group) return;

        const bcNumber = group.get('referenceCommande')?.value || this.generateReference(group.get('dateCommande')?.value || new Date());
        const supplierName = group.get('fournisseur')?.value || '-';
        const clientName = this.client ? 
            (isClientParticulier(this.client) ? `${this.client.prenom} ${this.client.nom}`.trim() : (this.client as any).nom || 'Client') : 
            'Client';

        const lentilles = this.ficheForm.get('lentilles')?.value;
        const bothEyesGroup = this.ficheForm.get('diffLentilles');
        const differentODOG = bothEyesGroup ? bothEyesGroup.value : false;

        let detailsLentilles = '';
        if (differentODOG) {
           const od = this.ficheForm.get('od')?.value;
           const og = this.ficheForm.get('og')?.value;
           detailsLentilles = `*Lentilles*\nOD : Sph ${od?.Sph || '0.00'} | Cyl ${od?.Cyl || '0.00'} | Axe ${od?.Axe || '0'} | Add ${od?.Add || '0.00'}\nOG : Sph ${og?.Sph || '0.00'} | Cyl ${og?.Cyl || '0.00'} | Axe ${og?.Axe || '0'} | Add ${og?.Add || '0.00'}`;
        } else {
           const od = this.ficheForm.get('od')?.value; // Used as both if not separated
           detailsLentilles = `*Lentilles*\nSph ${od?.Sph || '0.00'} | Cyl ${od?.Cyl || '0.00'} | Axe ${od?.Axe || '0'} | Add ${od?.Add || '0.00'}`;
        }

        const orderDetails = [
            `*Bon de Commande ${bcNumber}*`,
            `Client : ${clientName}`,
            `Fournisseur : ${supplierName}`,
            ``,
            detailsLentilles,
            `Marque : ${lentilles?.Marque || '-'}`,
            `Type : ${lentilles?.Matiere || '-'}`
        ].join('\n');

        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(orderDetails)}`;
        window.open(whatsappUrl, '_blank');
    }

    private generateReference(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `BC-${year}${month}-XXX`; // Fallback format
    }

    private addToJournal(description: string, detail?: string, type: string = 'info'): void {
        const group = this.ficheForm.get('suiviCommande');
        if (!group) return;

        const currentJournal = group.get('journal')?.value || [];
        const newEntry = {
            date: new Date(),
            description: description,
            detail: detail || '',
            type: type
        };

        group.patchValue({
            journal: [newEntry, ...currentJournal]
        });
        
        this.cdr.markForCheck();
    }

    private cleanJournalDescription(desc: string): string {
        if (!desc) return '';
        return desc
            .replace(/reÃ§u/g, 'reçu')
            .replace(/reÃ§ue/g, 'reçue')
            .replace(/dÃ©clarÃ©e/g, 'déclarée')
            .replace(/dÃ©crÃ©mentÃ©/g, 'décrémenté')
            .replace(/validÃ©e/g, 'validée')
            .replace(/payÃ©e/g, 'payée')
            .replace(/envoyÃ©e/g, 'envoyée')
            .replace(/livrÃ©/g, 'livré')
            .replace(/Ã©/g, 'é')  // Correct sequence for é
            .replace(/Ã¨/g, 'è')  // Correct sequence for è
            .replace(/Ãª/g, 'ê')  // Correct sequence for ê
            .replace(/Ã¹/g, 'ù')
            .replace(/Ã§/g, 'ç')
            .replace(/Ã /g, 'à')  // Correct sequence for à
            .replace(/Ã¢/g, 'â')
            .replace(/Ã´/g, 'ô')
            .replace(/NÂ°/g, 'N°') // Correct sequence for N°
            .replace(/âš ï¸ /g, '⚠️') 
            .replace(/ðŸ”„/g, '🔄')
            .replace(/âœ…/g, '✅')
            .replace(/â Œ/g, '❌')
            .replace(/ðŸš€/g, '🚀')
            .replace(/ðŸ“‹/g, '📋');
    }

    getTimelineEvents(): any[] {
        const group = this.ficheForm?.get('suiviCommande');
        if (!group) return [];

        const journal = group.get('journal')?.value || [];
        const legacyCasses = group.get('casseHistorique')?.value || [];
        const created = this.currentFiche ? ((this.currentFiche as any).dateCreation || (this.currentFiche as any).createdAt) : null;
        
        let events: any[] = [];
        
        // 1. Creation
        if (created) {
            events.push({ date: created, description: 'Création de la fiche', type: 'create' });
        }

        // 2. Journal entries (manual + automatic legacy)
        if (Array.isArray(journal)) {
            journal.forEach((j: any) => {
                if (j.type !== 'create') events.push(j);
            });
        }

        // 3. Journal Auto (New System)
        const journalAuto = group.get('journalAuto')?.value;
        if (Array.isArray(journalAuto)) {
            events = [...events, ...journalAuto];
        }

        // 4. Fallback for legacy dates
        const journalTypes = events.map(e => String(e.type).toLowerCase());
        
        if (!journalTypes.includes('order') && !journalTypes.includes('commande') && group.get('dateCommande')?.value) {
            events.push({ date: group.get('dateCommande').value, description: 'Commande envoyée au fournisseur', type: 'order' });
        }
        if (!journalTypes.includes('receive') && !journalTypes.includes('recu') && group.get('dateReception')?.value) {
            events.push({ date: group.get('dateReception').value, description: 'Lentilles reçues à l\'atelier', type: 'receive' });
        }
        if (!journalTypes.includes('deliver') && !journalTypes.includes('livre_client') && group.get('dateLivraison')?.value) {
            events.push({ date: group.get('dateLivraison').value, description: 'Équipement livré au client', type: 'deliver' });
        }

        // 5. Apply runtime cleaning to handle legacy corrupted data in DB
        events.forEach(e => {
            if (e.description) e.description = this.cleanJournalDescription(e.description);
            if (e.type) e.type = this.cleanJournalDescription(e.type);
        });

        const seen = new Set();
        const uniqueEvents = events.filter(e => {
            const key = `${new Date(e.date).getTime()}-${e.description}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return uniqueEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    getTimelineDotClass(type: string | undefined): string {
        const t = String(type || '').toLowerCase();
        if (t === 'create' || t === 'creation') return 'bg-gray-400 ring-gray-100';
        if (t === 'order' || t === 'commande') return 'bg-blue-400 ring-blue-50';
        if (t === 'receive' || t === 'recu') return 'bg-green-400 ring-green-50';
        if (t === 'deliver' || t === 'livre_client') return 'bg-purple-400 ring-purple-50';
        if (t === 'casse') return 'bg-red-500 ring-red-100';
        if (t === 'email') return 'bg-indigo-400 ring-indigo-50';
        return 'bg-blue-500 ring-blue-50';
    }

    // --- Sales & Billing Logic ---

    getInvoiceLines(): any[] {
        const lignes: any[] = [];
        const formValue = this.ficheForm.getRawValue();
        const lentilles = formValue.lentilles;

        if (lentilles) {
            const type = lentilles.type || '';
            const usage = lentilles.usage || '';

            if (lentilles.diffLentilles) {
                // OD
                const od = lentilles.od;
                if (od && od.prix > 0) {
                    lignes.push({
                        description: `Lentille OD ${od.marque} ${od.modele} (${type} ${usage})`.trim(),
                        qte: 1,
                        prixUnitaireTTC: parseFloat(od.prix),
                        remise: 0,
                        totalTTC: parseFloat(od.prix),
                        productId: od.productId || null,
                        entrepotId: od.entrepotId || null,
                        entrepotType: od.entrepotType || null,
                        entrepotNom: od.entrepotNom || null
                    });
                }
                // OG
                const og = lentilles.og;
                if (og && og.prix > 0) {
                    lignes.push({
                        description: `Lentille OG ${og.marque} ${og.modele} (${type} ${usage})`.trim(),
                        qte: 1,
                        prixUnitaireTTC: parseFloat(og.prix),
                        remise: 0,
                        totalTTC: parseFloat(og.prix),
                        productId: og.productId || null,
                        entrepotId: og.entrepotId || null,
                        entrepotType: og.entrepotType || null,
                        entrepotNom: og.entrepotNom || null
                    });
                }
            } else {
                // Unified
                const od = lentilles.od;
                if (od && od.prix > 0) {
                    // OD side
                    lignes.push({
                        description: `Lentille OD: ${od.marque || ''} ${od.modele || ''} (${type} ${usage})`.trim(),
                        qte: 1,
                        prixUnitaireTTC: parseFloat(od.prix),
                        remise: 0,
                        totalTTC: parseFloat(od.prix),
                        productId: od.productId || null,
                        entrepotId: od.entrepotId || null,
                        entrepotType: od.entrepotType || null,
                        entrepotNom: od.entrepotNom || null
                    });
                    // OG side (same product)
                    lignes.push({
                        description: `Lentille OG: ${od.marque || ''} ${od.modele || ''} (${type} ${usage})`.trim(),
                        qte: 1,
                        prixUnitaireTTC: parseFloat(od.prix),
                        remise: 0,
                        totalTTC: parseFloat(od.prix),
                        productId: od.productId || null,
                        entrepotId: od.entrepotId || null,
                        entrepotType: od.entrepotType || null,
                        entrepotNom: od.entrepotNom || null
                    });
                }
            }
        }

        return lignes;
    }

    onInvoiceSaved(facture: any): void {
        this.linkedFactureSubject.next(facture);
        this.linkedFacture = facture;
        if (this.ficheId && this.ficheId !== 'new') {
            this.loadFiche();
        }
        this.cdr.markForCheck();
    }

    private toISODate(date: any): string | null {
        if (!date) return null;
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return null;
            return d.toISOString().split('T')[0];
        } catch {
            return null;
        }
    }

    // --- Transfer & Reception Logic ---

    /**
     * Checks if products in an INSTANCE sale are now received
     */
    checkReceptionForInstance(fiche: any): void {
        console.log('🔍 [RECEPTION] Checking reception status for lentilles...');
        const isInstance = (this.linkedFactureSubject.value?.statut === 'VENTE_EN_INSTANCE');

        if (!isInstance) return;

        // Reset flags before fresh check
        this.receptionComplete = false;
        this.isReserved = false;
        this.isTransit = false;

        const mappings: { path: string, originalId: string }[] = [];

        if (fiche.lentilles?.od?.productId) {
            mappings.push({ path: 'lentilles.od', originalId: fiche.lentilles.od.productId });
        }

        if (fiche.lentilles?.og?.productId && fiche.lentilles?.diffLentilles) {
            mappings.push({ path: 'lentilles.og', originalId: fiche.lentilles.og.productId });
        }

        if (mappings.length === 0) {
            console.log('⚠️ [RECEPTION] No products found in fiche.');
            this.receptionComplete = true;
            this.cdr.markForCheck();
            return;
        }

        const currentCentreId = this.companySettings?.id;

            const checks = mappings.map(m => this.productService.findOne(m.originalId).pipe(
                map(p => ({ ...p, mappingPath: m.path })),
                catchError(err => {
                    console.error(`❌ [RECEPTION] Error fetching product ${m.originalId}:`, err);
                    return of(null);
                })
            ));

            forkJoin(checks).subscribe((productsWithMetadata: any[]) => {
                const products = productsWithMetadata.filter(p => !!p);

                if (!this.initialProductStatus && products.length > 0) {
                    this.initialProductStatus = products[0].quantiteActuelle <= 0 ? 'RUPTURE' : 'DISPONIBLE';
                }

                const allReceivedLocally = products.every(p =>
                    p.statut === ProductStatus.DISPONIBLE &&
                    !p.specificData?.pendingIncoming &&
                    p.quantiteActuelle > 0 &&
                    p.entrepot?.centreId === currentCentreId
                );

                if (allReceivedLocally) {
                    if (!this.receptionComplete) {
                        this.snackBar.open('📦 Les lentilles sont arrivées ! Vous pouvez maintenant valider la vente.', 'VOIR', { duration: 8000 });
                    }
                    this.receptionComplete = true;
                    this.isReserved = false;
                    this.isTransit = false;

                    const localMappingChecks = products.map(p => {
                        const reference = p.modele || p.referenceFournisseur || p.designation;
                        return this.productService.findAll({ search: reference }).pipe(
                            map(results => {
                                const localMatch = results.find(r =>
                                    r.entrepot?.centreId === currentCentreId &&
                                    r.entrepot?.type === 'PRINCIPAL' &&
                                    (r.modele === reference || r.referenceFournisseur === reference || r.designation === reference)
                                ) || p;
                                return { ...p, localProduct: localMatch };
                            }),
                            catchError(err => of({ ...p, localProduct: p }))
                        );
                    });

                    forkJoin(localMappingChecks).subscribe((mappedResults: any[]) => {
                        let changed = false;
                        const formValue = this.ficheForm.getRawValue();

                        mappedResults.forEach(res => {
                            const localP = res.localProduct;
                            const path = res.mappingPath;

                            if (path === 'lentilles.od') {
                                if (formValue.lentilles?.od?.productId !== localP.id) {
                                    this.ficheForm.get('lentilles.od')?.patchValue({
                                        productId: localP.id,
                                        entrepotType: 'PRINCIPAL'
                                    });
                                    changed = true;
                                }
                            } else if (path === 'lentilles.og') {
                                if (formValue.lentilles?.og?.productId !== localP.id) {
                                    this.ficheForm.get('lentilles.og')?.patchValue({
                                        productId: localP.id,
                                        entrepotType: 'PRINCIPAL'
                                    });
                                    changed = true;
                                }
                            }
                        });

                        if (changed) {
                            this.saveFicheSilently();
                        }
                        this.cdr.markForCheck();
                    });
                } else {
                    this.isTransit = products.some(p => p.specificData?.pendingIncoming?.status === 'SHIPPED');
                    this.isReserved = products.some(p =>
                        p.specificData?.pendingIncoming?.status === 'RESERVED' ||
                        (p.entrepot?.centreId !== currentCentreId && !p.specificData?.pendingIncoming)
                    );
                    this.receptionComplete = false;
                    this.cdr.markForCheck();
                }
            });
    }

    /**
     * Silently updates the fiche in the backend
     */
    saveFicheSilently(reload: boolean = true): void {
        if (!this.ficheId || this.ficheId === 'new' || !this.clientId) return;
        const formValue = this.ficheForm.getRawValue();

        const payload: any = {
            clientId: this.clientId,
            type: TypeFiche.LENTILLES,
            statut: this.currentFiche?.statut || StatutFiche.EN_COURS,
            montantTotal: this.currentFiche?.montantTotal || 0,
            montantPaye: this.currentFiche?.montantPaye || 0,
            ordonnance: formValue.ordonnance,
            lentilles: formValue.lentilles,
            adaptation: formValue.adaptation,
            suiviCommande: formValue.suiviCommande
        };

        this.ficheService.updateFiche(this.ficheId, payload).subscribe({
            next: (res) => {
                if (reload) {
                    this.loadFiche();
                } else {
                    this.currentFiche = { ...this.currentFiche, ...payload };
                }
            }
        });
    }

    /**
     * Final validation for an instanced sale
     */
    async validateInstancedSale() {
        if (!this.linkedFactureSubject.value) return;
        const currentFacture = this.linkedFactureSubject.value;

        if (this.isReserved || this.isTransit) {
            this.snackBar.open('⚠️ Impossible de valider la vente : le produit n\'a pas encore été réceptionné.', 'OK', { duration: 5000 });
            return;
        }

        const confirmValidation = confirm("Voulez-vous valider définitivement cette vente ?\nLe produit est maintenant en stock local.");
        if (!confirmValidation) return;

        try {
            this.loading = true;
            const lines = this.getInvoiceLines();
            const total = lines.reduce((acc, l) => acc + l.totalTTC, 0);
            const tvaRate = 0.20;
            const totalHT = total / (1 + tvaRate);
            const tva = total - totalHT;

            const updateData: any = {
                type: 'FACTURE',
                statut: 'VALIDE',
                lignes: this.getInvoiceLines(),
                totalTTC: total,
                totalHT: totalHT,
                totalTVA: tva,
                resteAPayer: Math.max(0, total - (currentFacture.totalTTC - currentFacture.resteAPayer)),
                proprietes: {
                    ...(currentFacture.proprietes || {}),
                    nomenclature: this.nomenclatureString || '',
                    validatedAt: new Date(),
                    isTransferFulfilled: true,
                    forceStockDecrement: true
                }
            };

            this.factureService.update(currentFacture.id, updateData).subscribe({
                next: (res) => {
                    this.loading = false;
                    this.snackBar.open('Vente validée et facture générée avec succès', 'Fermer', { duration: 5000 });
                    this.receptionComplete = false;
                    this.onInvoiceSaved(res);
                },
                error: (err) => {
                    this.loading = false;
                    console.error('❌ Error validating sale:', err);
                    alert("Erreur lors de la validation: " + (err.error?.message || err.message || 'Erreur inconnue'));
                }
            });
        } catch (e) {
            this.loading = false;
        }
    }

    onSuggestionGenerated(suggestion: any): void {
        // Suggestion handled by child, potentially trigger re-calc of visual aid
    }

    // --- File Upload & OCR Logic ---

    openFileUpload(): void {
        this.fileInput.nativeElement.click();
    }

    onFilesSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

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

                const prescriptionFile: PrescriptionFile = {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    preview,
                    file,
                    uploadDate: new Date()
                };
                this.prescriptionFiles.push(prescriptionFile);

                // Auto-trigger OCR for images
                if (file.type.startsWith('image/')) {
                    this.extractData(prescriptionFile);
                }

                this.cdr.markForCheck();
            };
            reader.readAsDataURL(file);
        });
        input.value = '';
    }

    async extractData(file: PrescriptionFile): Promise<void> {
        if (!file.type.startsWith('image/')) return;

        this.isProcessingOcr = true;
        this.cdr.markForCheck();

        try {
            // Import OCR functions dynamically
            const { extractTextFromImage } = await import('../../utils/ocr-extractor');
            const { parsePrescription } = await import('../../utils/prescription-parser');

            const text = await extractTextFromImage(file.file);
            console.log('Texte extrait (OCR):', text);

            const parsed = parsePrescription(text);
            console.log('Données parsées (OCR):', parsed);

            // Update Form - Ordonnance Section
            const ordGroup: any = {
                od: {
                    sphere: parsed.OD.sph !== 0 ? (parsed.OD.sph > 0 ? '+' : '') + parsed.OD.sph.toFixed(2) : '',
                    cylindre: parsed.OD.cyl !== 0 ? (parsed.OD.cyl > 0 ? '+' : '') + parsed.OD.cyl.toFixed(2) : '',
                    axe: parsed.OD.axis ? parsed.OD.axis + '°' : '',
                    addition: parsed.OD.add !== undefined ? (parsed.OD.add > 0 ? '+' : '') + parsed.OD.add.toFixed(2) : ''
                },
                og: {
                    sphere: parsed.OG.sph !== 0 ? (parsed.OG.sph > 0 ? '+' : '') + parsed.OG.sph.toFixed(2) : '',
                    cylindre: parsed.OG.cyl !== 0 ? (parsed.OG.cyl > 0 ? '+' : '') + parsed.OG.cyl.toFixed(2) : '',
                    axe: parsed.OG.axis ? parsed.OG.axis + '°' : '',
                    addition: parsed.OG.add !== undefined ? (parsed.OG.add > 0 ? '+' : '') + parsed.OG.add.toFixed(2) : ''
                }
            };

            // Handle Metadata (Date, Prescripteur)
            if (parsed.date) {
                const parts = parsed.date.split('/');
                if (parts.length === 3) {
                    const dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                    if (!isNaN(dateObj.getTime())) {
                        ordGroup.datePrescription = dateObj;
                    }
                }
            }
            if (parsed.prescripteur) {
                ordGroup.prescripteur = parsed.prescripteur;
            }

            // Patch Ordonnance group
            this.ficheForm.get('ordonnance')?.patchValue(ordGroup);

            // Also patch Lentilles section (Mapping corresponding spheres/cyls)
            this.ficheForm.get('lentilles')?.patchValue({
                od: {
                    sphere: ordGroup.od.sphere,
                    cylindre: ordGroup.od.cylindre,
                    axe: ordGroup.od.axe,
                    addition: ordGroup.od.addition
                },
                og: {
                    sphere: ordGroup.og.sphere,
                    cylindre: ordGroup.og.cylindre,
                    axe: ordGroup.og.axe,
                    addition: ordGroup.og.addition
                }
            });

            this.snackBar.open('Ordonnance analysée avec succès', 'OK', { duration: 3000 });
        } catch (error) {
            console.error('Erreur OCR:', error);
            this.snackBar.open('Impossible de lire l\'ordonnance', 'Erreur', { duration: 3000 });
        } finally {
            this.isProcessingOcr = false;
            this.cdr.markForCheck();
        }
    }

    viewFile(file: PrescriptionFile): void {
        this.viewingFile = file;
        this.cdr.markForCheck();
    }

    closeViewer(): void {
        this.viewingFile = null;
        this.cdr.markForCheck();
    }

    deleteFile(index: number): void {
        if (confirm('Supprimer ce document ?')) {
            this.prescriptionFiles.splice(index, 1);
            this.cdr.markForCheck();
        }
    }

    formatFileSize(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // --- Camera Methods ---
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
        const prescriptionFile: PrescriptionFile = {
            name: file.name,
            type: file.type,
            size: file.size,
            preview: dataUrl,
            file,
            uploadDate: new Date()
        };
        this.prescriptionFiles.push(prescriptionFile);
        this.extractData(prescriptionFile); // Auto OCR on capture
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

    loadSuppliers(): void {
        this.financeService.getSuppliers().subscribe({
            next: (suppliers: any) => {
                this.allSuppliers = suppliers;
                // Force triggering the filter to update visual list if needed on both controls
                const currVal = this.fournisseurCtrl.value || this.ficheForm.get('suiviCommande.fournisseur')?.value;
                if (currVal) {
                    this.fournisseurCtrl.setValue(currVal, { emitEvent: true });
                }
            },
            error: (err: any) => console.error('Erreur chargement fournisseurs:', err)
        });

        // Strong Sync for Supplier control
        this.fournisseurCtrl.valueChanges.subscribe(value => {
            let supplierName = '';
            if (typeof value === 'string') {
                supplierName = value;
            } else if (value && typeof value === 'object' && (value as any).nom) {
                supplierName = (value as any).nom;
            }
            
            // Sync to main form
            const suivi = this.ficheForm.get('suiviCommande');
            if (suivi && suivi.get('fournisseur')?.value !== supplierName) {
                suivi.get('fournisseur')?.patchValue(supplierName, { emitEvent: false });
                console.log('🔄 [SYNC] Supplier synced to form:', supplierName);
                
                // Trigger auto-save if in edit mode or transitional state
                if (!this.ficheForm.disabled && this.ficheId && this.ficheId !== 'new') {
                    this.saveFicheSilently(false);
                }
            }
        });
    }

    private _filterSuppliers(value: string | any): any[] {
        let filterValue = '';
        if (typeof value === 'string') {
            filterValue = value.toLowerCase();
        } else if (value && typeof value === 'object' && (value as any).nom) {
            filterValue = (value as any).nom.toLowerCase();
        }
        
        return this.allSuppliers.filter((supplier: any) => 
            supplier.nom.toLowerCase().includes(filterValue)
        );
    }

    displaySupplierFn(supplier: any): string {
        if (typeof supplier === 'string') return supplier;
        return supplier && supplier.nom ? supplier.nom : '';
    }

    loadCompanySettings(): void {
        this.companySettingsService.getSettings().subscribe({
            next: (settings) => {
                this.companySettings = settings;
                this.cdr.markForCheck();
            },
            error: (err) => console.error('Failed to load company settings', err)
        });
    }
}
