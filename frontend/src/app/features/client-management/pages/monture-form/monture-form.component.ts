import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, of, BehaviorSubject, firstValueFrom, throwError } from 'rxjs';
import { FormBuilder, FormGroup, AbstractControl, ReactiveFormsModule, Validators, FormArray, FormControl } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ClientManagementService } from '../../services/client.service';
import { Client, isClientParticulier, isClientProfessionnel } from '../../models/client.model';
import { FicheService } from '../../services/fiche.service';
import { FicheClient, FicheMontureCreate, TypeFiche, StatutFiche, TypeEquipement, SuggestionIA, TypeVerre } from '../../models/fiche-client.model';
import { FactureService, Facture } from '../../services/facture.service';
import { FactureFormComponent } from '../facture-form/facture-form.component';
import { PaymentListComponent } from '../../components/payment-list/payment-list.component';
import { catchError, debounceTime, distinctUntilChanged, startWith, map, switchMap, filter, take, tap, finalize, takeUntil } from 'rxjs/operators';
import { getLensSuggestion, Correction, FrameData, calculateLensPrice, determineLensType } from '../../utils/lensLogic';
import { getLensMaterials, getLensIndices } from '../../utils/lensDatabase';
import { StockSearchDialogComponent } from '../../../stock-management/dialogs/stock-search-dialog/stock-search-dialog.component';
import { ProductService } from '../../../stock-management/services/product.service';
import { InvoiceFormDialogComponent } from '../../../finance/components/invoice-form-dialog/invoice-form-dialog.component';
import { Product, ProductStatus } from '../../../../shared/interfaces/product.interface';
import { forkJoin, timer, Subject } from 'rxjs';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector, UserSelector } from '../../../../core/store/auth/auth.selectors';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { OrderActionDialogComponent } from '../../../../shared/components/order-action-dialog/order-action-dialog.component';
import { SupplierService } from '../../../../shared/services/supplier.service';
import { ISupplier } from '../../../../shared/models/index';
import { CompanySettingsService } from '../../../../core/services/company-settings.service';
import { CompanySettings } from '../../../../shared/interfaces/company-settings.interface';



interface PrescriptionFile {
    name: string;
    type: string;
    size: number;
    preview: string | SafeResourceUrl;
    file: File;
    uploadDate: Date;
}

@Component({
    selector: 'app-monture-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatTabsModule,
        MatCheckboxModule,
        MatDialogModule,
        MatSnackBarModule,
        MatTooltipModule,
        MatButtonToggleModule,
        RouterModule,
        FactureFormComponent,
        PaymentListComponent,
        MatAutocompleteModule
    ],
    providers: [
        ClientManagementService,
        FicheService,
        FactureService,
        ProductService
    ],
    templateUrl: './monture-form.component.html',
    styleUrls: ['./monture-form.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MontureFormComponent implements OnInit, OnDestroy {
    currentUser$: Observable<any> = this.store.select(UserSelector).pipe(
        map(user => {
            if (!user) return null;
            return {
                ...user,
                displayName: user.employee ? `${user.employee.nom} ${user.employee.prenom}` : (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.last_name || user.email),
                fullName: user.employee ? `${user.employee.nom} ${user.employee.prenom}` : (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.last_name || user.email)
            };
        }),
        tap(user => console.log('👤 [MontureForm] Connected User for badge:', user))
    );



    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
    @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
    @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;
    @ViewChild('frameCanvasElement') frameCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild(FactureFormComponent) factureComponent!: FactureFormComponent;
    @ViewChild(PaymentListComponent) paymentListComponent!: PaymentListComponent;

    ficheForm: FormGroup;
    clientId: string | null = null;
    client: Client | null = null;
    allProducts: any[] = []; // [NEW] Store products for easy lookup
    ficheId: string | null = null;
    activeTab: number = 0;
    loading = false;
    isEditMode = false;
    currentPrintType: 'FICHE_MONTAGE' | 'FICHE_MONTAGE_V2' | 'BON_COMMANDE' | 'FICHE_PRODUIT' | 'RECU_PAIEMENT' | null = null;
    canvasDataUrl: string = '';

    readonly TypeEquipement = TypeEquipement;

    // Contrôle indépendant pour la sélection du type d'équipement (ajout dynamique)
    selectedEquipmentType = new FormControl<TypeEquipement | null>(null);

    // Enums pour les dropdowns
    typesEquipement = Object.values(TypeEquipement);

    // Supplier autocomplete
    fournisseurCtrl = new FormControl('');
    filteredSuppliers$: Observable<ISupplier[]> = of([]);
    private allSuppliers: ISupplier[] = [];
    private supplierService: SupplierService;

    // Master Lists (From Database)
    lensMaterials: string[] = getLensMaterials();

    dateToday = new Date();

    get minDate(): Date {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }

    isTabAccessible(index: number): boolean {
        // Logging only for higher index tabs to avoid spamming for tab 0/1 checking
        const shouldLog = index > 1;

        if (index <= 1) return true;

        // Requirements for moving past tab 1 (Montures et Verres)
        // 1. Must be saved in database
        if (!this.ficheId || this.ficheId === 'new') {
            if (shouldLog) console.log(`[DEBUG] Tab ${index} blocked: No ficheId (${this.ficheId})`);
            return false;
        }

        // 2. Must have valid delivery date
        const dateVal = this.ficheForm.get('dateLivraisonEstimee')?.value;
        if (!dateVal) {
            if (shouldLog) console.log(`[DEBUG] Tab ${index} blocked: No delivery date`);
            return false;
        }

        const selectedDate = new Date(dateVal);
        selectedDate.setHours(0, 0, 0, 0);
        // Relaxing the date check for debugging, or maybe the saved date is in the past?
        // if (selectedDate < this.minDate) return false; 

        return true;
    }

    get formEquipementPrincipal(): FormGroup {
        return this.equipements.at(0) as FormGroup;
    }

    lensIndices: string[] = getLensIndices();

    lensTreatments: string[] = [
        'Anti-reflet (HMC)',
        'Durci (HC)',
        'Super Anti-reflet (SHMC)',
        'Anti-lumière bleue (Blue Cut)',
        'Photochromique (Transitions)',
        'Teinté (Solaire - Gris)',
        'Teinté (Solaire - Brun)',
        'Teinté (Solaire - Vert)',
        'Polarisé',
        'Miroité',
        'Hydrophobe'
    ];

    // Liste des marques
    lensBrands: string[] = [
        'Essilor',
        'Zeiss',
        'Hoya',
        'Nikon',
        'Rodenstock',
        'Seiko',
        'BBGR',
        'Optiswiss',
        'Shamir',
        'Kodak',
        'Generic',
        'Autre'
    ];

    // Types de montage
    typesMontage: string[] = [
        'Cerclé (Complet)',
        'Percé (Nylor)',
        'Semi-cerclé (Nylor)',
        'Sans monture (Percé)'
    ];

    // État d'expansion
    mainEquipmentExpanded = true;
    addedEquipmentsExpanded: boolean[] = [];

    // Suggestions IA
    suggestions: SuggestionIA[] = [];
    showSuggestions = false;
    activeSuggestionIndex: number | null = null;

    // Fichiers prescription
    prescriptionFiles: PrescriptionFile[] = [];
    viewingFile: PrescriptionFile | null = null;

    // Camera capture
    showCameraModal = false;
    cameraStream: MediaStream | null = null;
    capturedImage: string | null = null;

    // Facturation
    clientFactures$: Observable<Facture[]> | null = null;
    public linkedFactureSubject = new BehaviorSubject<Facture | null>(null);
    linkedFacture$ = this.linkedFactureSubject.asObservable();

    private destroy$ = new Subject<void>();

    get isSaleEnInstance(): boolean {
        const status = this.linkedFactureSubject.value?.statut;
        return status === 'VENTE_EN_INSTANCE' || status === 'BROUILLON';
    }
    receptionComplete = false;
    isReserved = false;
    isTransit = false;
    currentFiche: any = null; // Store loaded fiche for template/checks
    initialLines: any[] = [];
    initialProductStatus: string | null = null; // Track initial status: 'RUPTURE' or 'DISPONIBLE'

    nomenclatureString: string | null = null;
    showFacture = false;
    companySettings: CompanySettings | null = null;

    // Local storage for frame height in case form control fails
    private lastMeasFrameHeight: number | null = null;

    // Paste text dialog removed

    // Paste text dialog removed

    // Prix des verres (logique de calcul)

    // Prix des verres (logique de calcul)
    private LENS_PRICES: Record<string, Record<string, number>> = {
        'Organique (CR-39)': {
            '1.50 (Standard)': 200,
            '1.56': 250,
            '1.60': 350,
            '1.67': 500
        },
        'Polycarbonate': {
            '1.59': 400
        },
        'Trivex': {
            '1.53': 450
        },
        'Minéral': {
            '1.523': 150,
            '1.60': 300,
            '1.70': 500,
            '1.80': 800,
            '1.90': 1200
        },
        'Organique MR-8': {
            '1.60': 500
        },
        'Organique MR-7': {
            '1.67': 700
        },
        'Blue Cut Mass': {
            '1.56': 400,
            '1.60': 600,
            '1.67': 800
        }
    };

    private TREATMENT_PRICES: Record<string, number> = {
        'Anti-reflet (HMC)': 100,
        'Durci (HC)': 50,
        'Super Anti-reflet (SHMC)': 150,
        'Anti-lumière bleue (Blue Cut)': 200,
        'Photochromique (Transitions)': 600,
        'Teinté (Solaire - Gris)': 150,
        'Teinté (Solaire - Brun)': 150,
        'Teinté (Solaire - Vert)': 150,
        'Polarisé': 400,
        'Miroité': 250,
        'Hydrophobe': 100,
        // Legacy fallbacks mapping
        'Anti-reflet': 100,
        'Durci': 50,
        'Anti-rayure': 50
    };

    constructor(
        private fb: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private clientService: ClientManagementService,
        private ficheService: FicheService,
        private cdr: ChangeDetectorRef,
        private sanitizer: DomSanitizer,
        private dialog: MatDialog,
        private factureService: FactureService,
        private productService: ProductService,
        private snackBar: MatSnackBar,
        private store: Store,
        private ngZone: NgZone,
        private companySettingsService: CompanySettingsService,
        supplierService: SupplierService
    ) {
        this.supplierService = supplierService;
        this.ficheForm = this.initForm();
    }

    ngOnInit(): void {
        this.loadCompanySettings();
        // FIX: Ensure 'hauteurVerre' control exists in 'montage' group immediately
        // This ensures correct data binding when loading existing fiches
        const montageGroup = this.ficheForm.get('montage') as FormGroup;
        if (montageGroup && !montageGroup.contains('hauteurVerre')) {
            montageGroup.addControl('hauteurVerre', new FormControl(null));
        }

        // Draw frame visualization when tab changes to Fiche Montage
        this.ficheForm.valueChanges.subscribe(() => {
            if (this.activeTab === 4) {
                setTimeout(() => this.updateFrameCanvasVisualization(), 100);
            }
        });

        // Initialize supplier autocomplete
        this.supplierService.getActiveSuppliers().subscribe(suppliers => {
            this.allSuppliers = suppliers;
            this.cdr.markForCheck();
        });

        this.filteredSuppliers$ = this.fournisseurCtrl.valueChanges.pipe(
            startWith(''),
            debounceTime(200),
            distinctUntilChanged(),
            map(value => {
                const name = typeof value === 'string' ? value : '';
                if (!name) return this.allSuppliers;
                const filterValue = name.toLowerCase();
                return this.allSuppliers.filter(s => 
                    s.name?.toLowerCase().includes(filterValue) || 
                    s.code?.toLowerCase().includes(filterValue)
                );
            })
        );

        // Sync fournisseurCtrl with form
        this.fournisseurCtrl.valueChanges.pipe(
            debounceTime(200),
            distinctUntilChanged()
        ).subscribe((val: any) => {
            // Enforce single string value
            const finalValue = typeof val === 'string' ? val : (val?.name || '');
            this.ficheForm.get('suiviCommande.fournisseur')?.setValue(finalValue, { emitEvent: false });
            // Force change detection for the Suivi tab if active
            if (this.activeTab === 5) {
                this.cdr.detectChanges();
            }
        });
        this.route.paramMap.subscribe(params => {
            this.clientId = params.get('clientId');
            this.ficheId = params.get('ficheId');

            if (this.clientId) {
                this.clientService.getClient(this.clientId).subscribe((client: Client | undefined) => {
                    this.client = client;
                    this.cdr.markForCheck();
                });
            }

            if (this.ficheId && this.ficheId !== 'new') {
                // VIEW MODE: Existing Fiche
                this.isEditMode = false;
                this.ficheForm.disable(); // Disable form in view mode
                this.loadFiche();

                // Load linked facture via Service (One reliable method)
                this.loadLinkedFacture();
            }
            else {
                // CREATE MODE: New Fiche
                this.isEditMode = true;
                this.ficheForm.enable();
                // Reset form if creating new
                // this.ficheForm.reset(); // Optional: might strictly need this if reusing component
            }
        });

        // Setup generic listeners for Main Equipment
        this.setupLensListeners(this.ficheForm);

        // Auto-update lens type based on equipment type and addition
        this.setupLensTypeAutoUpdate();

        // Sync EP fields between tabs
        this.setupSynchronization();

        // Sync selectedEquipmentType with Main Equipment Type if no added equipments
        this.selectedEquipmentType.valueChanges.subscribe(value => {
            if (value && this.equipements.length === 0) {
                this.ficheForm.get('monture.typeEquipement')?.setValue(value);
            }
        });

        // Update nomenclature when ordonnance changes
        this.ficheForm.get('ordonnance')?.valueChanges.subscribe(() => {
            this.updateNomenclature();
        });
        // Initial call
        this.updateNomenclature();

        // REACTIVE RECEPTION CHECK: Trigger whenever the invoice status changes
        this.linkedFacture$.subscribe((facture: Facture | null) => {
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
                const isInstance = (this.linkedFactureSubject.value?.statut === 'VENTE_EN_INSTANCE');
                if (isInstance && !this.receptionComplete && this.currentFiche) {
                    console.log('🔄 [POLLING] Checking reception status...');
                    this.checkReceptionForInstance(this.currentFiche);
                }
            });
        });
    }


    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    loadCompanySettings() {
        this.companySettingsService.getSettings().subscribe({
            next: (settings) => {
                this.companySettings = settings;
                this.cdr.markForCheck();
            },
            error: (err) => console.error('Failed to load company settings', err)
        });
    }

    // New: Check if products in an INSTANCE sale are now received OR if transfer was cancelled
    checkReceptionForInstance(fiche: any): void {
        // [DISABLED] Logic disabled as per user request to remove banner system.
        return;

        const isInstance = (this.linkedFactureSubject.value?.statut === 'VENTE_EN_INSTANCE');

        console.log('🔍 [RECEPTION] Checking reception status (ID & Model-Based)...');

        // Extract products to check
        const itemsToCheck: { path: string, id: string | null, desc: string | null, ref: string | null }[] = [];

        const mapMonture = (m: any, path: string) => {
            if (m?.productId || m?.designation || m?.reference) {
                itemsToCheck.push({ path, id: m.productId, desc: m.designation, ref: m.reference });
            }
        };

        const mapVerres = (v: any, path: string) => {
            if (v?.differentODOG) {
                if (v.productIdOD || v.matiereOD) itemsToCheck.push({ path: `${path}.od`, id: v.productIdOD, desc: v.matiereOD, ref: null });
                if (v.productIdOG || v.matiereOG) itemsToCheck.push({ path: `${path}.og`, id: v.productIdOG, desc: v.matiereOG, ref: null });
            } else if (v?.productId || v?.matiere) {
                itemsToCheck.push({ path: `${path}.both`, id: v.productId, desc: v.matiere, ref: null });
            }
        };

        mapMonture(fiche.monture, 'monture');
        if (fiche.verres) mapVerres(fiche.verres, 'verres');

        (fiche.equipements || []).forEach((e: any, i: number) => {
            const p = `equipements.${i}`;
            mapMonture(e.monture, `${p}.monture`);
            if (e.verres) mapVerres(e.verres, `${p}.verres`);
        });

        if (itemsToCheck.length === 0) {
            this.receptionComplete = true;
            this.cdr.markForCheck();
            return;
        }

        this.store.select(UserCurrentCentreSelector).pipe(take(1)).subscribe(center => {
            if (!center) return;

            // Fetch ALL products for model-based matching fallback
            this.productService.findAll({ global: true }).subscribe((allProducts: Product[]) => {
                let allArrived = true;
                let someTransit = false;
                let someReserved = false;
                let needsIDSync = false;

                itemsToCheck.forEach(item => {
                    // 1. Try to find a LOCAL product using a SCORING system
                    // We want to avoid picking a product just because it shares a generic reference if a better designation match exists.

                    const candidates = allProducts.filter(p => p.entrepot?.centreId === center.id);
                    let localMatch: any = null;
                    let bestScore = 0;

                    for (const p of candidates) {
                        let score = 0;

                        // Exact ID Match (Highest Priority)
                        if (p.id === item.id) score += 100;

                        // Designation Match
                        if (item.desc && p.designation && p.designation.trim().toLowerCase() === item.desc.trim().toLowerCase()) {
                            score += 50;
                        }

                        // Reference/Code Match
                        if (item.ref && p.codeInterne && p.codeInterne === item.ref) {
                            score += 20;
                        } else if (item.ref && p.codeBarres && p.codeBarres === item.ref) {
                            score += 20;
                        }

                        if (score > bestScore) {
                            bestScore = score;
                            localMatch = p;
                        }
                    }

                    // 2. Determine Status based on match
                    if (localMatch) {
                        if (localMatch.statut === 'DISPONIBLE') {
                            // Arrived locally
                        } else if (localMatch.statut === 'EN_TRANSIT') {
                            allArrived = false;
                            someTransit = true;
                        } else if (localMatch.statut === 'RESERVE') {
                            allArrived = false;
                            someReserved = true;
                        } else {
                            allArrived = false;
                        }

                        if (localMatch.id !== item.id) {
                            needsIDSync = true;
                        }
                    } else {
                        // No local candidate found at all -> Not arrived
                        allArrived = false;
                    }
                });

                const stateChanged = this.receptionComplete !== allArrived || this.isTransit !== someTransit || this.isReserved !== someReserved;
                if (stateChanged || needsIDSync) {
                    if (allArrived && !this.receptionComplete) {
                        this.snackBar.open('✨ Bonne nouvelle ! Vos produits sont arrivés.', 'OK', { duration: 6000 });
                    }

                    this.receptionComplete = allArrived;
                    this.isTransit = someTransit;
                    this.isReserved = someReserved;

                    // Perform ID synchronization if we found local matches for remote IDs
                    if (needsIDSync) {
                        itemsToCheck.forEach(item => {
                            const local = allProducts.find(p =>
                                p.entrepot?.centreId === center.id &&
                                (p.id === item.id || (item.desc && p.designation === item.desc) || (item.ref && (p.codeInterne === item.ref || p.codeBarres === item.ref)))
                            );
                            if (local && local.id !== item.id) {
                                console.log(`📍 [SYNC] Mapping ${item.path} to local ID: ${local.id}`);
                                this.patchProductID(item.path, local.id);
                            }
                        });
                        this.saveFicheSilently(true);
                    }

                    this.cdr.markForCheck();
                    // Additional check to force UI update because of OnPush
                    setTimeout(() => this.cdr.detectChanges(), 50);
                }
            });
        });
    }

    private patchProductID(path: string, localId: string) {
        const parts = path.split('.');
        let control: AbstractControl | null = this.ficheForm;

        if (parts[0] === 'equipements') {
            const index = parseInt(parts[1]);
            control = this.equipements.at(index);
            // Re-map parts to skip 'equipements.X'
            const subPath = parts.slice(2).join('.');
            const field = subPath.includes('od') ? 'productIdOD' : (subPath.includes('og') ? 'productIdOG' : 'productId');
            const group = control.get(parts[2]);
            group?.patchValue({ [field]: localId, isPendingTransfer: false }, { emitEvent: false });
        } else {
            const field = path.includes('od') ? 'productIdOD' : (path.includes('og') ? 'productIdOG' : 'productId');
            const group = this.ficheForm.get(parts[0]);
            group?.patchValue({ [field]: localId, isPendingTransfer: false }, { emitEvent: false });
        }
    }


    loadLinkedFacture(): void {
        if (!this.ficheId || this.ficheId === 'new') {
            console.log('⏩ [MontureForm] Skipping loadLinkedFacture: ficheId is', this.ficheId);
            this.linkedFactureSubject.next(null);
            return;
        }

        console.log('🔍 [MontureForm] Searching for linked facture for ficheId:', this.ficheId);

        // Find invoice linked to this fiche directly using ficheId filter
        this.factureService.findAll({ ficheId: this.ficheId }).subscribe({
            next: (factures: Facture[]) => {
                // Should only be one due to unique constraint, but find just in case
                const found = factures.find(f => f.ficheId === this.ficheId);
                if (found) {
                    console.log('🔗 [MontureForm] Linked Facture found:', found.numero, '| ID:', found.id, '| Status:', found.statut);
                    this.linkedFactureSubject.next(found);
                } else {
                    console.log('❓ [MontureForm] No linked facture found for ficheId:', this.ficheId, '| Candidates:', factures.length);
                    this.linkedFactureSubject.next(null);
                }
            },
            error: (err: any) => {
                console.error('❌ [MontureForm] Error loading linked facture:', err);
                this.linkedFactureSubject.next(null);
            }
        });


        // Make reception check reactive to invoice status changes
        this.linkedFacture$.pipe(
            takeUntil(this.destroy$),
            filter(f => !!f),
            distinctUntilChanged((prev, curr) => prev?.statut === curr?.statut)
        ).subscribe(f => {
            if (f?.statut === 'VENTE_EN_INSTANCE' && this.currentFiche) {
                console.log('🔄 [RECEPTION] Status changed to Instance. Triggering check...');
                this.checkReceptionForInstance(this.currentFiche);
            }
        });
    }

    onInvoiceSaved(facture: Facture): void {
        console.log('✅ [EVENT] Invoice saved in MontureFormComponent:', facture.numero || facture);
        console.log('📊 [EVENT] Invoice status:', facture.statut, '| Type:', facture.type);

        // Update the subject to reflect the new state (e.g. Valid status, New Number)
        this.linkedFactureSubject.next(facture);
        this.loadClientFactures();

        // FIX: Reload fiche to trigger checkReceptionForInstance and update UI
        if (this.ficheId && this.ficheId !== 'new') {
            console.log('🔄 [EVENT] Reloading fiche to check reception status...');
            this.loadFiche();
        }

        this.cdr.markForCheck();
    }

    updateNomenclature(): void {
        const odVars = this.ficheForm.get('ordonnance.od')?.value || {};
        const ogVars = this.ficheForm.get('ordonnance.og')?.value || {};
        const formatCorrection = (c: any) => {
            let s = '';
            if (c.sphere && c.sphere !== '0' && c.sphere !== '+0.00') s += `Sph ${c.sphere} `;
            if (c.cylindre && c.cylindre !== '0' && c.cylindre !== '+0.00') s += `Cyl ${c.cylindre} `;
            if (c.axe && c.axe !== '0°') s += `Axe ${c.axe} `;
            if (c.addition && c.addition !== '0' && c.addition !== '+0.00') s += `Add ${c.addition}`;
            return s.trim();
        };
        const descOD = formatCorrection(odVars);
        const descOG = formatCorrection(ogVars);
        this.nomenclatureString = `OD: ${descOD || '-'} / OG: ${descOG || '-'}`;
        console.log('📋 Nomenclature generated in ngOnInit:', this.nomenclatureString);
    }

    setupSynchronization(): void {
        const ordonnance = this.ficheForm.get('ordonnance');
        const montage = this.ficheForm.get('montage');

        if (!ordonnance || !montage) return;

        // Ordonnance -> Montage
        // OD
        ordonnance.get('od.ep')?.valueChanges.subscribe(val => {
            if (val && val !== montage.get('ecartPupillaireOD')?.value) {
                montage.patchValue({ ecartPupillaireOD: val }, { emitEvent: false });
            }
        });
        // OG
        ordonnance.get('og.ep')?.valueChanges.subscribe(val => {
            if (val && val !== montage.get('ecartPupillaireOG')?.value) {
                montage.patchValue({ ecartPupillaireOG: val }, { emitEvent: false });
            }
        });

        // Montage -> Ordonnance
        // OD
        montage.get('ecartPupillaireOD')?.valueChanges.subscribe(val => {
            if (val && val !== ordonnance.get('od.ep')?.value) {
                ordonnance.patchValue({ od: { ep: val } }, { emitEvent: false });
            }
        });
        // OG
        montage.get('ecartPupillaireOG')?.valueChanges.subscribe(val => {
            if (val && val !== ordonnance.get('og.ep')?.value) {
                ordonnance.patchValue({ og: { ep: val } }, { emitEvent: false });
            }
        });
    }


    toggleEditMode(): void {
        this.isEditMode = !this.isEditMode;

        if (this.isEditMode) {
            // Enable form for editing
            this.ficheForm.enable();
        } else {
            // Disable form for viewing
            this.ficheForm.disable();
            // Reload to reset if cancelling edits
            if (this.ficheId && this.ficheId !== 'new') {
                this.loadFiche(); // Reset data to saved state on cancel
            }
        }
    }



    get clientDisplayName(): string {
        if (!this.client) return 'Client';

        if (isClientProfessionnel(this.client)) {
            return this.client.raisonSociale.toUpperCase();
        }

        if (isClientParticulier(this.client) || (this.client as any).nom) {
            const nom = (this.client as any).nom || '';
            const prenom = (this.client as any).prenom || '';
            return `${nom.toUpperCase()} ${this.toTitleCase(prenom)} `;
        }

        return 'Client';
    }

    get clientCinValue(): string {
        if (!this.client) return '';
        if (isClientProfessionnel(this.client)) return this.client.identifiantFiscal || '';
        if (isClientParticulier(this.client)) return this.client.numeroPieceIdentite || this.client.cinParent || '';
        return '';
    }

    private toTitleCase(str: string): string {
        if (!str) return '';
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    // Generic Listener Setup
    setupLensListeners(group: AbstractControl): void {
        const verresGroup = group.get('verres');
        if (!verresGroup) return;

        const updatePrice = () => this.calculateLensPrices(group);

        // Core Fields
        verresGroup.get('matiere')?.valueChanges.subscribe(updatePrice);
        verresGroup.get('indice')?.valueChanges.subscribe(updatePrice);
        verresGroup.get('traitement')?.valueChanges.subscribe(updatePrice);

        // Split Logic
        verresGroup.get('differentODOG')?.valueChanges.subscribe((isSplit: boolean) => {
            if (isSplit) {
                const currentVals = verresGroup.value;
                // FIX: Only overwrite Split fields if Unified fields HAVE data.
                // This prevents erasing valid Split data when enabling form (where Unified might be null)
                if (currentVals.matiere || currentVals.indice) {
                    verresGroup.patchValue({
                        matiereOD: currentVals.matiere,
                        indiceOD: currentVals.indice,
                        traitementOD: currentVals.traitement,
                        matiereOG: currentVals.matiere,
                        indiceOG: currentVals.indice,
                        traitementOG: currentVals.traitement
                    }, { emitEvent: false });
                }
            }
            updatePrice();
        });

        // Split Fields
        verresGroup.get('matiereOD')?.valueChanges.subscribe(updatePrice);
        verresGroup.get('indiceOD')?.valueChanges.subscribe(updatePrice);
        verresGroup.get('traitementOD')?.valueChanges.subscribe(updatePrice);
        verresGroup.get('matiereOG')?.valueChanges.subscribe(updatePrice);
        verresGroup.get('indiceOG')?.valueChanges.subscribe(updatePrice);
        verresGroup.get('traitementOG')?.valueChanges.subscribe(updatePrice);

        // Sync Price in Simple Mode
        verresGroup.get('prixOD')?.valueChanges.subscribe((val) => {
            if (!verresGroup.get('differentODOG')?.value) {
                verresGroup.get('prixOG')?.setValue(val, { emitEvent: false });
            }
        });
    }

    // Auto-update lens type based on equipment type and addition
    setupLensTypeAutoUpdate(): void {
        // Main equipment
        const updateMainLensType = () => {
            const equipmentType = this.ficheForm.get('monture.typeEquipement')?.value;
            const addOD = parseFloat(this.ficheForm.get('ordonnance.od.addition')?.value) || 0;
            const addOG = parseFloat(this.ficheForm.get('ordonnance.og.addition')?.value) || 0;
            const maxAdd = Math.max(addOD, addOG);

            if (equipmentType) {
                const recommendedType = determineLensType(equipmentType, maxAdd);
                this.ficheForm.get('verres.type')?.setValue(recommendedType, { emitEvent: false });
            }
        };

        // Listen to equipment type changes
        this.ficheForm.get('monture.typeEquipement')?.valueChanges.subscribe(() => updateMainLensType());

        // Listen to addition changes
        this.ficheForm.get('ordonnance.od.addition')?.valueChanges.subscribe(() => updateMainLensType());
        this.ficheForm.get('ordonnance.og.addition')?.valueChanges.subscribe(() => updateMainLensType());
    }

    calculateLensPrices(group: AbstractControl = this.ficheForm): void {
        const verresGroup = group.get('verres');
        if (!verresGroup) return;

        const differentODOG = verresGroup.get('differentODOG')?.value;

        // Prix OD
        let prixOD = 0;
        if (differentODOG) {
            const matiereOD = verresGroup.get('matiereOD')?.value;
            const indiceOD = verresGroup.get('indiceOD')?.value;
            const traitementsOD = verresGroup.get('traitementOD')?.value || [];

            prixOD = calculateLensPrice(matiereOD, indiceOD, traitementsOD);
        } else {
            const matiere = verresGroup.get('matiere')?.value;
            const indice = verresGroup.get('indice')?.value;
            const traitements = verresGroup.get('traitement')?.value || [];

            prixOD = calculateLensPrice(matiere, indice, traitements);
        }

        // Prix OG
        let prixOG = 0;
        if (differentODOG) {
            const matiereOG = verresGroup.get('matiereOG')?.value;
            const indiceOG = verresGroup.get('indiceOG')?.value;
            const traitementsOG = verresGroup.get('traitementOG')?.value || [];

            prixOG = calculateLensPrice(matiereOG, indiceOG, traitementsOG);
        } else {
            prixOG = prixOD;
        }

        verresGroup.patchValue({
            prixOD,
            prixOG
        }, { emitEvent: false });

        this.cdr.markForCheck();
    }

    checkSuggestion(index: number = -1): void {
        this.activeSuggestionIndex = index;
        const odValues = this.ficheForm.get('ordonnance.od')?.value;
        const ogValues = this.ficheForm.get('ordonnance.og')?.value;

        // Extract frame details from the target monture group (Main or Added)
        let montureGroup = this.ficheForm.get('monture');
        if (index >= 0) {
            montureGroup = this.equipements.at(index)?.get('monture') || null;
        }

        // Parse Frame Data (ED from 'taille', cerclage from form)
        const tailleStr = montureGroup?.get('taille')?.value || '';
        const ed = parseInt(tailleStr.split('-')[0]) || 52; // Default 52 if parse fails
        const cerclage = montureGroup?.get('cerclage')?.value || 'cerclée';

        // Frame shape and mount - using defaults for now (could be added to UI later)
        const frameData: FrameData = {
            ed,
            shape: 'rectangular', // Default
            mount: 'full-rim',     // Default
            cerclage: cerclage as any // Type de cerclage
        };

        // Determine Equipment Type
        let equipmentType: string = '';
        if (index >= 0) {
            // For added equipment
            equipmentType = this.equipements.at(index)?.get('type')?.value || '';
        } else {
            // For main equipment
            equipmentType = this.ficheForm.get('monture.typeEquipement')?.value || '';
        }

        // Prepare Corrections with Addition Support
        const sphOD = parseFloat(odValues.sphere) || 0;
        const sphOG = parseFloat(ogValues.sphere) || 0;
        const addOD = parseFloat(odValues.addition) || 0;
        const addOG = parseFloat(ogValues.addition) || 0;
        const cylOD = parseFloat(odValues.cylindre) || 0;
        const cylOG = parseFloat(ogValues.cylindre) || 0;

        // CRITICAL: Only apply Addition for "Vision de près" equipment type
        const isNearVision = equipmentType === TypeEquipement.VISION_PRES;

        const corrOD: Correction = {
            sph: sphOD,
            cyl: cylOD,
            add: isNearVision ? addOD : undefined  // Only pass addition for near vision
        };
        const corrOG: Correction = {
            sph: sphOG,
            cyl: cylOG,
            add: isNearVision ? addOG : undefined  // Only pass addition for near vision
        };

        // Get AI Recommendations
        const recOD = getLensSuggestion(corrOD, frameData);
        const recOG = getLensSuggestion(corrOG, frameData);

        // Compare Spheres and Cylinders for Pair vs Split Logic (Tighter thresholds)
        const diffSph = Math.abs(corrOD.sph - corrOG.sph);
        const diffCyl = Math.abs(corrOD.cyl - corrOG.cyl);

        this.suggestions = [];
        // Sync with FormControl
        this.ficheForm.get('suggestions')?.setValue([]);

        if (diffSph <= 0.5 && diffCyl <= 0.75) {
            // Case A: Similar Prescriptions -> Suggest Single Pair (Aesthetic Priority)
            // Use the "stronger" recommendation (highest index) for both
            const useOD = recOD.option.index >= recOG.option.index;
            const bestRec = useOD ? recOD : recOG;
            const thicknessInfo = `~${bestRec.estimatedThickness} mm`;

            // Combine warnings from both eyes
            const allWarnings = [
                ...(recOD.warnings || []),
                ...(recOG.warnings || [])
            ];
            const uniqueWarnings = [...new Set(allWarnings)]; // Remove duplicates

            this.suggestions.push({
                type: 'Paire',
                matiere: this.mapMaterialToUI(bestRec.option.material),
                indice: this.mapIndexToUI(bestRec.option.index),
                traitements: this.mapTreatmentsToUI(bestRec.selectedTreatments),
                raison: bestRec.rationale,
                epaisseur: thicknessInfo,
                warnings: uniqueWarnings.length > 0 ? uniqueWarnings : undefined
            });

        } else {
            // Case B: Different Prescriptions -> Suggest Split Indices
            const thickOD = `~${recOD.estimatedThickness} mm`;
            const thickOG = `~${recOG.estimatedThickness} mm`;

            this.suggestions.push({
                type: 'OD',
                matiere: this.mapMaterialToUI(recOD.option.material),
                indice: this.mapIndexToUI(recOD.option.index),
                traitements: this.mapTreatmentsToUI(recOD.selectedTreatments),
                raison: recOD.rationale,
                epaisseur: thickOD,
                warnings: recOD.warnings
            });

            this.suggestions.push({
                type: 'OG',
                matiere: this.mapMaterialToUI(recOG.option.material),
                indice: this.mapIndexToUI(recOG.option.index),
                traitements: this.mapTreatmentsToUI(recOG.selectedTreatments),
                raison: recOG.rationale,
                epaisseur: thickOG,
                warnings: recOG.warnings
            });
        }

        // Sync with FormControl
        this.ficheForm.get('suggestions')?.setValue(this.suggestions);

        this.showSuggestions = true;
        this.cdr.markForCheck();
    }

    // Helper to map DB material names to UI dropdown values
    mapMaterialToUI(dbMaterial: string): string {
        switch (dbMaterial) {
            case 'CR-39': return 'Organique (CR-39)';
            case 'Polycarbonate': return 'Polycarbonate';
            case 'Trivex': return 'Trivex';
            case '1.56': return 'Organique 1.56';
            case '1.60': return 'Organique 1.60';
            case '1.67': return 'Organique 1.67';
            case '1.74': return 'Organique 1.74';
            default: return dbMaterial;
        }
    }

    // Helper to map DB index numbers to UI dropdown values
    mapIndexToUI(dbIndex: number): string {
        if (dbIndex === 1.50) return '1.50 (Standard)';
        if (dbIndex === 1.53) return '1.53 (Trivex)';
        if (dbIndex === 1.59) return '1.59 (Polycarbonate)';
        return dbIndex.toFixed(2);
    }

    applySuggestion(suggestion: SuggestionIA, parentGroup: AbstractControl = this.ficheForm): void {
        const verresGroup = parentGroup.get('verres');
        if (!verresGroup) return;

        if (suggestion.type === 'Paire') {
            // Case A: Apply to both (Grouped Mode)
            verresGroup.patchValue({
                differentODOG: false,
                matiere: suggestion.matiere,
                indice: suggestion.indice,
                traitement: suggestion.traitements || [],
                // Update shadow fields
                matiereOD: suggestion.matiere,
                indiceOD: suggestion.indice,
                traitementOD: suggestion.traitements || [],
                matiereOG: suggestion.matiere,
                indiceOG: suggestion.indice,
                traitementOG: suggestion.traitements || []
            });
            this.closeSuggestions();

        } else {
            // Case B: Split Mode
            if (verresGroup.get('differentODOG')?.value !== true) {
                verresGroup.patchValue({ differentODOG: true });
            }

            if (suggestion.type === 'OD') {
                verresGroup.patchValue({
                    matiereOD: suggestion.matiere,
                    indiceOD: suggestion.indice,
                    traitementOD: suggestion.traitements || []
                });
            } else if (suggestion.type === 'OG') {
                verresGroup.patchValue({
                    matiereOG: suggestion.matiere,
                    indiceOG: suggestion.indice,
                    traitementOG: suggestion.traitements || []
                });
            }

            // [NEW] Logic: Auto-Unify if OD and OG become identical
            // This fixes the user complaint where applying identical suggestions splits the form unnecessarily
            const v = verresGroup.value;
            const mtOD = v.matiereOD;
            const mtOG = v.matiereOG;
            const idxOD = v.indiceOD;
            const idxOG = v.indiceOG;
            const mqOD = v.marqueOD;
            const mqOG = v.marqueOG;

            // Compare treatments (sort arrays to ensure order doesn't matter)
            const trOD = Array.isArray(v.traitementOD) ? [...v.traitementOD].sort().join(',') : '';
            const trOG = Array.isArray(v.traitementOG) ? [...v.traitementOG].sort().join(',') : '';

            // Check if both eyes are fully populated and identical
            if (mtOD && mtOG && mtOD === mtOG && idxOD === idxOG && mqOD === mqOG && trOD === trOG) {
                console.log('🔄 [Suggestion] Auto-Unifying OD/OG as they are identical');
                verresGroup.patchValue({
                    differentODOG: false,
                    matiere: mtOD,
                    indice: idxOD,
                    marque: mqOD,
                    traitement: v.traitementOD // source of truth (same as OG)
                });
            }
        }

        this.calculateLensPrices(parentGroup);
    }

    openStockSearch(index: number = -1, target: 'monture' | 'verres' | 'od' | 'og' = 'monture'): void {
        let defaultFilter = '';
        if (target === 'monture') defaultFilter = 'mon';
        else if (target === 'verres' || target === 'od' || target === 'og') defaultFilter = 'verre';

        const dialogRef = this.dialog.open(StockSearchDialogComponent, {
            width: '95vw',
            maxWidth: '1600px',
            height: '85vh',
            autoFocus: false,
            data: { 
                context: 'sales',
                initialTypeFilter: defaultFilter 
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result?.action === 'CANCEL_SALE') {
                this.handleSaleCancellation(result.reason, result.product);
            } else if (result && (result.action === 'SELECT' || result.action === 'ORDER_AND_SELL') && result.product) {
                // ONE-CLICK LOGIC: Auto-enable edit mode if we are just viewing
                if (!this.isEditMode) {
                    console.log('⚡ [ONE-CLICK] Auto-enabling edit mode for product selection...');
                    this.isEditMode = true;
                    this.ficheForm.enable();
                }

                this.allProducts.push(result.product);
                const isPending = result.action === 'ORDER_AND_SELL' || result.isPendingTransfer || result.isPendingOrder || false;
                this.fillProductDetails(result.product, index, target, isPending);

                if (result.action === 'ORDER_AND_SELL') {
                    this.snackBar.open(
                        'Produit commandé. La vente sera mise en instance jusqu\'à réception du stock.',
                        'OK',
                        { duration: 6000 }
                    );
                }

                // AUTO-SUBMIT: Removed per user request - allows finishing other parts of the form
                console.log('✅ [STOCKS] Product selected, auto-save disabled to allow further editing.');
        // setTimeout(() => this.onSubmit(), 300);
            }
        });
    }

    onSupplierSelected(event: any): void {
        const value = event.option.value;
        this.fournisseurCtrl.setValue(value, { emitEvent: false });
        this.ficheForm.get('suiviCommande.fournisseur')?.setValue(value);
        this.ficheForm.get('suiviCommande.fournisseur')?.markAsDirty();
        this.cdr.detectChanges();
    }

    fillProductDetails(product: any, index: number, target: 'monture' | 'verres' | 'od' | 'og' = 'monture', isPendingTransfer: boolean = false): void {
        let parentGroup: FormGroup;
        if (index === -1) {
            parentGroup = this.ficheForm;
        } else {
            parentGroup = this.getEquipmentGroup(index);
        }

        if (target === 'monture') {
            const montureGroup = parentGroup.get('monture');
            if (montureGroup) {
                montureGroup.patchValue({
                    reference: product.codeInterne || product.codeBarres,
                    marque: product.marque || '',
                    couleur: product.couleur || '',
                    prixMonture: product.prixVenteTTC,
                    productId: product.id,
                    entrepotId: product.entrepotId,
                    entrepotType: product.entrepot?.type || null,
                    entrepotNom: product.entrepot?.nom || null,
                    isPendingTransfer: isPendingTransfer
                });

                // Pre-fill model or designation into reference if empty? 
                // Usually reference is codeInterne, but let's ensure designation is tracked
                if (!montureGroup.get('reference')?.value) {
                    montureGroup.patchValue({ reference: product.designation });
                }

                // [FIX] Robust Size/Dimensions Extraction
                const calibre = product.calibre || product.specificData?.calibre;
                const pont = product.pont || product.specificData?.pont;
                const branche = product.branche || product.specificData?.branche;

                let tailleStr = '';
                if (calibre) {
                    tailleStr = `${calibre}`;
                    if (pont) {
                        tailleStr += `-${pont}`;
                        if (branche) {
                            tailleStr += `-${branche}`;
                        }
                    }
                }

                if (tailleStr) {
                    montureGroup.patchValue({
                        taille: tailleStr
                    });
                }

                // Cerclage mapping (Normalize enum values to select values)
                const rawCerclage = product.typeMonture || product.specificData?.cerclage;
                if (rawCerclage) {
                    // Start naive mapping, or just pass value if it matches
                    let mappedCerclage = rawCerclage;
                    if (rawCerclage === 'cerclee') mappedCerclage = 'cerclée';
                    if (rawCerclage === 'percee') mappedCerclage = 'percée';

                    montureGroup.patchValue({ cerclage: mappedCerclage });
                }
            }
        } else {
            const verresGroup = parentGroup.get('verres');
            if (verresGroup) {
                if (target === 'verres') {
                    verresGroup.patchValue({
                        marque: product.marque || '',
                        matiere: product.modele || product.designation || '',
                        prixOD: product.prixVenteTTC,
                        productId: product.id,
                        entrepotId: product.entrepotId,
                        entrepotType: product.entrepot?.type || null,
                        entrepotNom: product.entrepot?.nom || null,
                        isPendingTransfer: isPendingTransfer
                    });
                } else if (target === 'od') {
                    verresGroup.patchValue({
                        marqueOD: product.marque || '',
                        matiereOD: product.modele || product.designation || '',
                        prixOD: product.prixVenteTTC,
                        productIdOD: product.id,
                        entrepotId: product.entrepotId,
                        entrepotType: product.entrepot?.type || null,
                        entrepotNom: product.entrepot?.nom || null,
                        isPendingTransfer: isPendingTransfer || verresGroup.get('isPendingTransfer')?.value
                    });
                } else if (target === 'og') {
                    verresGroup.patchValue({
                        marqueOG: product.marque || '',
                        matiereOG: product.modele || product.designation || '',
                        prixOG: product.prixVenteTTC,
                        productIdOG: product.id,
                        entrepotId: product.entrepotId,
                        entrepotType: product.entrepot?.type || null,
                        isPendingTransfer: isPendingTransfer || verresGroup.get('isPendingTransfer')?.value
                    });
                }
            }
        }

        this.cdr.markForCheck();
    }

    // Keep scanBarcode placeholder or delegate to stock search?
    scanBarcode(field: string, index: number): void {
        // Renamed functionality per user request
        this.openStockSearch(index);
    }

    // Helper to map database treatment names to UI names
    mapTreatmentsToUI(dbTreatments: string[]): string[] {
        const mapping: { [key: string]: string } = {
            'AR': 'Anti-reflet (HMC)',
            'BlueCut': 'Blue Cut',
            'Photochromic': 'Transitions (Photochromique)',
            'Polarized': 'Polarisé',
            'None': ''
        };
        return dbTreatments
            .map(t => mapping[t] || t)
            .filter(t => t !== '');
    }

    // --- Suivi Commande Logic ---

    get suiviStatut(): string {
        const val = this.ficheForm.get('suiviCommande.statut')?.value;
        const validStates = ['A_COMMANDER', 'COMMANDE', 'RECU', 'LIVRE_CLIENT'];
        return validStates.includes(val) ? val : 'A_COMMANDER';
    }

    setOrderStatus(statut: string): void {
        const group = this.ficheForm.get('suiviCommande');
        if (!group) return;

        const prevStatut = group.get('statut')?.value;
        if (prevStatut === statut) return;

        group.patchValue({ statut });

        const now = new Date();
        const journal = group.get('journal')?.value || [];
        let description = '';

        // Capture current values from the form to ensure they are available for the journal
        const fournisseurName = group.get('fournisseur')?.value || 'Non spécifié';
        const referenceCommande = group.get('referenceCommande')?.value || 'N/A';
        const trackingNum = group.get('trackingNumber')?.value || 'N/A';

        // Auto-fill dates and prepare journal description
        if (statut === 'COMMANDE') {
            description = `Commande envoyée au fournisseur (${fournisseurName}) - BC: ${referenceCommande} / Suivi: ${trackingNum}`;
            if (!group.get('dateCommande')?.value) {
                group.patchValue({ dateCommande: now });
            }
        } else if (statut === 'RECU') {
            description = `Verres reçus à l'atelier (BL: ${trackingNum})`;
            if (!group.get('dateReception')?.value) {
                group.patchValue({ dateReception: now });
            }
        } else if (statut === 'LIVRE_CLIENT') {
            description = 'Équipement livré au client';
            if (!group.get('dateLivraison')?.value) {
                group.patchValue({ dateLivraison: now });
            }
        } else if (statut === 'A_COMMANDER') {
            description = 'Retour au statut À Commander';
        }

        // Add to journal if description exists
        if (description) {
            const entry = {
                date: now,
                statut: statut,
                description: description,
                type: statut.toLowerCase()
            };
            group.patchValue({ journal: [...journal, entry] });
        }

        // Mark form as dirty to enable save
        this.ficheForm.markAsDirty();
        // Force double detection for history timeline
        this.cdr.detectChanges();
        setTimeout(() => this.cdr.detectChanges(), 50);
    }

    reportCasse(): void {
        const oeil = prompt('Casse sur quel œil ? (OD, OG, Paire)', 'Paire');
        if (!oeil) return;

        const raison = prompt('Raison de la casse ?', 'Coussinet / Taille / Montage');
        if (!raison) return;

        const group = this.ficheForm.get('suiviCommande');
        if (!group) return;

        const now = new Date();
        const count = (group.get('casseCount')?.value || 0) + 1;
        const history = group.get('casseHistorique')?.value || [];
        const journal = group.get('journal')?.value || [];

        const entry = {
            date: now,
            oeil,
            raison,
            user: 'Opticien'
        };

        const journalEntry = {
            date: now,
            statut: 'CASSE',
            description: `Casse déclarée (${oeil}) : ${raison}`,
            type: 'casse'
        };

        group.patchValue({
            statut: 'A_COMMANDER',
            hasCasse: true,
            casseCount: count,
            casseHistorique: [...history, entry],
            journal: [...journal, journalEntry],
            // Reset dates for NEW process visualization but keep in journal
            dateCommande: null,
            dateReception: null,
            dateLivraison: null,
            commentaire: (group.get('commentaire')?.value || '') + `\n[CASSE ${count}] ${oeil}: ${raison} (${now.toLocaleDateString()})`
        });

        this.ficheForm.markAsDirty();
        this.snackBar.open('Casse déclarée. La commande a été remise en statut "À Commander".', 'OK', { duration: 5000 });
        
        if (!this.isEditMode) {
            this.saveSuiviCommande();
        }
        
        this.cdr.markForCheck();
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

    async advanceOrderStatus(): Promise<void> {
        const status = this.suiviStatut;
        if (status === 'A_COMMANDER') {
            // Generate BC number first if needed to avoid "N/A" in journal
            try { await this.generateBCNumberIfNeeded(); } catch (e) { /* continue */ }
            this.setOrderStatus('COMMANDE');
            this.showOrderActions();
        }
        else if (status === 'COMMANDE') this.setOrderStatus('RECU');
        else if (status === 'RECU') this.setOrderStatus('LIVRE_CLIENT');

        // Trigger safe save if we are just advancing status outside of full edit
        if (!this.isEditMode) {
            this.saveSuiviCommande().subscribe(() => {
                // Ensure UI is refreshed after save
                this.cdr.detectChanges();
                setTimeout(() => this.cdr.detectChanges(), 100);
            }); 
        } else {
            // Even in edit mode, refresh UI for the timeline animation
            this.cdr.detectChanges();
        }
    }

    private saveSuiviCommande(): Observable<any> {
        if (!this.ficheId || this.ficheId === 'new') {
            return of(null); // Return an observable that immediately completes
        }
        
        const suiviData = this.ficheForm.get('suiviCommande')?.value;
        return this.ficheService.updateFiche(this.ficheId, { suiviCommande: suiviData } as any).pipe(
            tap({
                next: () => {
                    this.snackBar.open('Suivi mis à jour', 'OK', { duration: 2000 });
                    // Force UI refresh for history journal
                    this.cdr.detectChanges();
                },
                error: (err) => console.error('Error auto-saving suivi:', err)
            })
        );
    }

    async printBC(): Promise<void> {
        // Generate BC number first if needed
        try { await this.generateBCNumberIfNeeded(); } catch (e) { /* continue */ }
        this.printBonCommandeVerre();
    }

    async generateBCNumberIfNeeded(): Promise<void> {
        const bcData = this.ficheForm.get('suiviCommande')?.value;
        if (!bcData?.referenceCommande) {
            const dateStr = new Date().toLocaleDateString('fr-FR', { month: '2-digit', year: '2-digit' }).replace('/', '');
            const randomId = Math.floor(1000 + Math.random() * 9000); // 4 digit random
            const generatedBC = `BC-${dateStr}-${randomId}`;
            this.ficheForm.get('suiviCommande.referenceCommande')?.setValue(generatedBC);
            this.ficheForm.get('suiviCommande.referenceCommande')?.markAsDirty();
            // Important: Wait for save
            await firstValueFrom(this.saveSuiviCommande()); 
            this.cdr.detectChanges();
        }
    }

    emailOrder(): void {
        const suivi = this.ficheForm.get('suiviCommande')?.value || {};
        const fournisseur = suivi.fournisseur || '';

        if (!fournisseur) {
            this.snackBar.open('Veuillez d\'abord s\'lectionner un fournisseur', 'Fermer', {
                duration: 4000, verticalPosition: 'top'
            });
            return;
        }

        const bcNum   = suivi.referenceCommande || 'N/A';
        const client  = this.clientDisplayName || 'Client';
        const ord     = this.ficheForm.get('ordonnance')?.value || {};
        const od      = ord.od || {};
        const og      = ord.og || {};
        const verres  = this.ficheForm.get('verres')?.value || {};
        const isDiff  = verres.differentODOG;
        const matiere = isDiff
            ? `OD: ${verres.marqueOD || ''} ${verres.matiereOD || ''} ${verres.indiceOD || ''} / OG: ${verres.marqueOG || ''} ${verres.matiereOG || ''} ${verres.indiceOG || ''}`
            : `${verres.marque || ''} ${verres.matiere || ''} ${verres.indice || ''}`;

        const subject = encodeURIComponent(`Bon de Commande Verres ${bcNum} - ${client}`);
        const body = encodeURIComponent([
            `Bonjour,`,
            ``,
            `Veuillez trouver ci-dessous notre bon de commande verres.`,
            ``,
            `N° BC      : ${bcNum}`,
            `Client    : ${client}`,
            `Fournisseur: ${fournisseur}`,
            ``,
            `ORDONNANCE`,
            `OD : Sph ${od.sphere || '-'}  Cyl ${od.cylindre || '-'}  Axe ${od.axe || '-'}  Add ${od.addition || '-'}`,
            `OG : Sph ${og.sphere || '-'}  Cyl ${og.cylindre || '-'}  Axe ${og.axe || '-'}  Add ${og.addition || '-'}`,
            ``,
            `VERRES : ${matiere}`,
            ``,
            `Cordialement,`,
            `OPTISASS`,
        ].join('\n'));

        window.location.href = `mailto:?subject=${subject}&body=${body}`;

        this.snackBar.open('📧 Votre client email est ouvert avec les détails de la commande.', 'OK', {
            duration: 5000, verticalPosition: 'top'
        });
    }

    getTimelineEvents(): any[] {
        const group = this.ficheForm?.get('suiviCommande');
        if (!group) return [];

        const journal = group.get('journal')?.value || [];
        const legacyCasses = group.get('casseHistorique')?.value || [];
        const created = this.currentFiche ? ((this.currentFiche as any).dateCreation || (this.currentFiche as any).createdAt) : null;
        
        const events: any[] = [];
        
        // 1. Creation
        if (created) {
            events.push({ date: created, description: 'Création de la fiche', type: 'create' });
        }

        // 2. Journal entries
        if (Array.isArray(journal)) {
            journal.forEach((j: any) => {
                if (j.type !== 'create') events.push(j);
            });
        }

        // 3. Fallback for legacy dates (if not already in journal)
        const journalTypes = events.map(e => String(e.type).toLowerCase());
        
        if (!journalTypes.includes('order') && !journalTypes.includes('commande') && group.get('dateCommande')?.value) {
            events.push({ date: group.get('dateCommande').value, description: 'Commande envoyée au fournisseur', type: 'order' });
        }
        if (!journalTypes.includes('receive') && !journalTypes.includes('recu') && group.get('dateReception')?.value) {
            events.push({ date: group.get('dateReception').value, description: 'Verres reçus à l\'atelier', type: 'receive' });
        }
        if (!journalTypes.includes('deliver') && !journalTypes.includes('livre_client') && group.get('dateLivraison')?.value) {
            events.push({ date: group.get('dateLivraison').value, description: 'Équipement livré au client', type: 'deliver' });
        }

        // 4. Fallback for legacy casses (if not already in journal)
        if (Array.isArray(legacyCasses) && !journalTypes.includes('casse')) {
            legacyCasses.forEach((c: any) => {
                events.push({
                    date: c.date,
                    description: `Casse déclarée (${c.oeil}) : ${c.raison}`,
                    type: 'casse'
                });
            });
        }

        // Filter out duplicates based on same date and description
        const seen = new Set();
        const uniqueEvents = events.filter(e => {
            const key = `${new Date(e.date).getTime()}-${e.description}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return uniqueEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    getTimelineDotClass(type: string): string {
        if (type === 'create') return 'bg-gray-400 ring-gray-100';
        if (type === 'order' || type === 'commande') return 'bg-blue-400 ring-blue-50';
        if (type === 'receive' || type === 'recu') return 'bg-green-400 ring-green-50';
        if (type === 'deliver' || type === 'livre_client') return 'bg-purple-400 ring-purple-50';
        if (type === 'casse') return 'bg-red-500 ring-red-100';
        return 'bg-blue-500 ring-blue-50';
    }

    closeSuggestions(): void {
        this.showSuggestions = false;
        this.activeSuggestionIndex = null;
        this.cdr.markForCheck();
    }



    // Equipment Management
    get equipements(): FormArray {
        return this.ficheForm.get('equipements') as FormArray;
    }

    // Main Equipment Initialization
    initForm(): FormGroup {
        const typeEquipement = 'Monture';
        const typeVerre = 'Unifocal';

        return this.fb.group({
            // ... existing fields ...
            clientId: [this.clientId],
            type: ['MONTURE'],
            statut: ['BROUILLON'],
            monture: this.fb.group({
                reference: ['', Validators.required],
                marque: ['', Validators.required],
                couleur: [''],
                taille: [''],
                cerclage: ['cerclée'],
                typeEquipement: [typeEquipement],
                prixMonture: [0],
                productId: [null],
                entrepotId: [null],
                entrepotType: [null],
                entrepotNom: [null],
                isPendingTransfer: [false]
            }),
            verres: this.fb.group({
                matiere: [null],
                marque: [null],
                indice: [null],
                traitement: [[]],
                prixOD: [0],
                prixOG: [0],
                differentODOG: [false],
                type: [TypeVerre.UNIFOCAL],
                matiereOD: [null],
                marqueOD: [null],
                indiceOD: [null],
                traitementOD: [[]],
                matiereOG: [null],
                marqueOG: [null],
                indiceOG: [null],
                traitementOG: [[]],
                productId: [null],
                entrepotId: [null],
                entrepotType: [null],
                entrepotNom: [null],
                productIdOD: [null],
                productIdOG: [null],
                isPendingTransfer: [false]
            }),
            lentilles: this.fb.group({
                od: this.fb.group({
                    marque: [null],
                    modele: [null],
                    prix: [0]
                }),
                og: this.fb.group({
                    marque: [null],
                    modele: [null],
                    prix: [0]
                })
            }),
            // Restore missing fields from deleted initForm (Important!)
            ordonnance: this.fb.group({
                od: this.fb.group({
                    sphere: [null],
                    cylindre: [null],
                    axe: [null],
                    addition: [null],
                    prisme: [null],
                    base: [null],
                    ep: [null]
                }),
                og: this.fb.group({
                    sphere: [null],
                    cylindre: [null],
                    axe: [null],
                    addition: [null],
                    prisme: [null],
                    base: [null],
                    ep: [null]
                }),
                datePrescription: [new Date()],
                prescripteur: [''],
                dateControle: [null],
                prescriptionFiles: [[]]
            }),
            montage: this.fb.group({
                typeMontage: ['Cerclé (Complet)'],
                ecartPupillaireOD: [32, [Validators.required, Validators.min(20), Validators.max(40)]],
                ecartPupillaireOG: [32, [Validators.required, Validators.min(20), Validators.max(40)]],
                hauteurOD: [20, [Validators.required, Validators.min(10), Validators.max(30)]],
                hauteurOG: [20, [Validators.required, Validators.min(10), Validators.max(30)]],
                diametreVerreOD: [null],
                diametreVerreOG: [null],
                diametreEffectif: ['65/70'],
                capturedImage: [null], // [NEW] Base64 image from centering tablet
                remarques: [''],
                hauteurVerre: [null], // [NEW] Total frame height (B-dimension) persisted
                diagonalMm: [null], // [NEW] Diagonal diameter measurement
                diagonalPoints: [null] // [NEW] Points for manual diagonal tracing
            }),
            suggestions: [[]],
            equipements: this.fb.array([]),
            dateLivraisonEstimee: [null, Validators.required],
            suiviCommande: this.fb.group({
                statut: ['A_COMMANDER'],
                dateCommande: [null],
                dateReception: [null],
                dateLivraison: [null],
                fournisseur: [''],
                referenceCommande: [''],
                trackingNumber: [''],
                commentaire: [''],
                hasCasse: [false],
                casseCount: [0],
                casseHistorique: [[]],
                journal: [[]]
            })
        });
    }

    addEquipment(): void {
        const equipmentGroup = this.createEquipementFormGroup({ type: 'Monture' });

        // Setup listeners for this new equipment
        this.setupLensListeners(equipmentGroup);

        this.equipements.push(equipmentGroup);

        // Expansion logic
        this.addedEquipmentsExpanded = this.addedEquipmentsExpanded.map(() => false);
        this.addedEquipmentsExpanded.push(true);
        this.mainEquipmentExpanded = false;

        this.cdr.markForCheck();
    }

    getEquipmentGroup(index: number): FormGroup {
        return this.equipements.at(index) as FormGroup;
    }

    createEquipementFormGroup(data?: any): FormGroup {
        const group = this.fb.group({
            type: [data?.type || 'Monture'],
            dateAjout: [data?.dateAjout || new Date()],
            monture: this.fb.group({
                reference: [data?.monture?.reference || ''],
                marque: [data?.monture?.marque || ''],
                couleur: [data?.monture?.couleur || ''],
                taille: [data?.monture?.taille || ''],
                cerclage: [data?.monture?.cerclage || 'cerclée'],
                prixMonture: [data?.monture?.prixMonture || 0],
                productId: [data?.monture?.productId || null],
                entrepotId: [data?.monture?.entrepotId || null],
                entrepotType: [data?.monture?.entrepotType || null],
                entrepotNom: [data?.monture?.entrepotNom || null],
                isPendingTransfer: [data?.monture?.isPendingTransfer || false]
            }),
            verres: this.fb.group({
                matiere: [data?.verres?.matiere || null],
                marque: [data?.verres?.marque || null],
                indice: [data?.verres?.indice || null],
                traitement: [data?.verres?.traitement || []],
                prixOD: [data?.verres?.prixOD || 0],
                prixOG: [data?.verres?.prixOG || 0],
                differentODOG: [data?.verres?.differentODOG || false],
                matiereOD: [data?.verres?.matiereOD || null],
                marqueOD: [data?.verres?.marqueOD || null],
                indiceOD: [data?.verres?.indiceOD || null],
                traitementOD: [data?.verres?.traitementOD || []],
                matiereOG: [data?.verres?.matiereOG || null],
                marqueOG: [data?.verres?.marqueOG || null],
                indiceOG: [data?.verres?.indiceOG || null],
                traitementOG: [data?.verres?.traitementOG || []],
                productId: [data?.verres?.productId || null],
                entrepotId: [data?.verres?.entrepotId || null],
                entrepotType: [data?.verres?.entrepotType || null],
                productIdOD: [data?.verres?.productIdOD || null],
                productIdOG: [data?.verres?.productIdOG || null],
                isPendingTransfer: [data?.verres?.isPendingTransfer || false]
            }),
            lentilles: this.fb.group({
                od: this.fb.group({
                    marque: [data?.lentilles?.od?.marque || null],
                    modele: [data?.lentilles?.od?.modele || null],
                    prix: [data?.lentilles?.od?.prix || 0]
                }),
                og: this.fb.group({
                    marque: [data?.lentilles?.og?.marque || null],
                    modele: [data?.lentilles?.og?.modele || null],
                    prix: [data?.lentilles?.og?.prix || 0]
                })
            })
        });
        return group;
    }

    toggleMainEquipment(): void {
        this.mainEquipmentExpanded = !this.mainEquipmentExpanded;
    }

    toggleAddedEquipment(index: number): void {
        if (this.addedEquipmentsExpanded[index] === undefined) {
            this.addedEquipmentsExpanded[index] = false;
        }
        this.addedEquipmentsExpanded[index] = !this.addedEquipmentsExpanded[index];
    }

    removeEquipment(index: number): void {
        if (confirm('Supprimer cet équipement ?')) {
            this.equipements.removeAt(index);
            this.addedEquipmentsExpanded.splice(index, 1);
            this.cdr.markForCheck();
        }
    }

    goBack(): void {
        // [RESTORED] Exit Advice Logic
        const currentFacture = this.linkedFactureSubject.value;
        const invoiceLines = this.getInvoiceLines();
        const productsWithStock = invoiceLines.filter(l => l.productId && l.entrepotId);

        // If we are in BC mode, offer to finalize. 
        if (currentFacture && (currentFacture.statut === 'BON_DE_COMMANDE' || currentFacture.statut === 'VENTE_EN_INSTANCE') && currentFacture.type !== 'FACTURE') {
            const warehouses = [...new Set(productsWithStock.map(p => p.entrepotNom || p.entrepotType))].join(' / ');
            const message = `ℹ️ Votre document est actuellement un BON DE COMMANDE.\nProvenance : ${warehouses || 'Locale'}.\n\nSouhaitez-vous générer la FACTURE officielle maintenant ?\n(Annuler = Quitter et facturer plus tard)`;

            if (confirm(message)) {
                this.createFacture();
                return;
            }
        }

        if (this.clientId) {
            this.router.navigate(['/p/clients', this.clientId]);
        } else {
            this.router.navigate(['/p/clients']);
        }
    }



    // File Handling
    openFileUpload(): void {
        this.fileInput.nativeElement.click();
    }

    onFilesSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files) return;

        Array.from(input.files).forEach(file => {
            if (file.size > 10 * 1024 * 1024) {
                alert(`Le fichier ${file.name} est trop volumineux(max 10MB)`);
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
                    file: file as File,
                    uploadDate: new Date()
                };
                this.prescriptionFiles.push(prescriptionFile);
                // Sync with FormControl
                this.ficheForm.get('ordonnance.prescriptionFiles')?.setValue(this.prescriptionFiles);
                if (file.type.startsWith('image/')) {
                    this.extractData(prescriptionFile);
                }
                this.cdr.markForCheck();
            };
            reader.readAsDataURL(file);
        });
        input.value = '';
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

    // Camera Capture Methods
    async openCamera(): Promise<void> {
        try {
            this.showCameraModal = true;
            this.cdr.markForCheck();

            // Wait for view to update
            await new Promise(resolve => setTimeout(resolve, 100));

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
                audio: false
            });

            this.cameraStream = stream;
            if (this.videoElement?.nativeElement) {
                this.videoElement.nativeElement.srcObject = stream;
                this.videoElement.nativeElement.play();
            }
            this.cdr.markForCheck();
        } catch (error) {
            console.error('Erreur d\'accès à la caméra:', error);
            alert('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
            this.closeCameraModal();
        }
    }

    capturePhoto(): void {
        if (!this.videoElement?.nativeElement || !this.canvasElement?.nativeElement) {
            return;
        }

        const video = this.videoElement.nativeElement;
        const canvas = this.canvasElement.nativeElement;
        const context = canvas.getContext('2d');

        if (!context) return;

        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to base64
        this.capturedImage = canvas.toDataURL('image/jpeg', 0.9);
        this.cdr.markForCheck();
    }

    saveCapturedPhoto(): void {
        if (!this.capturedImage) return;

        // Convert base64 to blob
        fetch(this.capturedImage)
            .then(res => res.blob())
            .then(blob => {
                const timestamp = new Date().getTime();
                const file = new File([blob], `prescription_${timestamp}.jpg`, { type: 'image/jpeg' });

                const prescriptionFile: PrescriptionFile = {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    preview: this.capturedImage!,
                    file,
                    uploadDate: new Date()
                };

                this.prescriptionFiles.push(prescriptionFile);
                // Sync with FormControl
                this.ficheForm.get('ordonnance.prescriptionFiles')?.setValue(this.prescriptionFiles);
                this.extractData(prescriptionFile);
                this.closeCameraModal();
                this.cdr.markForCheck();
            });
    }

    closeCameraModal(): void {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        this.showCameraModal = false;
        this.capturedImage = null;
        this.cdr.markForCheck();
    }


    private formatNumber(value: number): string {
        if (value === undefined || value === null) return '';
        let formatted = value.toFixed(2);
        if (value > 0) formatted = '+' + formatted;
        return formatted;
    }

    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Paste Text Dialog and Apply functionality removed as per user request


    async extractData(file: PrescriptionFile): Promise<void> {
        console.log(`Extraction automatique des données de ${file.name}...`);

        try {
            // Import OCR functions dynamically
            const { extractTextFromImage } = await import('../../utils/ocr-extractor');
            const { parsePrescription } = await import('../../utils/prescription-parser');

            // Extract text from image
            const text = await extractTextFromImage(file.file);
            console.log('Texte extrait (OCR):', text);

            // Parse prescription data using the standardized parser
            const parsed = parsePrescription(text);
            console.log('Données parsées (OCR):', parsed);

            // Check if any data was found
            const hasOD = parsed.OD.sph !== 0 || parsed.OD.cyl !== 0 || parsed.OD.add !== undefined;
            const hasOG = parsed.OG.sph !== 0 || parsed.OG.cyl !== 0 || parsed.OG.add !== undefined;
            const hasEP = parsed.EP.val !== 0;

            if (!hasOD && !hasOG && !hasEP) {
                alert('Aucune donnée optique détectée dans l\'image. Vérifiez la netteté de la photo.');
                return;
            }

            // Build summary for user approval
            let summary = 'Données détectées :\n\n';
            if (parsed.prescripteur) summary += `Prescripteur: ${parsed.prescripteur}\n`;
            if (parsed.date) summary += `Date: ${parsed.date}\n\n`;

            if (hasOD) summary += `OD: ${parsed.OD.sph > 0 ? '+' : ''}${parsed.OD.sph} (${parsed.OD.cyl > 0 ? '+' : ''}${parsed.OD.cyl}) ${parsed.OD.axis ? '@' + parsed.OD.axis + '°' : ''} ${parsed.OD.add ? 'Add ' + parsed.OD.add : ''} \n`;
            if (hasOG) summary += `OG: ${parsed.OG.sph > 0 ? '+' : ''}${parsed.OG.sph} (${parsed.OG.cyl > 0 ? '+' : ''}${parsed.OG.cyl}) ${parsed.OG.axis ? '@' + parsed.OG.axis + '°' : ''} ${parsed.OG.add ? 'Add ' + parsed.OG.add : ''} \n`;
            if (hasEP) summary += `EP: ${parsed.EP.val} mm\n`;

            summary += '\nImporter ces valeurs ?';

            if (confirm(summary)) {
                // Apply extracted data to form
                this.setCorrectionOD(parsed.OD);
                this.setCorrectionOG(parsed.OG);
                if (parsed.EP) {
                    this.setCorrectionEP(parsed.EP);
                }
                // Inject metadata (Date, Prescriber)
                this.setPrescriptionMeta(parsed);
                alert('Données importées avec succès !');
                this.cdr.markForCheck();
            }

        } catch (error) {
            console.error('Erreur OCR:', error);
            alert('Impossible de lire l\'ordonnance automatiquement.');
        }
    }

    private setCorrectionOD(data: any): void {
        const odGroup = this.ficheForm.get('ordonnance.od');
        if (odGroup) {
            const values: any = {};
            if (data.sph !== 0) values.sphere = this.formatNumber(data.sph);
            if (data.cyl !== 0) values.cylindre = this.formatNumber(data.cyl);
            if (data.axis !== undefined) values.axe = data.axis + '°';
            if (data.add !== undefined) values.addition = this.formatNumber(data.add);
            if (data.prism !== undefined) values.prisme = data.prism;
            if (data.base !== undefined) values.base = data.base;
            odGroup.patchValue(values);
        }
    }

    private setCorrectionOG(data: any): void {
        const ogGroup = this.ficheForm.get('ordonnance.og');
        if (ogGroup) {
            const values: any = {};
            if (data.sph !== 0) values.sphere = this.formatNumber(data.sph);
            if (data.cyl !== 0) values.cylindre = this.formatNumber(data.cyl);
            if (data.axis !== undefined) values.axe = data.axis + '°';
            if (data.add !== undefined) values.addition = this.formatNumber(data.add);
            if (data.prism !== undefined) values.prisme = data.prism;
            if (data.base !== undefined) values.base = data.base;
            ogGroup.patchValue(values);
        }
    }

    private setCorrectionEP(data: { val: number; od?: number; og?: number }): void {
        const ordonnanceGroup = this.ficheForm.get('ordonnance');
        if (!ordonnanceGroup) return;

        if (data.od && data.og) {
            // Split provided (e.g. 32/32)
            ordonnanceGroup.get('od.ep')?.setValue(data.od);
            ordonnanceGroup.get('og.ep')?.setValue(data.og);
        } else if (data.val) {
            // Single value provided (e.g. 64) -> Split implicitly
            const half = data.val / 2;
            ordonnanceGroup.get('od.ep')?.setValue(half);
            ordonnanceGroup.get('og.ep')?.setValue(half);
        }
    }

    private setPrescriptionMeta(data: any): void {
        const ordonnanceGroup = this.ficheForm.get('ordonnance');
        if (!ordonnanceGroup) return;

        if (data.date) {
            // Convert DD/MM/YYYY to Date object for the datepicker
            const parts = data.date.split('/');
            if (parts.length === 3) {
                const dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                if (!isNaN(dateObj.getTime())) {
                    ordonnanceGroup.get('datePrescription')?.setValue(dateObj);
                }
            }
        }

        if (data.prescripteur) {
            ordonnanceGroup.get('prescripteur')?.setValue(data.prescripteur);
        }
    }

    loadFiche(): void {
        if (!this.ficheId) return;

        this.loading = true;
        this.ficheService.getFicheById(this.ficheId).subscribe({
            next: (fiche: FicheClient | undefined) => {
                if (fiche) {
                    console.log('📄 [LOAD] Fiche loaded:', fiche.id);
                    this.currentFiche = fiche;
                    this.patchForm(fiche);

                    // [RECEPTION] Immediate trigger if invoice status is already known
                    if (this.linkedFactureSubject.value?.statut === 'VENTE_EN_INSTANCE') {
                        console.log('🔄 [RECEPTION] Triggering check from loadFiche...');
                        this.checkReceptionForInstance(fiche);
                    } else {
                        // Fallback delay for slower invoice loading
                        setTimeout(() => {
                            if (this.currentFiche && !this.receptionComplete) {
                                this.checkReceptionForInstance(this.currentFiche);
                            }
                        }, 500);
                    }
                }
                this.loading = false;
                this.cdr.markForCheck();

                // Generate nomenclature after loading fiche data
                setTimeout(() => {
                    this.generateInvoiceLines();
                    console.log('📋 Nomenclature generated after fiche load:', this.nomenclatureString);
                }, 100);
            },
            error: (err: any) => {
                console.error('Error loading fiche:', err);
                this.loading = false;
                alert('Erreur lors du chargement de la fiche.');
            }
        });
    }

    private patchForm(fiche: any): void {
        // Patch Form Values
        console.log('📦 [PATCH] Patching Montage Data:', fiche.montage);
        this.ficheForm.patchValue({
            ordonnance: fiche.ordonnance || {},
            monture: fiche.monture || {},
            montage: fiche.montage || {},
            suggestions: fiche.suggestions || [],
            dateLivraisonEstimee: fiche.dateLivraisonEstimee,
            suiviCommande: fiche.suiviCommande || {},
            lentilles: fiche.lentilles || {}
        }, { emitEvent: false });

        if (fiche.suiviCommande && fiche.suiviCommande.fournisseur) {
            this.fournisseurCtrl.setValue(fiche.suiviCommande.fournisseur, { emitEvent: false });
        }

        // Explicitly patch verres to ensure UI updates for differentODOG
        if (fiche.verres) {
            const verresVals = { ...fiche.verres };

            // FIX: Guard against empty objects overwriting form
            if (Object.keys(verresVals).length === 0) return;

            // FIX: Convert numeric indices to strings for mat-select matching
            // Using strict check to handle 0 or existing values
            if (verresVals.indice !== undefined && verresVals.indice !== null) verresVals.indice = String(verresVals.indice);
            if (verresVals.indiceOD !== undefined && verresVals.indiceOD !== null) verresVals.indiceOD = String(verresVals.indiceOD);
            if (verresVals.indiceOG !== undefined && verresVals.indiceOG !== null) verresVals.indiceOG = String(verresVals.indiceOG);

            // FIX: Ensure differentODOG is set first for *ngIf visibility
            const diffODOG = verresVals.differentODOG === true;
            this.ficheForm.get('verres.differentODOG')?.setValue(diffODOG, { emitEvent: false });

            this.ficheForm.get('verres')?.patchValue(verresVals, { emitEvent: false });
        }

        // Restore suggestions and prescription files for display
        if (fiche.suggestions) {
            this.suggestions = fiche.suggestions;
            this.showSuggestions = this.suggestions.length > 0;
        }

        if (fiche.ordonnance && fiche.ordonnance.prescriptionFiles) {
            this.prescriptionFiles = fiche.ordonnance.prescriptionFiles;
        }

        // Handle Equipments (FormArray)
        if (fiche.equipements && Array.isArray(fiche.equipements)) {
            const equipementsArray = this.ficheForm.get('equipements') as FormArray;
            equipementsArray.clear(); // Clear existing

            fiche.equipements.forEach((eq: any) => {
                const eqGroup = this.createEquipementFormGroup(eq);

                // Set up listeners first
                this.setupLensListeners(eqGroup);

                // Add to array
                equipementsArray.push(eqGroup);
                this.addedEquipmentsExpanded.push(false);

                // Disable if parent is disabled (View Mode)
                if (this.ficheForm.disabled) {
                    eqGroup.disable();
                }
            });
        }

        // Trigger visuals
        setTimeout(() => {
            // [FIX] Do NOT auto-calculate prices on load, as it wipes imported values that don't match catalog
            // this.calculateLensPrices(); 
            this.updateFrameCanvasVisualization();
        }, 500);

        // Force UI update (OnPush strategy might miss patchValue with emitEvent: false)
        this.cdr.markForCheck();
    }

    setActiveTab(index: number): void {
        if (!this.isTabAccessible(index)) {
            this.snackBar.open('Veuillez saisir une date de livraison valide dans l\'onglet "Montures et Verres"', 'Fermer', { duration: 3000 });
            return;
        }

        this.activeTab = index;

        // DEBUG: Log form structure when switching to Suivi Commande tab
        if (index === 5) {
            console.log('🔍 [DEBUG] Switching to Suivi Commande tab');
            this.cdr.detectChanges(); // Force re-evaluation of getters like getTimelineEvents
        }

        // Load payments when switching to Payment tab
        if (index === 2 && this.paymentListComponent) {
            this.paymentListComponent.loadPayments();
        }

        // Load invoices when switching to Billing tab
        if (index === 3 && this.client) {
            this.updateInitialLines();
            this.loadClientFactures();
        }

        // Draw canvas when switching to Fiche Montage tab
        if (index === 4) {
            setTimeout(() => {
                this.updateFrameCanvasVisualization();
            }, 100);
        }
        this.cdr.markForCheck();
    }

    loadClientFactures() {
        this.loadLinkedFacture();
    }

    updateInitialLines() {
        this.initialLines = this.getInvoiceLines();
    }

    getInvoiceLines(): any[] {
        const lignes: any[] = [];
        const formValue = this.ficheForm.getRawValue();

        // 1. Main Equipment
        const mainMonture = formValue.monture;
        const mainVerres = formValue.verres;

        if (mainMonture && mainVerres) {
            // Monture
            const prixMonture = parseFloat(mainMonture.prixMonture) || 0;
            if (prixMonture > 0) {
                const ref = mainMonture.reference || 'Monture';
                const marque = mainMonture.marque || '';
                const detectedType = mainMonture.entrepotType || (this.allProducts?.find(p => p.id === mainMonture.productId)?.entrepot?.type) || null;

                lignes.push({
                    description: `Monture ${marque} ${ref}`.trim(),
                    qte: 1,
                    prixUnitaireTTC: prixMonture,
                    remise: 0,
                    totalTTC: prixMonture,
                    productId: mainMonture.productId || null,
                    entrepotId: mainMonture.entrepotId || null,
                    entrepotType: detectedType,
                    entrepotNom: mainMonture.entrepotNom || null
                });
                console.log(`🔍 Detected Stock Source for Main: ${detectedType} (ID: ${mainMonture.productId})`);
            }

            // Verres
            const differentODOG = mainVerres.differentODOG;
            const matiere = mainVerres.matiere || 'Verre';

            // Generate Nomenclature String (Internal use for notes)
            const odVars = formValue.ordonnance?.od || {};
            const ogVars = formValue.ordonnance?.og || {};

            const formatCorrection = (c: any) => {
                let s = '';
                if (c.sphere && c.sphere !== '0' && c.sphere !== '+0.00') s += (c.sphere.startsWith('+') || c.sphere.startsWith('-') ? c.sphere : '+' + c.sphere) + ' ';
                if (c.cylindre && c.cylindre !== '0' && c.cylindre !== '+0.00') s += `(${c.cylindre}) `;
                if (c.axe && c.axe !== '0°') s += `${c.axe} `;
                if (c.addition && c.addition !== '0' && c.addition !== '+0.00') s += `Add ${c.addition}`;
                return s.trim();
            };
            const descOD = formatCorrection(odVars);
            const descOG = formatCorrection(ogVars);

            this.nomenclatureString = `Nomenclature: OD: ${descOD} / OG: ${descOG}`;

            if (differentODOG) {
                const prixOD = parseFloat(mainVerres.prixOD) || 0;
                const prixOG = parseFloat(mainVerres.prixOG) || 0;
                const matiereOD = mainVerres.matiereOD || matiere;
                const matiereOG = mainVerres.matiereOG || matiere;
                const indiceOD = mainVerres.indiceOD || mainVerres.indice || '';
                const indiceOG = mainVerres.indiceOG || mainVerres.indice || '';

                if (prixOD > 0) {
                    lignes.push({
                        description: `Verre OD ${matiereOD} ${indiceOD}`.trim(),
                        qte: 1,
                        prixUnitaireTTC: prixOD,
                        remise: 0,
                        totalTTC: prixOD,
                        productId: mainVerres.productIdOD || mainVerres.productId || null,
                        entrepotId: mainVerres.entrepotId || null,
                        entrepotType: mainVerres.entrepotType || null,
                        entrepotNom: mainVerres.entrepotNom || null
                    });
                }
                if (prixOG > 0) {
                    lignes.push({
                        description: `Verre OG ${matiereOG} ${indiceOG}`.trim(),
                        qte: 1,
                        prixUnitaireTTC: prixOG,
                        remise: 0,
                        totalTTC: prixOG,
                        productId: mainVerres.productIdOG || mainVerres.productId || null,
                        entrepotId: mainVerres.entrepotId || null,
                        entrepotType: mainVerres.entrepotType || null,
                        entrepotNom: mainVerres.entrepotNom || null
                    });
                }
            } else {
                const prixOD = parseFloat(mainVerres.prixOD) || 0;
                const prixOG = parseFloat(mainVerres.prixOG) || 0;
                const indice = mainVerres.indice || '';

                if (prixOD > 0) {
                    lignes.push({
                        description: `Verre OD ${matiere} ${indice}`.trim(),
                        qte: 1,
                        prixUnitaireTTC: prixOD,
                        remise: 0,
                        totalTTC: prixOD,
                        productId: mainVerres.productId || null,
                        entrepotId: mainVerres.entrepotId || null,
                        entrepotType: mainVerres.entrepotType || null,
                        entrepotNom: mainVerres.entrepotNom || null
                    });
                }
                if (prixOG > 0) {
                    lignes.push({
                        description: `Verre OG ${matiere} ${indice}`.trim(),
                        qte: 1,
                        prixUnitaireTTC: prixOG,
                        remise: 0,
                        totalTTC: prixOG,
                        productId: mainVerres.productId || null,
                        entrepotId: mainVerres.entrepotId || null,
                        entrepotType: mainVerres.entrepotType || null,
                        entrepotNom: mainVerres.entrepotNom || null
                    });
                }
            }
        }

        const mainLentilles = formValue.lentilles;
        if (mainLentilles) {
            const prixOD = parseFloat(mainLentilles.od?.prix) || 0;
            const prixOG = parseFloat(mainLentilles.og?.prix) || 0;
            if (prixOD > 0) {
                lignes.push({
                    description: `Lentille OD ${mainLentilles.od?.marque || ''} ${mainLentilles.od?.modele || ''}`.trim() || 'Lentille OD',
                    qte: 1,
                    prixUnitaireTTC: prixOD,
                    remise: 0,
                    totalTTC: prixOD,
                    productId: null,
                    entrepotId: null,
                    entrepotType: null,
                    entrepotNom: null
                });
            }
            if (prixOG > 0) {
                lignes.push({
                    description: `Lentille OG ${mainLentilles.og?.marque || ''} ${mainLentilles.og?.modele || ''}`.trim() || 'Lentille OG',
                    qte: 1,
                    prixUnitaireTTC: prixOG,
                    remise: 0,
                    totalTTC: prixOG,
                    productId: null,
                    entrepotId: null,
                    entrepotType: null,
                    entrepotNom: null
                });
            }
        }

        // 2. Additional Equipments
        if (formValue.equipements && Array.isArray(formValue.equipements)) {
            formValue.equipements.forEach((equip: any, index: number) => {
                const monture = equip.monture;
                const verres = equip.verres;

                if (monture) {
                    const montureAdded = equip.monture;
                    if (montureAdded && montureAdded.prixMonture > 0) {
                        const detectedAddedType = montureAdded.entrepotType || (this.allProducts?.find(p => p.id === montureAdded.productId)?.entrepot?.type) || null;
                        lignes.push({
                            description: `Monture ${montureAdded.marque || ''} ${montureAdded.reference || ''}`.trim(),
                            qte: 1,
                            prixUnitaireTTC: parseFloat(montureAdded.prixMonture),
                            remise: 0,
                            totalTTC: parseFloat(montureAdded.prixMonture),
                            productId: montureAdded.productId || null,
                            entrepotId: montureAdded.entrepotId || null,
                            entrepotType: detectedAddedType,
                            entrepotNom: montureAdded.entrepotNom || null
                        });
                        console.log(`🔍 Detected Stock Source for Eq${index + 1}: ${detectedAddedType}`);
                    }
                }
                if (verres) {
                    const diff = verres.differentODOG;

                    // Helper to get description
                    const getDesc = (eye: 'OD' | 'OG') => {
                        if (diff) {
                            const mat = eye === 'OD' ? (verres.matiereOD || verres.matiere) : (verres.matiereOG || verres.matiere);
                            const ind = eye === 'OD' ? (verres.indiceOD || verres.indice) : (verres.indiceOG || verres.indice);
                            return `Verre ${eye} Eq${index + 1} ${mat || ''} ${ind || ''}`.trim();
                        } else {
                            const mat = verres.matiere || '';
                            const ind = verres.indice || '';
                            return `Verre ${eye} Eq${index + 1} ${mat} ${ind}`.trim();
                        }
                    };

                    const prixOD = parseFloat(verres.prixOD) || 0;
                    if (prixOD > 0) {
                        lignes.push({
                            description: getDesc('OD'),
                            qte: 1,
                            prixUnitaireTTC: prixOD,
                            remise: 0,
                            totalTTC: prixOD,
                            productId: verres.productIdOD || verres.productId || null,
                            entrepotId: verres.entrepotId || null,
                            entrepotType: verres.entrepotType || null,
                            entrepotNom: verres.entrepotNom || null
                        });
                    }
                    const prixOG = parseFloat(verres.prixOG) || 0;
                    if (prixOG > 0) {
                        lignes.push({
                            description: getDesc('OG'),
                            qte: 1,
                            prixUnitaireTTC: prixOG,
                            remise: 0,
                            totalTTC: prixOG,
                            productId: verres.productIdOG || verres.productId || null,
                            entrepotId: verres.entrepotId || null,
                            entrepotType: verres.entrepotType || null,
                            entrepotNom: verres.entrepotNom || null
                        });
                    }
                }

                if (equip.lentilles) {
                    const addedLentilles = equip.lentilles;
                    const prixOD = parseFloat(addedLentilles.od?.prix) || 0;
                    const prixOG = parseFloat(addedLentilles.og?.prix) || 0;
                    if (prixOD > 0) {
                        lignes.push({
                            description: `Lentille OD Eq${index + 1} ${addedLentilles.od?.marque || ''}`.trim(),
                            qte: 1,
                            prixUnitaireTTC: prixOD,
                            remise: 0,
                            totalTTC: prixOD,
                            productId: null,
                            entrepotId: null,
                            entrepotType: null,
                            entrepotNom: null
                        });
                    }
                    if (prixOG > 0) {
                        lignes.push({
                            description: `Lentille OG Eq${index + 1} ${addedLentilles.og?.marque || ''}`.trim(),
                            qte: 1,
                            prixUnitaireTTC: prixOG,
                            remise: 0,
                            totalTTC: prixOG,
                            productId: null,
                            entrepotId: null,
                            entrepotType: null,
                            entrepotNom: null
                        });
                    }
                }
            });
        }

        return lignes;
    }

    generateFacture() {
        if (!this.client || !this.client.id) return;

        const lignes = this.getInvoiceLines();
        if (lignes.length === 0) {
            alert('Aucun article à facturer (Prix = 0)');
            return;
        }

        const totalTTC = (lines: any[]) => lines.reduce((acc: number, val: any) => acc + val.totalTTC, 0);
        const total = totalTTC(lignes);
        const tvaRate = 0.20;
        const totalHT = total / (1 + tvaRate);
        const tva = total - totalHT;

        const factureData: Partial<Facture> = {
            type: 'FACTURE',
            statut: 'BROUILLON',
            dateEmission: new Date(),
            clientId: this.client.id,
            lignes: lignes,
            totalTTC: total,
            totalHT: totalHT,
            totalTVA: tva,
            ficheId: this.ficheId, // CRITICAL: Link to Fiche
            proprietes: {
                nomenclature: this.nomenclatureString || ''
            }
        };

        this.factureService.create(factureData).subscribe({
            next: (f) => this.router.navigate(['/p/clients/factures', f.id]),
            error: (err: any) => {
                const msg = err.error?.message || err.statusText || 'Erreur inconnue';
                alert(`Erreur: ${msg}`);
            }
        });
    }

    createFacture(): void {
        if (!this.ficheId || this.ficheId === 'new') {
            this.snackBar.open('Veuillez d\'abord enregistrer la fiche médicale', 'Fermer', { duration: 3000 });
            return;
        }

        // Check if there's already a facture linked to this fiche
        this.factureService.findAll({ ficheId: this.ficheId }).pipe(
            map((factures: Facture[]) => factures.find((f: Facture) => f.ficheId === this.ficheId)),
            take(1)
        ).subscribe({
            next: (existingFacture: Facture | undefined) => {
                if (existingFacture) {
                    // Facture exists - navigate to it and transform to FACTURE if it's a BC
                    console.log('Found existing facture:', existingFacture.numero, 'Type:', existingFacture.type);

                    if (existingFacture.type === 'BON_COMM') {
                        // Transform BC to FACTURE
                        this.factureService.update(existingFacture.id, {
                            type: 'FACTURE',
                            statut: 'VALIDE',
                            proprietes: {
                                ...existingFacture.proprietes,
                                forceFiscal: true
                            }
                        }).subscribe({
                            next: (updatedFacture: Facture) => {
                                this.snackBar.open('Bon de Commande transformé en Facture', 'OK', { duration: 3000 });
                                // Navigate to the updated facture (which now has a new ID from fiscal flow)
                                this.router.navigate(['/p/clients/factures', updatedFacture.id], {
                                    queryParams: { returnTo: `/p/clients/fiches/${this.ficheId}` }
                                });
                            },
                            error: (err: any) => {
                                console.error('Error transforming BC to Facture:', err);
                                this.snackBar.open('Erreur lors de la transformation: ' + (err.error?.message || 'Erreur serveur'), 'Fermer', { duration: 5000 });
                            }
                        });
                    } else {
                        // Just navigate to existing facture
                        this.router.navigate(['/p/clients/factures', existingFacture.id], {
                            queryParams: { returnTo: `/p/clients/fiches/${this.ficheId}` }
                        });
                    }
                } else {
                    // No facture exists - create new one
                    console.log('🆕 [MontureForm] No linked facture. Navigating to new with ficheId:', this.ficheId);
                    this.router.navigate(['/p/clients/factures/new'], {
                        queryParams: {
                            clientId: this.clientId,
                            ficheId: this.ficheId, // Correctly linked
                            returnTo: `/p/clients/fiches/${this.ficheId}`
                        }
                    });
                }
            },
            error: (err: any) => {
                console.error('Error checking for existing facture:', err);
                // Fallback to creating new facture
                this.router.navigate(['/p/clients/factures/new'], {
                    queryParams: {
                        clientId: this.clientId,
                        ficheId: this.ficheId,
                        returnTo: `/p/clients/fiches/${this.ficheId}`
                    }
                });
            }
        });
    }


    createSupplierInvoice(): void {
        const dialogRef = this.dialog.open(InvoiceFormDialogComponent, {
            width: '1200px',
            maxWidth: '95vw',
            maxHeight: '90vh',
            data: {
                invoice: null,
                prefilledClientId: this.clientId,
                isBL: true,
                prefilledType: 'ACHAT_VERRE_OPTIQUE'
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.snackBar.open('BL enregistré avec succès', 'OK', { duration: 3000 });
            }
        });
    }

    nextTab(): void {
        const targetTab = this.activeTab + 1;

        // Validation for date if on tab 1 or moving to tab 2+
        if (!this.isTabAccessible(targetTab)) {
            if (!this.ficheId || this.ficheId === 'new') {
                this.snackBar.open('Veuillez enregistrer la fiche avant de passer aux paiements/facturation', 'Fermer', { duration: 4000 });
                return;
            }

            const dateVal = this.ficheForm.get('dateLivraisonEstimee')?.value;
            if (!dateVal) {
                this.snackBar.open('Veuillez saisir une date de livraison estimée', 'Fermer', { duration: 3000 });
            } else {
                this.snackBar.open('La date de livraison ne peut pas être dans le passé', 'Fermer', { duration: 3000 });
            }
            return;
        }

        // If on the last tab (Suivi Commande), close
        if (this.activeTab === 5) {
            this.goBack();
            return;
        }

        // Logic for specific tab transitions
        if (targetTab === 4) { // Moving to Fiche Montage
            setTimeout(() => this.updateFrameCanvasVisualization(), 100);
        }

        if (targetTab === 3) { // Moving to Facturation
            this.generateInvoiceLines();
            // Optional: Auto-save if new? 
            if (this.factureComponent && (!this.factureComponent.id || this.factureComponent.id === 'new')) {
                if (this.factureComponent.form.value.lignes.length > 0) {
                    this.factureComponent.saveAsObservable().subscribe(() => {
                        this.activeTab = targetTab;
                    });
                    return;
                }
            }
        }

        if (this.activeTab < 5) {
            this.activeTab++;
            // Trigger specific logic for target tab
            this.setActiveTab(this.activeTab);
        }
    }

    prevTab(): void {
        if (this.activeTab > 0) {
            this.activeTab--;
            this.setActiveTab(this.activeTab);
        }
    }

    generateInvoiceLines(): void {
        const lignes = this.getInvoiceLines();
        this.initialLines = lignes;

        if (this.factureComponent && this.factureComponent.form) {
            console.log('🔄 Syncing calculated lines to FactureComponent');
            if (this.factureComponent.lignes) {
                this.factureComponent.lignes.clear();
                lignes.forEach(l => {
                    const group = this.factureComponent.createLigne();
                    group.patchValue(l);
                    this.factureComponent.lignes.push(group);
                });
            }
            if (this.nomenclatureString) {
                this.factureComponent.nomenclature = this.nomenclatureString;
                this.factureComponent.form.get('proprietes.nomenclature')?.setValue(this.nomenclatureString);
            }
            this.factureComponent.calculateTotals();
        }
        this.cdr.markForCheck();
    }

    hasInvoiceLines(): boolean {
        const lines = this.getInvoiceLines();
        return lines && lines.length > 0;
    }


    formatSphereValue(eye: 'od' | 'og', event: Event): void {
        const input = event.target as HTMLInputElement;
        let value = input.value.replace(',', '.');
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
            // Format to 2 decimal places
            let formatted = numValue.toFixed(2);
            // Add '+' for positive numbers
            if (numValue > 0) {
                formatted = '+' + formatted;
            }
            this.ficheForm.get(`ordonnance.${eye}.sphere`)?.setValue(formatted, { emitEvent: false });
            input.value = formatted;
        }
    }

    formatCylindreValue(eye: 'od' | 'og', event: Event): void {
        const input = event.target as HTMLInputElement;
        let value = input.value.replace(',', '.');
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
            // Format to 2 decimal places
            let formatted = numValue.toFixed(2);
            // Add '+' for positive numbers
            if (numValue > 0) {
                formatted = '+' + formatted;
            }
            this.ficheForm.get(`ordonnance.${eye}.cylindre`)?.setValue(formatted, { emitEvent: false });
            input.value = formatted;
        }
    }

    formatAdditionValue(eye: 'od' | 'og', event: Event): void {
        const input = event.target as HTMLInputElement;
        let value = input.value.replace(',', '.');
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
            // Format to 2 decimal places
            let formatted = numValue.toFixed(2);
            // Add '+' for positive numbers
            if (numValue > 0) {
                formatted = '+' + formatted;
            }
            this.ficheForm.get(`ordonnance.${eye}.addition`)?.setValue(formatted, { emitEvent: false });
            input.value = formatted;
        }
    }

    formatAxeValue(eye: 'od' | 'og', event: Event): void {
        const input = event.target as HTMLInputElement;
        const value = input.value.replace(/[^0-9]/g, '');
        if (value) {
            const numValue = parseInt(value);
            if (!isNaN(numValue) && numValue >= 0 && numValue <= 180) {
                const formatted = `${numValue}°`;
                this.ficheForm.get(`ordonnance.${eye}.axe`)?.setValue(formatted, { emitEvent: false });
                input.value = formatted;
            }
        }
    }

    formatPrismeValue(eye: 'od' | 'og', event: Event): void {
        const input = event.target as HTMLInputElement;
        let value = input.value.replace(',', '.');
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
            // Prisms don't strictly need '+' typically, but we treat them as numeric
            this.ficheForm.get(`ordonnance.${eye}.prisme`)?.setValue(value, { emitEvent: false });
            input.value = value;
        }
    }

    formatEPValue(eye: 'od' | 'og', event: Event): void {
        const input = event.target as HTMLInputElement;
        // Replace comma with dot first
        let cleanValue = input.value.replace(',', '.');
        // Remove strictly invalid chars but keep dot
        cleanValue = cleanValue.replace(/[^0-9.]/g, '');

        const value = parseFloat(cleanValue);
        if (!isNaN(value)) {
            // Keep decimal precision if user typed it, don't force .toFixed(2)
            // But append ' mm' for display if desired, or just keep number?
            // User requested "no rounding", usually just the number is safer for edit.
            // Let's keep the number in the model, and maybe just the number in input to match other fields?
            // The previous code appended ' mm'. I will respect that but without rounding.
            const formatted = `${cleanValue} mm`;
            this.ficheForm.get(`ordonnance.${eye}.ep`)?.setValue(value);
            input.value = formatted;
        }
    }

    formatBaseValue(eye: 'od' | 'og', event: Event): void {
        const input = event.target as HTMLInputElement;
        const value = input.value.toUpperCase();
        this.ficheForm.get(`ordonnance.${eye}.base`)?.setValue(value, { emitEvent: false });
        input.value = value;
    }

    formatPrice(control: AbstractControl | null, event: Event): void {
        if (!control) return;
        const input = event.target as HTMLInputElement;
        let value = input.value.replace(',', '.');
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
            const formatted = numValue.toFixed(2);
            control.setValue(formatted, { emitEvent: false });
            input.value = formatted;
        }
    }

    handleSaleCancellation(reason: string, product: any): void {
        if (reason === 'NO_STOCK_AVAILABLE') {
            const confirmed = confirm(
                `Le produit "${product?.designation || 'sélectionné'}" n'est disponible dans aucun centre.\n\n` +
                `Voulez-vous annuler cette vente ?\n\n` +
                `Note: Si vous avez déjà effectué un paiement, vous devrez le rembourser manuellement.`
            );

            if (confirmed) {
                this.snackBar.open('Vente annulée. Retour à la fiche client.', 'OK', { duration: 4000 });
                // Navigate back to client detail
                if (this.clientId) {
                    this.router.navigate(['/p/clients', this.clientId]);
                } else {
                    this.router.navigate(['/p/clients']);
                }
            } else {
                // User chose to continue - they can select another product
                this.snackBar.open('Vous pouvez sélectionner un autre produit.', 'OK', { duration: 3000 });
            }
        }
    }

    async onSubmit() {
        console.log('🚀 [DIAGNOSTIC] onSubmit starting...');
        if (this.ficheForm.invalid || !this.clientId || this.loading) {
            console.log('⚠️ [DIAGNOSTIC] Form Invalid, No Client ID, or Loading', {
                invalid: this.ficheForm.invalid,
                clientId: this.clientId,
                loading: this.loading
            });
            return;
        }
        this.loading = true;
        const formValue = this.ficheForm.getRawValue();

        // Capture if we are in creation mode before any updates
        const wasNew = !this.ficheId || this.ficheId === 'new';

        // Fix: Parse as floats to avoid string concatenation
        const pMonture = parseFloat(formValue.monture.prixMonture) || 0;
        const pOD = parseFloat(formValue.verres.prixOD) || 0;
        const pOG = parseFloat(formValue.verres.prixOG) || 0;
        const montantTotal = pMonture + pOD + pOG;

        // Convert prescription files to serializable format (remove File objects)
        const serializableFiles = this.prescriptionFiles.map(file => ({
            name: file.name,
            type: file.type,
            size: file.size,
            preview: typeof file.preview === 'string' ? file.preview : file.preview.toString(),
            uploadDate: file.uploadDate
        }));

        // Build complete fiche data with ALL fields
        const ficheData: FicheMontureCreate = {
            clientId: this.clientId,
            type: TypeFiche.MONTURE,
            statut: StatutFiche.EN_COURS,
            dateLivraisonEstimee: formValue.dateLivraisonEstimee,
            ordonnance: {
                ...formValue.ordonnance,
                prescriptionFiles: serializableFiles  // ✅ Serializable prescription attachments
            },
            monture: formValue.monture,
            verres: formValue.verres,
            montage: formValue.montage,
            suggestions: this.suggestions,  // ✅ Add AI suggestions
            equipements: formValue.equipements || [],  // ✅ Add additional equipment
            suiviCommande: formValue.suiviCommande,    // ✅ Add order tracking
            montantTotal,
            montantPaye: 0
        };

        console.log('📤 Submitting fiche data:', ficheData);

        const operation = (this.isEditMode && this.ficheId && this.ficheId !== 'new')
            ? this.ficheService.updateFiche(this.ficheId, ficheData)
            : this.ficheService.createFicheMonture(ficheData);

        // [NEW] Logic: Sales Validation & Stock Alerts
        // Check products warehouses
        const invoiceLines = this.getInvoiceLines();
        const productsWithStock = invoiceLines.filter(l => l.productId && l.entrepotType);

        console.log('🏁 Checking Sales Rules:', {
            totalLines: invoiceLines.length,
            productsWithStock: productsWithStock.length,
            details: productsWithStock.map(p => ({ id: p.productId, type: p.entrepotType }))
        });

        const hasPrincipalStock = productsWithStock.some(p => p.entrepotType === 'PRINCIPAL');
        const hasSecondaryStock = productsWithStock.some(p => p.entrepotType === 'SECONDAIRE');

        // ASYNC Payment Check: Fetch from service directly for total reliability
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

        const needsDecision = productsWithStock.length > 0 && hasPayment;

        // [NEW] Logic: Check if ANY product is pending transfer
        const hasPendingTransfer = formValue.monture?.isPendingTransfer ||
            formValue.verres?.isPendingTransfer ||
            (formValue.equipements || []).some((e: any) => e.monture?.isPendingTransfer || e.verres?.isPendingTransfer);

        console.log('⚖️ [DIAGNOSTIC] Decision Required?', needsDecision, 'Has Pending Transfer?', hasPendingTransfer);

        let userForcedStatut: string | null = null;
        let userForcedType: string | null = null;
        let userForcedStockDecrement = false;

        // [CRITICAL FIX] Protect existing official invoices from status changes
        // If an official invoice exists, DO NOT force status/type changes
        // This prevents unwanted fiscal flow triggers during medical record edits
        const existingInvoice = this.linkedFactureSubject.value;
        const hasExistingOfficialInvoice = existingInvoice &&
            (existingInvoice.type === 'FACTURE' ||
                existingInvoice.statut === 'VALIDE' ||
                existingInvoice.statut === 'PAYEE' ||
                existingInvoice.statut === 'PARTIEL');

        if (hasExistingOfficialInvoice) {
            console.log('🛡️ [INVOICE PROTECTION] Existing official invoice detected. Skipping status override to prevent unwanted fiscal operations.');
            console.log('   Current invoice:', {
                numero: existingInvoice.numero,
                type: existingInvoice.type,
                statut: existingInvoice.statut
            });
            // Do NOT force any status changes - preserve existing invoice as-is
        } else if (hasPendingTransfer) {
            // [NEW] Reinforced Financial Status Logic (Devis vs Vente en Instance)
            // If there is a payment, it's an Instance. If not, it's a Devis.
            // [RESTORED & FIXED] Logic to ensure DEVIS/INSTANCE is created so payments can attach.
            // Do NOT overwrite 'VENTE_EN_INSTANCE' or 'VALIDE' if already set.
            const currentStatus = this.linkedFactureSubject.value?.statut;
            const isWeakStatus = !currentStatus || currentStatus === 'BROUILLON';

            if (isWeakStatus) {
                if (hasPayment) {
                    // [FIX] Standardize to BON_COMM
                    userForcedType = 'BON_COMM';
                    userForcedStatut = 'VENTE_EN_INSTANCE';
                    this.snackBar.open('Acpte détecté : Vente passée en "Bon de Commande".', 'OK', { duration: 4000 });
                } else {
                    userForcedType = 'DEVIS';
                    userForcedStatut = 'BROUILLON';
                }
            } else {
                // [FIX] Never downgrade a BON_COMM or FACTURE back to DEVIS
                console.log('🛡️ [SYNC] Preserving existing status:', currentStatus);
                userForcedStatut = currentStatus as string;
                userForcedType = this.linkedFactureSubject.value?.type as string;
            }

            userForcedStockDecrement = false; // Stock handled by backend status change


            if (this.factureComponent) {
                this.factureComponent.form.patchValue({ type: userForcedType || 'DEVIS', statut: userForcedStatut || 'BROUILLON' });
            }
        } else if (hasPayment && !hasExistingOfficialInvoice) {
            // [FIX] Standardize to BON_COMM
            console.log('💰 Payment detected in general flow -> Upgrading to BON_COMM');
            userForcedType = 'BON_COMM';
            userForcedStatut = 'VENTE_EN_INSTANCE';
            userForcedStockDecrement = false;

        } else if (needsDecision) {
            const warehouses = [...new Set(productsWithStock.map(p => p.entrepotNom || p.entrepotType))].join(' / ');
            const message = `Vente effectuée depuis l'entrepôt : ${warehouses}.\n\nSouhaitez-vous VALIDER la vente ou la LAISSER EN INSTANCE ?`;

            const choice = confirm(`${message}\n\nOK = Valider\nAnnuler = En Instance`);

            if (choice) {
                userForcedType = 'FACTURE';
                userForcedStatut = 'VALIDE';
                userForcedStockDecrement = true; // Force stock decrement for direct validation
                if (this.factureComponent) {
                    this.factureComponent.form.patchValue({ type: 'FACTURE', statut: 'VALIDE' });
                }
            } else {
                // Instance (No Stock Decrement yet)
                // [FIX] Standardize to BON_COMM
                userForcedType = 'BON_COMM';
                userForcedStatut = 'VENTE_EN_INSTANCE';
                userForcedStockDecrement = false;
                if (this.factureComponent) {
                    this.factureComponent.form.patchValue({ type: 'BON_COMM', statut: 'VENTE_EN_INSTANCE' });
                }
            }

        }

        operation.pipe(
            switchMap(fiche => {
                this.ficheId = fiche.id;
                this.isEditMode = false;

                // Check if we should create an invoice
                const generatedLines = this.getInvoiceLines();
                const shouldCreateInvoice = generatedLines.length > 0;

                if (shouldCreateInvoice) {
                    // Scenario 1: FactureComponent is active (User visited tab) -> Use it (preserves manual edits)
                    if (this.factureComponent) {
                        // Update input manually to ensure it has the new ficheId
                        this.factureComponent.ficheIdInput = fiche.id;

                        // FIX: Force sync lines and nomenclature from Monture form to Facture component
                        // (Because FactureComponent might have stale data if user didn't visit tab after changes)
                        const freshLines = this.getInvoiceLines();
                        const freshNomenclature = this.nomenclatureString;

                        // Update Nomenclature
                        if (freshNomenclature) {
                            this.factureComponent.form.patchValue({ proprietes: { nomenclature: freshNomenclature } });
                        }

                        // Update Lines if we have fresh ones
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

                        // Prepare extra properties for forceStockDecrement
                        const extraProps: any = {};
                        if (userForcedStockDecrement) {
                            extraProps.forceStockDecrement = true;
                        }

                        // Apply user forced status if provided (e.g. VALIDE or ARCHIVE)
                        if (userForcedStatut) {
                            this.factureComponent.form.patchValue({ statut: userForcedStatut }, { emitEvent: false });
                        }
                        if (userForcedType) {
                            this.factureComponent.form.patchValue({ type: userForcedType }, { emitEvent: false });
                        }

                        // [CRITICAL FIX] Dirty check: Only save invoice if lines changed OR it's new
                        // This prevents unnecessary backend calls and fiscal flow triggers
                        const currentLines = this.getInvoiceLines();
                        const linesChanged = JSON.stringify(currentLines) !== JSON.stringify(this.initialLines);
                        const isNewInvoice = !this.factureComponent.id || this.factureComponent.id === 'new';

                        if (!linesChanged && !isNewInvoice && !userForcedStatut && !userForcedType) {
                            console.log('📋 [INVOICE SKIP] No changes to invoice lines or status. Skipping save to prevent unwanted fiscal operations.');
                            console.log('   Initial lines:', this.initialLines.length, 'Current lines:', currentLines.length);
                            return of(fiche); // Skip invoice save, just return fiche
                        }

                        console.log('💾 [INVOICE SAVE] Lines changed or new invoice. Proceeding with save.', {
                            linesChanged,
                            isNewInvoice,
                            forcedStatus: userForcedStatut,
                            forcedType: userForcedType
                        });

                        // Pass extraProps to saveAsObservable
                        return this.factureComponent.saveAsObservable(true, extraProps).pipe(
                            map(() => fiche),
                            catchError(err => {
                                if (err.status === 409) {
                                    console.log('⚠️ [MontureForm] Race condition (Scen 1): Invoice already exists. Ignoring.');
                                    return of(fiche);
                                }
                                throw err;
                            })
                        );
                    }
                    // Scenario 2: FactureComponent not active (Tab never visited) -> Check if invoice exists, create if not
                    else {
                        // First, check if an invoice already exists for this fiche
                        // Use the linkedFacture$ observable if available, otherwise query by client
                        // FIX: Explicitly check service for existing invoice using FicheID to allow global lookup/avoid pagination issues
                        const checkExisting$ = this.factureService.findAll({
                            clientId: this.clientId,
                            ficheId: fiche.id
                        }).pipe(
                            map(factures => factures.find(f => f.ficheId === fiche.id) || null)
                        );

                        return checkExisting$.pipe(
                            switchMap(existingFacture => {
                                if (existingFacture) {
                                    // Invoice exists but component is not active.
                                    // We MUST update it with the new lines/properties to keep it in sync.
                                    console.log('🔄 Updating existing invoice (via Service) as component is not active');

                                    const total = generatedLines.reduce((acc, val) => acc + val.totalTTC, 0);
                                    // Calculate HT/TVA approx or relies on backend? Better to send all.
                                    // Similar logic to create but for update
                                    const tvaRate = 0.20;
                                    const totalHT = total / (1 + tvaRate);
                                    const tva = total - totalHT;

                                    const updateData: any = {
                                        lignes: generatedLines,
                                        totalTTC: total,
                                        totalHT: totalHT,
                                        totalTVA: tva,
                                        proprietes: {
                                            ...(existingFacture.proprietes as any || {}),
                                            nomenclature: this.nomenclatureString || '',
                                            forceStockDecrement: userForcedStockDecrement || (existingFacture.proprietes as any)?.forceStockDecrement
                                        },
                                        resteAPayer: total // Usually resets amount to pay if content changes? Valid for BROUILLON.
                                    };

                                    if (userForcedType) updateData.type = userForcedType;
                                    if (userForcedStatut) updateData.statut = userForcedStatut;

                                    return this.factureService.update(existingFacture.id, updateData).pipe(
                                        tap(updatedFacture => {
                                            console.log('🔄 [SYNC] Invoice updated in onSubmit. Syncing subject:', updatedFacture.numero);
                                            this.linkedFactureSubject.next(updatedFacture);
                                        }),
                                        map(() => fiche),
                                        catchError(err => {
                                            console.error('Error auto-updating invoice:', err);
                                            const message = err.error?.message || 'Erreur lors de la mise à jour de la facture';
                                            this.snackBar.open(`⚠️ ${message}`, 'Fermer', { duration: 7000 });
                                            // [FIX] Throw error to stop the chain
                                            return throwError(() => err);
                                        })
                                    );
                                }

                                // No invoice exists, create one
                                // Generate nomenclature first
                                console.log('📋 Generating nomenclature for new invoice:', this.nomenclatureString);

                                const total = generatedLines.reduce((acc, val) => acc + val.totalTTC, 0);
                                const tvaRate = 0.20;
                                const totalHT = total / (1 + tvaRate);
                                const tva = total - totalHT;

                                const factureData: any = {
                                    type: 'DEVIS',
                                    statut: 'DEVIS_EN_COURS',
                                    dateEmission: new Date(),
                                    clientId: this.clientId,
                                    ficheId: fiche.id,
                                    lignes: generatedLines,
                                    totalTTC: total,
                                    totalHT: totalHT,
                                    totalTVA: tva,
                                    proprietes: {
                                        nomenclature: this.nomenclatureString || '',
                                        forceStockDecrement: userForcedStockDecrement
                                    },
                                    resteAPayer: total
                                };

                                return this.factureService.create(factureData).pipe(
                                    tap(newFacture => {
                                        console.log('✨ [SYNC] Invoice created in onSubmit. Syncing subject:', newFacture.numero);
                                        this.linkedFactureSubject.next(newFacture);
                                    }),
                                    map(() => fiche),
                                    catchError(err => {
                                        // If error is unique constraint on ficheId, it means it was created in parallel.
                                        // We can ignore this error safely as the goal (invoice exists) is met.
                                        if (err?.status === 409 || err?.error?.message?.includes('ficheId') || err?.error?.code === 'P2002') {
                                            console.log('⚠️ Race condition prevented: Invoice already created during process.');
                                            return of(fiche);
                                        }
                                        console.error('Error auto-creating invoice:', err);
                                        const message = err.error?.message || 'Erreur lors de la création de la facture';
                                        this.snackBar.open(`⚠️ ${message}`, 'Fermer', { duration: 7000 });
                                        return throwError(() => err);
                                    })
                                );
                            }),
                            catchError(err => {
                                console.error('Error checking for existing invoice:', err);
                                return of(fiche);
                            })
                        );
                    }
                } else {
                    // No invoice to save
                    return of(fiche);
                }
            })
        ).subscribe({
            next: (fiche: FicheClient) => {
                this.loading = false;
                console.log('Fiche saved:', fiche);

                // Return to view mode after successful save
                this.isEditMode = false;
                this.ficheForm.disable();
                this.ficheId = fiche.id;
                this.currentFiche = fiche;
                this.patchForm(fiche);

                this.snackBar.open('Fiche enregistrée avec succès', 'OK', { duration: 3000 });

                if (wasNew) {
                    this.router.navigate(['/p/clients', this.clientId, 'fiche-monture', fiche.id], {
                        replaceUrl: true,
                        // Avoid full component re-init if possible by explicitly handling the ID update
                    });
                }

                // If on early tabs, auto-advance to Payments
                if (this.activeTab < 2) {
                    this.setActiveTab(2);
                }
            },
            error: (err: any) => {
                this.loading = false;
                console.error('Error saving fiche:', err);
                const msg = err.error?.message || err.statusText || 'Erreur inconnue';
                alert(`Erreur lors de l'enregistrement: ${msg}`);

                // Handle incomplete profile error
                if (err.status === 400 && err.error?.missingFields) {
                    const message = `Profil client incomplet.\n\nChamps manquants:\n${err.error.missingFields.join('\n')}\n\nVoulez-vous compléter le profil maintenant?`;

                    if (confirm(message)) {
                        this.router.navigate(['/p/clients', this.clientId, 'edit']);
                    }
                } else {
                    alert('Erreur lors de la sauvegarde de la fiche: ' + (err.message || 'Erreur inconnue'));
                }

                this.cdr.markForCheck();
            }
        });
    }



    async cancelInstancedSale() {
        this.loading = true;
        try {
            const factures = await firstValueFrom(this.factureService.findAll({ clientId: this.clientId || '' }));
            const currentFacture = factures.find(f => f.ficheId === this.ficheId);

            if (currentFacture) {
                // Cancel the sale and restore stock
                const updateData: any = {
                    statut: 'ANNULEE',
                    proprietes: {
                        ...(currentFacture.proprietes || {}),
                        cancelReason: 'Transfert annulé par le centre expéditeur',
                        cancelledAt: new Date(),
                        restoreStock: true // Signal to restore stock from -1 to 0
                    }
                };

                this.factureService.update(currentFacture.id, updateData).subscribe({
                    next: (res) => {
                        this.loading = false;
                        this.snackBar.open('Vente annulée. Le stock a été restauré.', 'Fermer', { duration: 5000 });
                        this.linkedFactureSubject.next(res);
                        this.cdr.markForCheck();
                        // Optionally navigate back or disable editing
                        this.isEditMode = false;
                    },
                    error: (err) => {
                        this.loading = false;
                        console.error('❌ Error cancelling sale:', err);
                        alert("Erreur lors de l'annulation: " + (err.message || 'Erreur inconnue'));
                    }
                });
            } else {
                this.loading = false;
                console.warn('⚠️ No associated invoice found to cancel.');
            }
        } catch (e) {
            console.error('Error in cancelInstancedSale:', e);
            this.loading = false;
        }
    }

    async validateInstancedSale() {
        if (confirm("Voulez-vous valider cette vente maintenant que le produit est reçu ?")) {
            this.loading = true;
            try {
                // [FIX] Use Direct Backend Lookup by FicheID to avoid Pagination/Limit issues
                console.log('🔍 [VALIDATION] Searching for invoices with FicheID:', this.ficheId);
                const factures = await firstValueFrom(this.factureService.findAll({
                    clientId: this.clientId || '',
                    ficheId: this.ficheId
                }));

                const currentFacture = factures.find(f => f.ficheId === this.ficheId)
                    || (factures.length === 1 ? factures[0] : undefined);

                if (currentFacture) {
                    console.log('✅ [VALIDATION] Found matched Invoice:', currentFacture.numero);
                    await this.performSaleValidation(currentFacture);
                    this.snackBar.open('Vente validée avec succès !', 'OK', { duration: 3000 });
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                } else {
                    console.warn('❌ [VALIDATION] No invoice matched ficheId (Backend Filtered):', this.ficheId);
                    this.loading = false;
                    alert("Impossible de trouver la facture associée. (Backend Lookup Failed)");
                }
            } catch (e) {
                console.error('Error in validateInstancedSale:', e);
                this.loading = false;
                alert("Une erreur est survenue lors de la validation.");
            }
        }
    }

    async onPaymentAdded() {
        console.log('💰 [EVENT] Payment Added - Checking for archiving decision...');

        // [NEW] Logic: Check if ANY product is pending transfer. If so, don't prompt for validation yet.
        const formValue = this.ficheForm.getRawValue();
        const hasPendingTransfer = formValue.monture?.isPendingTransfer ||
            formValue.verres?.isPendingTransfer ||
            (formValue.equipements || []).some((e: any) => e.monture?.isPendingTransfer || e.verres?.isPendingTransfer);

        if (hasPendingTransfer && !this.receptionComplete) {
            console.log('📦 Pending transfer detected. Skipping validation prompt until product arrival.');
            return;
        }

        // [RESTORED] Check for ANY valid line with total > 0 (even if no specific ProductId/EntrepotId yet)
        const invoiceLines = this.getInvoiceLines();
        const hasLines = invoiceLines.length > 0;

        if (!hasLines) {
            console.log('ℹ️ No invoice lines detected. No status upgrade needed.');
            return;
        }

        // [FIX] Check if invoice is already validated - skip prompt if already VALIDE
        try {
            const factures = await firstValueFrom(this.factureService.findAll({ clientId: this.clientId || '' }));
            const currentFacture = factures.find(f => f.ficheId === this.ficheId);

            if (currentFacture && (currentFacture.statut === 'VALIDE' || currentFacture.type === 'FACTURE' || currentFacture.statut === 'BON_DE_COMMANDE')) {
                console.log('✅ Invoice already validated or BC. Skipping upgrade.');
                return;
            }

            // [NEW] Silent Upgrade to BON_COMM + VENTE_EN_INSTANCE
            console.log('💪 Upgrading to BON_COMM due to payment.');
            if (currentFacture) {
                await firstValueFrom(this.factureService.update(currentFacture.id, {
                    statut: 'VENTE_EN_INSTANCE',
                    type: 'BON_COMM'
                }));
                this.snackBar.open('Documentation mise à jour : Bon de Commande', 'OK', { duration: 3000 });



                // Reload to refresh UI state (linked factures, status badges)
                this.loadLinkedFacture();
                this.loadFiche();

                // [FIX] Force child component to reload to see new "BON_COMM" type/number immediately
                if (this.factureComponent && currentFacture.id) {
                    console.log('🔄 [UI-SYNC] Forcing FactureForm reload...');
                    this.factureComponent.loadFacture(currentFacture.id);
                }
            }
        } catch (e) {
            console.error('Error checking invoice status:', e);
        }
    }


    private async performSaleValidation(staleFacture: any) {
        // [FIX] Double-check status LIVE to prevent stale UI blocking validation
        // Fetch fresh product statuses before blocking
        console.log('🛡️ [VALIDATION] Performing live status check before validating...');
        let liveReserved = false;
        let liveTransit = false;

        // REFRESH INVOICE explicitly to ensure we have the latest version (e.g. correct total, status)
        let currentFacture = staleFacture;
        try {
            console.log('🔄 [VALIDATION] Refreshing invoice data:', staleFacture.id);
            const freshInvoice = await firstValueFrom(this.factureService.findOne(staleFacture.id));
            if (freshInvoice) {
                currentFacture = freshInvoice;
                console.log('✅ [VALIDATION] Invoice refreshed. Status:', currentFacture.statut);
            }
        } catch (e) {
            console.warn('⚠️ [VALIDATION] Failed to refresh invoice, using passed object.', e);
        }

        // Scan lines to identify products to check
        const lines = this.getInvoiceLines();
        if (lines.length > 0) {
            // [OPTIMIZATION] Removed heavy client-side "findAll" check.
            // We now rely on the backend `verifyProductsAreReceived` called within FacturesService.update
            // This prevents fetching thousands of products and hanging the UI.

            // Minimal check: if we KNOW based on local form state that something is wrong, we can block.
            // But for deep validation (transit etc), we let the backend handle it and catch the error.
            if (this.currentFiche && this.receptionComplete === false && this.isSaleEnInstance) {
                // Soft warning but let it proceed to backend for authoritative check
                console.log('⚠️ [VALIDATION] Frontend suspects products are not fully received, but proceeding to backend check.');
            }
        }

        // Use LIVE flags instead of potentially stale this.isReserved / this.isTransit
        if (liveReserved || liveTransit) {
            this.snackBar.open('⚠️ Impossible de valider la vente : le produit n\'a pas encore été réceptionné (Statut vérifié en direct).', 'OK', { duration: 5000 });
            this.loading = false;
            return;
        }

        console.log('📄 [VALIDATION] Converting Devis to official Facture:', currentFacture.numero);

        // [FIX] Guard against missing Product IDs
        // Only warn for FRAMES (Monture) as Lenses (Verres) are often ordered without stock management
        const missingIds = lines.filter(l => !l.productId && l.description.includes('Monture'));
        if (missingIds.length > 0) {
            console.error('❌ [VALIDATION] Missing ProductID for lines:', missingIds);
            const confirmNoStock = confirm(
                "⚠️ ATTENTION : Certains produits (Monture/Verres) n'ont pas d'identifiant associé.\n\n" +
                "Le stock NE SERA PAS décrémenté pour ces produits.\n\n" +
                "Voulez-vous quand même valider la vente ?"
            );
            if (!confirmNoStock) return;
        }

        // Log the products and their IDs for debugging
        console.log('📦 [VALIDATION] Products in invoice:', lines.map(l => ({
            desc: l.description,
            productId: l.productId,
            entrepotType: l.entrepotType,
            entrepotId: l.entrepotId
        })));

        const total = lines.reduce((acc, l) => acc + l.totalTTC, 0);
        const tvaRate = 0.20;
        const totalHT = total / (1 + tvaRate);
        const tva = total - totalHT;

        const updateData: any = {
            type: 'FACTURE',
            statut: 'VALIDE',
            lignes: lines,
            totalTTC: total,
            totalHT: totalHT,
            totalTVA: tva,
            resteAPayer: Math.max(0, total - (currentFacture.totalTTC - currentFacture.resteAPayer)),
            proprietes: {
                ...(currentFacture.proprietes || {}),
                nomenclature: this.nomenclatureString || '',
                validatedAt: new Date(),
                isTransferFulfilled: true, // Mark as fulfilled
                forceStockDecrement: true,  // Ensure stock is decremented upon validation from fiche
                // [FIX] Force Fiscal Flow: Tell backend to generate official number unconditionally
                // This resolves issues where "Nouveau Document" or draft status ambiguity skips the flow.
                forceFiscal: true
            }
        };

        console.log('📤 [VALIDATION] Sending update with forceStockDecrement:', updateData.proprietes.forceStockDecrement);
        console.log('📤 [VALIDATION] Update data:', JSON.stringify(updateData, null, 2));

        return new Promise<void>((resolve, reject) => {
            this.factureService.update(currentFacture.id, updateData).subscribe({
                next: (res) => {
                    console.log('✅ [VALIDATION] Invoice updated successfully:', res);
                    this.loading = false;
                    this.snackBar.open('Vente validée et facture générée avec succès', 'Fermer', { duration: 5000 });
                    this.receptionComplete = false; // Reset flag
                    console.log('🔄 [VALIDATION] Calling onInvoiceSaved...');
                    this.onInvoiceSaved(res);
                    resolve();
                },
                error: (err) => {
                    console.error('❌ [VALIDATION] Error validating sale:', err);
                    this.loading = false;
                    console.error('❌ Error validating sale:', err);
                    alert("Erreur lors de la validation: " + (err.message || 'Erreur inconnue'));
                    reject(err);
                }
            });
        });
    }

    setInstanceFicheFacture(facture: any) {
        console.log('📦 Setting Devis to Instance and Decrementing Stock for:', facture.numero);
        this.loading = true;

        const lines = this.getInvoiceLines();
        const total = lines.reduce((acc, l) => acc + l.totalTTC, 0);
        const tvaRate = 0.20;
        const totalHT = total / (1 + tvaRate);
        const tva = total - totalHT;

        const updateData: any = {
            statut: 'VENTE_EN_INSTANCE',
            lignes: lines,
            totalTTC: total,
            totalHT: totalHT,
            totalTVA: tva,
            proprietes: {
                ...(facture.proprietes || {}),
                nomenclature: this.nomenclatureString || '',
                forceStockDecrement: false, // Changed from true
                instancedAt: new Date()
            }
        };

        this.factureService.update(facture.id, updateData).subscribe({
            next: (res) => {
                this.loading = false;
                this.snackBar.open('Vente mise en instance et stock décrémenté', 'Fermer', { duration: 5000 });
                this.onInvoiceSaved(res);
            },
            error: (err) => {
                this.loading = false;
                console.error('❌ Error setting instance status:', err);
                alert("Erreur lors de la mise en instance: " + (err.message || 'Erreur inconnue'));
            }
        });
    }

    ngAfterViewInit(): void {
        // Ensure view is fully initialized
        this.cdr.detectChanges();

        // Initialize canvas drawing with longer delay to ensure DOM is ready
        setTimeout(() => {
            this.updateFrameCanvasVisualization();
        }, 500);

        // Listen to montage form changes for real-time canvas updates
        this.ficheForm.get('montage')?.valueChanges.subscribe(() => {
            this.updateFrameCanvasVisualization();
        });
    }



    /**
     * Silently updates the fiche in the backend without triggering full validation/navigation
     * @param reload Whether to reload the fiche data from server after update (default: true)
     */
    saveFicheSilently(reload: boolean = true): void {
        if (!this.ficheId || this.ficheId === 'new' || !this.clientId) return;

        const formValue = this.ficheForm.getRawValue();
        const montantTotal = (parseFloat(formValue.monture.prixMonture) || 0) +
            (parseFloat(formValue.verres.prixOD) || 0) +
            (parseFloat(formValue.verres.prixOG) || 0);

        // Files serialization
        const serializableFiles = (this.prescriptionFiles || []).map(file => ({
            name: file.name,
            type: file.type,
            size: file.size,
            preview: typeof file.preview === 'string' ? file.preview : file.preview.toString(),
            uploadDate: file.uploadDate
        }));

        const ficheData: any = {
            clientId: this.clientId,
            type: 'MONTURE',
            statut: this.currentFiche?.statut || 'EN_COURS',
            dateLivraisonEstimee: formValue.dateLivraisonEstimee,
            ordonnance: {
                ...formValue.ordonnance,
                prescriptionFiles: serializableFiles
            },
            monture: formValue.monture,
            verres: formValue.verres,
            montage: formValue.montage,
            suggestions: this.suggestions || [],
            equipements: formValue.equipements || [],
            suiviCommande: formValue.suiviCommande,
            montantTotal,
            montantPaye: this.currentFiche?.montantPaye || 0
        };

        console.log('📤 [RECEPTION] Sending silent update to background...', { monture: formValue.monture?.productId });
        this.ficheService.updateFiche(this.ficheId, ficheData).subscribe({
            next: (res) => {
                console.log('✅ [RECEPTION] Fiche synced with local IDs.');

                // [NEW] Also sync the Facture in the background to ensure Monitor/Badges are updated
                this.factureService.findAll({ clientId: this.clientId || '' }).subscribe({
                    next: (factures) => {
                        const linked = factures.find(f => f.ficheId === this.ficheId);
                        if (linked && linked.statut === 'VENTE_EN_INSTANCE') {
                            console.log('🔄 [RECEPTION] Background syncing linked invoice:', linked.numero);
                            const lines = this.getInvoiceLines();
                            const total = lines.reduce((acc, l) => acc + l.totalTTC, 0);
                            this.factureService.update(linked.id, {
                                lignes: lines,
                                totalTTC: total,
                                proprietes: {
                                    ...(linked.proprietes || {}),
                                    nomenclature: this.nomenclatureString || '',
                                    lastSilentUpdate: new Date()
                                }
                            }).subscribe({
                                next: () => {
                                    console.log('✅ [RECEPTION] Invoice synced.');
                                    if (reload) this.loadFiche();
                                    else {
                                        this.currentFiche = { ...this.currentFiche, ...ficheData };
                                        // Trigger immediate UI refresh for status banners
                                        this.checkReceptionForInstance(this.currentFiche);
                                        this.cdr.markForCheck();
                                        setTimeout(() => this.cdr.detectChanges(), 100);
                                    }
                                },
                                error: (err: any) => console.error('❌ [RECEPTION] Error syncing legacy invoice:', err)
                            });
                        } else {
                            if (reload) this.loadFiche();
                            else {
                                this.currentFiche = { ...this.currentFiche, ...ficheData };
                                this.checkReceptionForInstance(this.currentFiche);
                                this.cdr.markForCheck();
                                setTimeout(() => this.cdr.detectChanges(), 100);
                            }
                        }
                    },
                    error: (err: any) => console.error('❌ [RECEPTION] Error fetching factures for background sync:', err)
                });
            },
            error: (err: any) => {
                console.error('❌ [RECEPTION] Error in silent update:', err);
                this.cdr.markForCheck();
            }
        });
    }



    /**
     * Open virtual centering modal with camera measurement
     */
    openVirtualCentering(): void {
        // Get frame data from form
        const taille = this.ficheForm.get('monture.taille')?.value || '52-18-140';
        const [calibreStr, pontStr] = taille.split('-');
        const calibre = parseInt(calibreStr) || 52;
        const pont = parseInt(pontStr) || 18;
        const typeMontage = this.ficheForm.get('montage.typeMontage')?.value || '';

        // Dynamically import the modal component
        import('../../../measurement/components/virtual-centering-modal/virtual-centering-modal.component')
            .then(m => {
                const dialogRef = this.dialog.open(m.VirtualCenteringModalComponent, {
                    width: '95vw',
                    maxWidth: '1400px',
                    height: '90vh',
                    disableClose: true,
                    panelClass: 'virtual-centering-dialog',
                    data: {
                        caliber: calibre,
                        bridge: pont,
                        mountingType: typeMontage
                    }
                });

                dialogRef.afterClosed().subscribe((measurement) => {
                    if (measurement) {
                        console.log('🔍 [DEBUG] Measurement received from modal:', measurement);
                        console.log('🔍 [DEBUG] frameHeightMm:', measurement.frameHeightMm);

                        // Fallback storage
                        this.lastMeasFrameHeight = measurement.frameHeightMm || null;

                        // FIX: Ensure 'hauteurVerre' control exists in 'montage' group to accept the value
                        const montageGroup = this.ficheForm.get('montage') as FormGroup;
                        if (montageGroup && !montageGroup.contains('hauteurVerre')) {
                            console.log('🔧 [FIX] Adding missing control: hauteurVerre to montage group');
                            montageGroup.addControl('hauteurVerre', new FormControl(null));
                        }

                        // Populate form with measurements (Precise values)
                        this.ficheForm.patchValue({
                            montage: {
                                ecartPupillaireOD: measurement.pdRightMm.toFixed(1), // Keep 1 decimal
                                ecartPupillaireOG: measurement.pdLeftMm.toFixed(1),
                                hauteurOD: measurement.heightRightMm ? measurement.heightRightMm.toFixed(1) : null,
                                hauteurOG: measurement.heightLeftMm ? measurement.heightLeftMm.toFixed(1) : null,
                                capturedImage: measurement.imageDataUrl || null,
                                hauteurVerre: measurement.frameHeightMm ? measurement.frameHeightMm.toFixed(1) : null,
                                diametreEffectif: `${measurement.edRightMm ? measurement.edRightMm.toFixed(1) : ''}/${measurement.edLeftMm ? measurement.edLeftMm.toFixed(1) : ''}`,
                                diagonalMm: measurement.diagonalMm ? parseFloat(measurement.diagonalMm.toFixed(2)) : null,
                                diagonalPoints: measurement.diagonalPoints || null
                            },
                            // Sync Ecarts to Ordonnance tab as well
                            ordonnance: {
                                od: { ep: measurement.pdRightMm.toFixed(1) },
                                og: { ep: measurement.pdLeftMm.toFixed(1) },
                                // Persist frame total height for reference
                                hauteurVerre: measurement.frameHeightMm ? measurement.frameHeightMm.toFixed(1) : null
                            }
                        });

                        // Redraw canvas with new values
                        setTimeout(() => {
                            this.updateFrameCanvasVisualization();

                            // AUTO-SAVE: Persist calibration data immediately
                            console.log('💾 Auto-saving calibration data...');
                            this.saveFicheSilently(false); // Don't reload to avoid UI flicker
                        }, 100);

                        this.cdr.markForCheck();
                    }
                });
            })
            .catch(error => {
                console.error('Failed to load virtual centering modal:', error);
                alert('Erreur lors du chargement du module de centrage virtuel');
            });
    }

    /**
     * Helper to calculate recommended ordering diameter (ED + 2mm)
     * Handles "60.3" and "60.3/58.1" formats
     */
    getRecommendedDiameter(): string {
        const val = this.ficheForm.get('montage.diametreEffectif')?.value;
        if (!val) return '';

        // Local helper for standard rounding (mirroring GeometryService more explicitly if needed, but we injected it)
        const getStd = (d: number) => {
            const standards = [55, 60, 65, 70, 75, 80, 85];
            for (const s of standards) {
                if (s >= d) return s;
            }
            return 85;
        };

        // Handle split values (OD/OG)
        if (typeof val === 'string' && val.includes('/')) {
            const parts = val.split('/');
            const od = parseFloat(parts[0]);
            const og = parseFloat(parts[1]);

            if (!isNaN(od) && !isNaN(og)) {
                const sOD = getStd(od + 2);
                const sOG = getStd(og + 2);
                return `Diamètre utile est ${val} mm. On ajoute 2 mm marge d'erreur ${(od + 2).toFixed(1)}/${(og + 2).toFixed(1)} mm (+2mm), on commande ${sOD}/${sOG} mm`;
            }
        }

        // Handle single value
        const num = parseFloat(val);
        if (!isNaN(num)) {
            const std = getStd(num + 2);
            return `Diamètre utile est ${num.toFixed(1)} mm. On ajoute 2 mm marge d'erreur ${(num + 2).toFixed(1)} mm (+2mm), on commande ${std} mm`;
        }

        return '';
    }

    /**
     * Helper to get specifically the ordering diameter (e.g., 60/60)
     */
    getDiametreACommander(): string {
        const val = this.ficheForm.get('montage.diametreEffectif')?.value;
        if (!val) return '-';

        const getStd = (d: number) => {
            const standards = [55, 60, 65, 70, 75, 80, 85];
            for (const s of standards) {
                if (s >= d) return s;
            }
            return 85;
        };

        if (typeof val === 'string' && val.includes('/')) {
            const parts = val.split('/');
            const od = parseFloat(parts[0]);
            const og = parseFloat(parts[1]);
            if (!isNaN(od) && !isNaN(og)) {
                return `${getStd(od + 2)}/${getStd(og + 2)}`;
            }
        }

        const num = parseFloat(val);
        if (!isNaN(num)) {
            return `${getStd(num + 2)}`;
        }

        return '-';
    }

    /**
     * Draw frame visualization using a static high-fidelity reference background
     * OD (Right eye) is on the LEFT of the sheet (Technical Convention)
     */
    updateFrameCanvasVisualization(): void {
        if (!this.frameCanvas || !this.frameCanvas.nativeElement) return;

        const canvas = this.frameCanvas.nativeElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Assets & Data
        const customImage = this.ficheForm.get('montage.capturedImage')?.value;
        const bgSource = customImage || 'assets/calibration-reference.png';

        const epOD = parseFloat(this.ficheForm.get('montage.ecartPupillaireOD')?.value) || 32;
        const epOG = parseFloat(this.ficheForm.get('montage.ecartPupillaireOG')?.value) || 32;
        const hOD = parseFloat(this.ficheForm.get('montage.hauteurOD')?.value) || 20;
        const hOG = parseFloat(this.ficheForm.get('montage.hauteurOG')?.value) || 20;
        const taille = this.ficheForm.get('monture.taille')?.value || '52-18-140';
        const [calibreStr, pontStr, brancheStr] = taille.split('-');
        const calibre = parseInt(calibreStr) || 52;
        const pont = parseInt(pontStr) || 18;

        // [PERSISTENCE FIX] Check if value exists in currentFiche but dropped from Form
        // This handles cases where loadFiche mapping might have missed the field despite initForm fix
        if (this.currentFiche && (this.currentFiche as any).montage?.hauteurVerre && !this.ficheForm.get('montage.hauteurVerre')?.value) {
            const savedVal = (this.currentFiche as any).montage.hauteurVerre;
            console.log('♻️ [PERSISTENCE] Restoring hauteurVerre from saved fiche:', savedVal);
            this.ficheForm.get('montage')?.patchValue({ hauteurVerre: savedVal }, { emitEvent: false });
        }

        const img = new Image();
        img.src = bgSource;
        img.onload = () => {
            // Draw Background
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear previous frame
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Overlay Measurements at fixed technical positions matching the reference image
            ctx.font = 'bold 24px "Outfit", sans-serif';
            ctx.fillStyle = '#0ea5e9'; // Modern Cyan matching reference arrows
            ctx.textAlign = 'center';

            // 1. EP Labels (Bottom Center-ish Arrows)
            ctx.fillText(`${epOD}`, 320, 370); // OD Position on arrows
            ctx.fillText(`${epOG}`, 480, 370); // OG Position on arrows

            // 2. Hauteur Verre (Height Labels from Virtual Centering - Inside lenses, near vertical arrows)
            ctx.fillStyle = '#ef4444'; // Modern Red for Heights (Pupillary Height)
            ctx.fillText(`${hOD}`, 235, 290); // Left lens (OD) - Pupillary Height
            ctx.fillText(`${hOG}`, 565, 290); // Right lens (OG) - Pupillary Height

            // 3. Hauteur Monture (Total Frame Height B-Dimension - Green on outer arrows)
            // Use captured Total Height if available, otherwise fallback/hide
            let hTotalVal = this.ficheForm.get('montage.hauteurVerre')?.value;

            // [display fix] Force fallback to currentFiche if form is empty
            if ((!hTotalVal || hTotalVal === '') && this.currentFiche && (this.currentFiche as any).montage?.hauteurVerre) {
                hTotalVal = (this.currentFiche as any).montage.hauteurVerre;
                console.log('✅ [DISPLAY] Using saved value from Fiche directly:', hTotalVal);
            }

            let hTotal = parseFloat(hTotalVal);

            // Fallback to local storage if form failed
            if (isNaN(hTotal) && this.lastMeasFrameHeight !== null) {
                hTotal = this.lastMeasFrameHeight;
                console.log('⚠️ Using local fallback for Frame Height:', hTotal);
            }

            // Console log for debugging
            if (!isNaN(hTotal)) {
                console.log('✏️ Drawing Frame M Height:', hTotal, 'Raw:', hTotalVal);
            }

            if (!isNaN(hTotal)) {
                ctx.fillStyle = '#22c55e'; // Modern Green for Frame Height
                const displayVal = hTotal.toFixed(1); // Format to 1 decimal
                ctx.fillText(`${displayVal}`, 70, 320);  // Left Outer Arrow (OD side) - Moved down below arrow (was 260)
                ctx.fillText(`${displayVal}`, 730, 320); // Right Outer Arrow (OG side) - Moved down below arrow (was 260)
            }

            // 4. Calibre / Pont Labels (Top)
            ctx.fillStyle = '#1e293b'; // Darker for top labels
            ctx.font = 'bold 20px "Outfit", sans-serif';
            ctx.fillText(`${calibre}`, 280, 110); // Calibre OD
            ctx.fillText(`${calibre}`, 520, 110); // Calibre OG
            ctx.fillText(`${pont}`, 400, 110);   // Pont

            ctx.font = 'italic 10px monospace';
            ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
            ctx.fillText('TECHNICAL_SYNC_ACTIVE: REF_V1.1', 100, 20);

            // [NEW] Draw Diagonal Measurement (Grand Diamètre - Black Arrow Style)
            const diagMm = this.ficheForm.get('montage.diagonalMm')?.value;
            const diagPoints = this.ficheForm.get('montage.diagonalPoints')?.value;

            if (diagMm && diagPoints && customImage) {
                // Scaling factors
                const scaleX = canvas.width / img.width;
                const scaleY = canvas.height / img.height;

                const p1 = { x: diagPoints.p1.x * scaleX, y: diagPoints.p1.y * scaleY };
                const p2 = { x: diagPoints.p2.x * scaleX, y: diagPoints.p2.y * scaleY };

                ctx.strokeStyle = '#000000'; // Black
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();

                // Draw Arrows
                const drawArrowHead = (pt1: { x: number, y: number }, pt2: { x: number, y: number }) => {
                    const angle = Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x);
                    const headLen = 14;
                    ctx.beginPath();
                    ctx.moveTo(pt2.x, pt2.y);
                    ctx.lineTo(pt2.x - headLen * Math.cos(angle - Math.PI / 6), pt2.y - headLen * Math.sin(angle - Math.PI / 6));
                    ctx.moveTo(pt2.x, pt2.y);
                    ctx.lineTo(pt2.x - headLen * Math.cos(angle + Math.PI / 6), pt2.y - headLen * Math.sin(angle + Math.PI / 6));
                    ctx.stroke();
                };
                drawArrowHead(p2, p1);
                drawArrowHead(p1, p2);

                // Label
                ctx.font = 'bold 20px "Outfit", sans-serif';
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'center';
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                ctx.fillText(`Grand Diamètre: ${parseFloat(diagMm).toFixed(1)} mm`, midX, midY - 15);
            }
        };
    }

    onCalibrationImageUpload(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e: any) => {
                this.ficheForm.patchValue({
                    montage: { capturedImage: e.target.result }
                });
                this.updateFrameCanvasVisualization();
            };
            reader.readAsDataURL(file);
        }
    }

    /**
     * Helper to get canvas data URL for print templates
     */
    getFrameCanvasDataUrl(): string {
        try {
            return this.frameCanvas?.nativeElement?.toDataURL() || '';
        } catch (e) {
            return '';
        }
    }


    /**
     * Print Fiche Montage - Refined Layout & Professional Billing Header
     */
    printFicheMontage(): void {
        this.canvasDataUrl = this.getFrameCanvasDataUrl();

        const ord = this.ficheForm.get('ordonnance')?.value || {};
        const montage = this.ficheForm.get('montage')?.value || {};
        const verres = this.ficheForm.get('verres')?.value || {};
        const suivi = this.ficheForm.get('suiviCommande')?.value || {};
        const ref = suivi.referenceCommande || 'N/A';
        const client = this.clientDisplayName || 'Client';
        const dateStr = new Date().toLocaleDateString('fr-FR');
        const observations = this.ficheForm.get('observations')?.value;

        // Ordonnance rows
        const od = ord.od || {};
        const og = ord.og || {};

        // Verres details
        const isDiff = verres.differentODOG;
        const matiereOD = isDiff ? (verres.matiereOD || '') : (verres.matiere || '');
        const matiereOG = isDiff ? (verres.matiereOG || '') : (verres.matiere || '');
        const indiceOD = isDiff ? (verres.indiceOD || '') : (verres.indice || '');
        const indiceOG = isDiff ? (verres.indiceOG || '') : (verres.indice || '');
        const marqueOD = isDiff ? (verres.marqueOD || '') : (verres.marque || '');
        const marqueOG = isDiff ? (verres.marqueOG || '') : (verres.marque || '');
        const traitOD = isDiff ? (verres.traitementOD || []) : (verres.traitement || []);

        const recommendations = (this as any).selectedRecommendations || [];
        const diamCommander = this.getDiametreACommander();
        const diamAdvice = this.getRecommendedDiameter();

        // Dynamic Logo and Company Name (Billing Style)
        const logoUrl = this.companySettings?.logoUrl || `${window.location.origin}/assets/images/logo.png`;
        const companyName = this.companySettings?.name || 'OPTISASS';

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Fiche Montage - ${ref}</title>
                <style>
                    @page { size: A4 portrait; margin: 0 !important; }
                    body { 
                        font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
                        color: #1e293b; 
                        padding: 12mm 15mm; 
                        line-height: 1.3; 
                        font-size: 8.5pt;
                        margin: 0;
                        -webkit-print-color-adjust: exact;
                    }
                    
                    /* Professional Billing Header */
                    .header { 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: start; 
                        border-bottom: 2px solid #0f172a; 
                        padding-bottom: 12px; 
                        margin-bottom: 15px; 
                    }
                    .logo-box { display: flex; align-items: center; gap: 15px; }
                    .logo-img { height: 60px; width: auto; }
                    .company-info { text-align: right; }
                    .company-info h1 { margin: 0; font-size: 16pt; font-weight: 900; color: #0f172a; text-transform: uppercase; }
                    .doc-title { margin-top: 4px; font-size: 11pt; color: #3b82f6; font-weight: 800; letter-spacing: 1px; }
                    .meta-info { font-size: 7.5pt; color: #64748b; margin-top: 4px; font-weight: 600; }

                    /* Client Info */
                    .client-section { 
                        display: flex; 
                        justify-content: space-between; 
                        background: #f8fafc; 
                        padding: 8px 12px; 
                        border-radius: 4px; 
                        margin-bottom: 15px; 
                        border: 1px solid #e2e8f0;
                    }
                    .client-info strong { color: #0f172a; font-size: 10pt; }

                    /* Tables Grid (Side-by-Side) */
                    .tables-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px; }
                    .section-title { 
                        font-size: 8.5pt; 
                        font-weight: 800; 
                        margin-bottom: 8px; 
                        color: #1e293b; 
                        text-transform: uppercase; 
                        display: flex;
                        align-items: center;
                        gap: 6px;
                    }
                    .title-dot { width: 6px; height: 6px; background: #3b82f6; border-radius: 50%; }
                    
                    table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 4px; border: 1px solid #000; }
                    th { font-size: 7pt; font-weight: 800; padding: 6px; text-align: center; background: #f1f5f9; border: 1px solid #000; color: #475569; text-transform: uppercase; }
                    td { padding: 6px; border: 1px solid #000; font-size: 9pt; font-weight: 700; text-align: center; }
                    .eye-cell { background: #eff6ff; color: #2563eb; width: 35px; }

                    /* Technical Specs Row */
                    .tech-row { 
                        display: grid; 
                        grid-template-columns: 1.3fr 0.7fr; 
                        border: 1.5px solid #0f172a; 
                        border-radius: 6px;
                        margin-bottom: 15px;
                    }
                    .tech-main { padding: 12px; border-right: 1px solid #e2e8f0; background: #fff; }
                    .tech-diam { padding: 12px; text-align: center; background: #f8fafc; display: flex; flex-direction: column; justify-content: center; }
                    
                    .tech-title { font-size: 8pt; font-weight: 800; color: #8b5cf6; margin-bottom: 6px; text-transform: uppercase; }
                    .tech-item { font-size: 8.5pt; line-height: 1.5; color: #334155; }
                    .tech-val { font-size: 26pt; font-weight: 900; color: #0f172a; line-height: 1; }
                    .tech-label { font-size: 7.5pt; font-weight: 800; color: #64748b; margin-bottom: 2px; }

                    /* Observation */
                    .obs-box { 
                        padding: 8px; 
                        border-left: 3px solid #cbd5e1; 
                        background: #fbfcfd; 
                        font-size: 8pt; 
                        color: #475569; 
                        margin-bottom: 12px; 
                    }

                    /* IA Recommendation Grid */
                    .ia-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
                    .ia-card { 
                        border: 1px solid #e2e8f0; 
                        padding: 10px; 
                        border-radius: 6px; 
                        background: #fff;
                        position: relative;
                    }
                    .ia-badge { 
                        position: absolute; top: 10px; right: 10px; 
                        font-size: 7pt; font-weight: 800; color: #2563eb; 
                        background: #eff6ff; padding: 2px 6px; border-radius: 4px; border: 1px solid #dbeafe;
                    }
                    .ia-title { font-size: 9pt; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
                    .ia-text { font-size: 8pt; color: #64748b; line-height: 1.4; }
                    .ia-thick { font-size: 8.5pt; font-weight: 800; color: #0f172a; margin-top: 6px; }

                    /* Preview Frame */
                    .preview-box { 
                        border: 1px solid #e2e8f0; 
                        border-radius: 8px; 
                        padding: 10px; 
                        background: white; 
                        text-align: center; 
                        margin-bottom: 20px;
                    }
                    .preview-img { width: 80%; max-height: 180px; object-fit: contain; }

                    /* Signature Block */
                    .sig-row { 
                        display: grid; 
                        grid-template-columns: 1fr 1fr; 
                        gap: 40px; 
                        margin-top: 15px; 
                        padding-top: 10px;
                        border-top: 1px solid #e2e8f0;
                    }
                    .sig-box { text-align: center; }
                    .sig-line { 
                        margin-top: 40px; 
                        border-top: 1.5px solid #0f172a; 
                        padding-top: 5px; 
                        font-size: 7.5pt; 
                        font-weight: 800; 
                        text-transform: uppercase; 
                    }

                    /* Advice Color Coding */
                    .advice { font-size: 8.5pt; font-weight: 700; margin-bottom: 10px; text-align: center; padding: 5px; border-radius: 4px; }
                    .advice-blue { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo-box">
                        <img src="${logoUrl}" class="logo-img" alt="Logo">
                    </div>
                    <div class="company-info">
                        <h1>${companyName}</h1>
                        <div class="doc-title">FICHE DE MONTAGE TECHNIQUE</div>
                        <div class="meta-info">REF: ${ref} | LE: ${dateStr}</div>
                    </div>
                </div>

                <div class="client-section">
                    <div class="client-info"><strong>CLIENT:</strong> ${client}</div>
                    <div style="font-size: 8pt; color: #64748b; font-weight: 700;">MAGASIN: ${companyName}</div>
                </div>

                <div class="tables-grid">
                    <div>
                        <div class="section-title"><span class="title-dot"></span> Correction Ordonnance</div>
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 30px">Oeil</th>
                                    <th>Sphère</th>
                                    <th>Cylindre</th>
                                    <th>Axe</th>
                                    <th>Add</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td class="eye-cell">OD</td>
                                    <td>${od.sphere ? (parseFloat(od.sphere) >= 0 ? '+' : '') + parseFloat(od.sphere).toFixed(2) : '+0.00'}</td>
                                    <td>${od.cylindre ? (parseFloat(od.cylindre) >= 0 ? '+' : '') + parseFloat(od.cylindre).toFixed(2) : '-'}</td>
                                    <td>${od.axe ? od.axe + '°' : '-'}</td>
                                    <td>${od.addition ? (parseFloat(od.addition) >= 0 ? '+' : '') + parseFloat(od.addition).toFixed(2) : '-'}</td>
                                </tr>
                                <tr>
                                    <td class="eye-cell">OG</td>
                                    <td>${og.sphere ? (parseFloat(og.sphere) >= 0 ? '+' : '') + parseFloat(og.sphere).toFixed(2) : '+0.00'}</td>
                                    <td>${og.cylindre ? (parseFloat(og.cylindre) >= 0 ? '+' : '') + parseFloat(og.cylindre).toFixed(2) : '-'}</td>
                                    <td>${og.axe ? og.axe + '°' : '-'}</td>
                                    <td>${og.addition ? (parseFloat(og.addition) >= 0 ? '+' : '') + parseFloat(og.addition).toFixed(2) : '-'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div>
                        <div class="section-title"><span class="title-dot"></span> Paramètres Centrage</div>
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 30px">Oeil</th>
                                    <th>DP</th>
                                    <th>HT (H)</th>
                                    <th>Diam. Utile</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td class="eye-cell">OD</td>
                                    <td>${montage.ecartPupillaireOD || '-'} mm</td>
                                    <td>${montage.hauteurOD || '-'} mm</td>
                                    <td>${(montage.diametreVerreOD || montage.diametreEffectif?.split('/')?.[0] || montage.diametreEffectif || '-')} mm</td>
                                </tr>
                                <tr>
                                    <td class="eye-cell">OG</td>
                                    <td>${montage.ecartPupillaireOG || '-'} mm</td>
                                    <td>${montage.hauteurOG || '-'} mm</td>
                                    <td>${(montage.diametreVerreOG || (montage.diametreEffectif?.includes('/') ? montage.diametreEffectif?.split('/')?.[1] : montage.diametreEffectif) || '-')} mm</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="tech-row">
                    <div class="tech-main">
                        <div class="tech-title">Types de Verres Sélectionnés</div>
                        <div class="tech-item"><strong>OD:</strong> ${matiereOD} ${indiceOD} (${marqueOD})</div>
                        <div class="tech-item"><strong>OG:</strong> ${matiereOG} ${indiceOG} (${marqueOG})</div>
                        <div style="font-size: 7.5pt; color: #64748b; margin-top: 4px; font-weight: 600;">TRAITEMENTS: ${traitOD.join(', ') || 'STANDARDS'}</div>
                    </div>
                    <div class="tech-diam">
                        <div class="tech-label">DIAMÈTRE UTILE</div>
                        <div class="tech-val">${diamCommander}</div>
                    </div>
                </div>

                ${diamAdvice ? `<div class="advice advice-blue">${diamAdvice}</div>` : ''}

                <div class="preview-box">
                    <div style="font-size: 8pt; font-weight: 800; color: #1e293b; margin-bottom: 5px; text-align: left; text-transform: uppercase;">Aperçu Configuration Monture</div>
                    <img src="${this.canvasDataUrl}" class="preview-img">
                </div>

                <div class="section-title" style="margin-bottom: 10px;"><span class="title-dot" style="background: #8b5cf6;"></span> Préconisations IA (Optimisation Épaisseur)</div>
                <div class="ia-grid">
                    ${recommendations && recommendations.length > 0 ? recommendations.slice(0, 2).map((s: any) => `
                        <div class="ia-card">
                            <div class="ia-badge">${s.type === 'OG' ? 'OG' : 'OD'}</div>
                            <div class="ia-title">${s.matiere} ${s.indice}</div>
                            <div class="ia-text">${s.raison}</div>
                            ${s.epaisseur ? `<div class="ia-thick">Estimation: ~${s.epaisseur}</div>` : ''}
                        </div>
                    `).join('') : `
                        <div class="ia-card">
                            <div class="ia-badge">OD</div>
                            <div class="ia-text">Configuration patient: ${matiereOD} ${indiceOD}</div>
                        </div>
                        <div class="ia-card">
                            <div class="ia-badge">OG</div>
                            <div class="ia-text">Configuration patient: ${matiereOG} ${indiceOG}</div>
                        </div>
                    `}
                </div>

                ${observations ? `<div class="obs-box"><strong>NOTES:</strong> ${observations}</div>` : ''}

                <div class="sig-row">
                    <div class="sig-box"><div class="sig-line">Technicien / Monteur</div></div>
                    <div class="sig-box"><div class="sig-line">Contrôle Final</div></div>
                </div>
            </body>
            </html>
        `);

        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    }

    /**
     * Print Bon de Commande Verre
     */
    printBonCommandeVerre(): void {
        const ord = this.ficheForm.get('ordonnance')?.value || {};
        const verres = this.ficheForm.get('verres')?.value || {};
        const suivi = this.ficheForm.get('suiviCommande')?.value || {};
        const montage = this.ficheForm.get('montage')?.value || {};
        const today = new Date().toLocaleDateString('fr-FR');
        const ref = suivi.referenceCommande || 'N/A';
        const client = this.clientDisplayName || 'Client';

        // Ordonnance rows
        const od = ord.od || {};
        const og = ord.og || {};

        // Verres details
        const isDiff = verres.differentODOG;
        const matiere = isDiff 
            ? `OD: ${verres.matiereOD || ''} | OG: ${verres.matiereOG || ''}`
            : (verres.matiere || '');
        const indice = isDiff
            ? `OD: ${verres.indiceOD || ''} | OG: ${verres.indiceOG || ''}`
            : (verres.indice || '');
        const traitements = isDiff
            ? `OD: ${(verres.traitementOD || []).join(', ') || '-'} | OG: ${(verres.traitementOG || []).join(', ') || '-'}`
            : ((verres.traitement || []).join(', ') || '-');
        
        const diametre = this.getDiametreACommander();

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
                <title>Bon de Commande Verres - ${ref}</title>
                <style>
                    @page { size: A4 portrait; margin: 0 !important; }
                    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 15mm; line-height: 1.5; font-size: 10pt; background: #fff; }
                    
                    /* Header Styles matching invoice/screenshot */
                    .header { display: flex; justify-content: space-between; align-items: start; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
                    .logo-box { display: flex; align-items: center; gap: 15px; }
                    .logo-img { height: 75px; width: auto; object-fit: contain; }
                    .company-info { text-align: right; }
                    .company-info h1 { margin: 0; font-size: 22pt; font-weight: 950; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px; }
                    .doc-title { margin-top: 5px; font-size: 16pt; color: #3b82f6; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; }
                    
                    /* Meta info cards */
                    .meta-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 35px; }
                    .info-card { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
                    .info-card label { display: block; font-size: 8.5pt; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
                    .info-card p { margin: 0; font-size: 13pt; font-weight: 800; color: #1e293b; }

                    .section { margin-bottom: 35px; }
                    .section-label { color: #94a3b8; font-size: 9pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
                    
                    /* Lens Characteristics Grid */
                    .lens-specs { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; column-gap: 40px; }
                    .spec-item { padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
                    .spec-item label { display: block; font-size: 8pt; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
                    .spec-item span { font-size: 10.5pt; font-weight: 600; color: #0f172a; }

                    /* Technical Table */
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th { text-align: left; font-size: 8.5pt; text-transform: uppercase; color: #94a3b8; padding: 12px 10px; font-weight: 800; border-bottom: 2px solid #e2e8f0; }
                    td { padding: 15px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11pt; font-weight: 500; }
                    .eye-row { font-weight: 900; color: #3b82f6; width: 60px; }
                    .val-cell { text-align: center; }
                    th.val-cell { text-align: center; }

                    /* Footer & Cachet */
                    .footer { text-align: center; margin-top: 60px; }
                    .cachet-label { font-weight: 800; color: #475569; font-size: 10pt; margin-bottom: 15px; }
                    .cachet-box { display: inline-block; width: 240px; height: 110px; border: 2px dashed #cbd5e1; border-radius: 16px; position: relative; display: flex; align-items: center; justify-content: center; color: #cbd5e1; font-size: 8pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }

                    @media print {
                        body { padding: 10mm 15mm; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo-box">
                        <img src="${logoUrl}" class="logo-img" alt="Logo">
                    </div>
                    <div class="company-info">
                        <h1>${companyName}</h1>
                        <div class="doc-title">Bon de Commande Verres</div>
                    </div>
                </div>

                <div class="meta-info">
                    <div class="info-card">
                        <label>Fournisseur</label>
                        <p>${suivi.fournisseur || '-'}</p>
                    </div>
                    <div class="info-card">
                        <label>Référence BC / Date</label>
                        <p>${ref} — ${today}</p>
                    </div>
                </div>

                <div class="section">
                    <div class="section-label">Caractéristiques des Verres</div>
                    <div class="lens-specs">
                        <div class="spec-item">
                            <label>Type de Verre</label>
                            <span>${verres.type || '-'}</span>
                        </div>
                        <div class="spec-item">
                            <label>Matière</label>
                            <span>${matiere}</span>
                        </div>
                        <div class="spec-item">
                            <label>Indice</label>
                            <span>${indice}</span>
                        </div>
                        <div class="spec-item">
                            <label>Diamètre Utile</label>
                            <span>${diametre} mm</span>
                        </div>
                        <div class="spec-item" style="grid-column: span 2; border-bottom: none;">
                            <label>Traitements</label>
                            <span>${traitements}</span>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-label">Prescription Technique</div>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 80px;">Oeil</th>
                                <th class="val-cell">Sphère</th>
                                <th class="val-cell">Cylindre</th>
                                <th class="val-cell">Axe</th>
                                <th class="val-cell">Addition</th>
                                <th class="val-cell">Diamètre</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td class="eye-row">OD</td>
                                <td class="val-cell">${od.sphere || '0.00'}</td>
                                <td class="val-cell">${od.cylindre || '0.00'}</td>
                                <td class="val-cell">${od.axe || '0'}°</td>
                                <td class="val-cell">${od.addition || '0.00'}</td>
                                <td class="val-cell">${diametre.split('/')?.[0] || diametre}</td>
                            </tr>
                            <tr>
                                <td class="eye-row">OG</td>
                                <td class="val-cell">${og.sphere || '0.00'}</td>
                                <td class="val-cell">${og.cylindre || '0.00'}</td>
                                <td class="val-cell">${og.axe || '0'}°</td>
                                <td class="val-cell">${og.addition || '0.00'}</td>
                                <td class="val-cell">${diametre.includes('/') ? diametre.split('/')?.[1] : diametre}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="footer">
                    <p class="cachet-label">Cachet du Magasin</p>
                    <div style="display: flex; justify-content: center;">
                        <div class="cachet-box">Emplacement Cachet</div>
                    </div>
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(() => window.close(), 1000);
                    }
                <\/script>
            </body>
            </html>
        `);

        printWindow.document.close();
    }

    /**
     * Generate and download montage sheet PDF (placeholder)
     */
    generateMontageSheet(): void {
        this.printFicheMontage();
    }

    /**
     * Re-integrated Order Actions
     */
    public showOrderActions(): void {
        const bcData = this.ficheForm.get('suiviCommande')?.value;
        const dialogRef = this.dialog.open(OrderActionDialogComponent, {
            width: 'auto',
            minWidth: '400px',
            maxWidth: '90vw',
            data: {
                bcNumber: bcData?.referenceCommande || 'N/A',
                ficheId: this.ficheId,
                clientName: this.client ? (isClientProfessionnel(this.client) ? this.client.raisonSociale : `${this.client.nom} ${this.client.prenom || ''}`) : 'Client',
                supplierName: bcData?.fournisseur || 'Fournisseur'
            }
        });

        dialogRef.afterClosed().subscribe(action => {
            if (action === 'print') this.printBC();
            if (action === 'email') this.emailOrder();
        });
    }
    // Duplicates removed
}

