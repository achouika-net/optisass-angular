import { Component, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, debounceTime, delay, distinctUntilChanged, map, shareReplay, switchMap, tap, first, take, timeout } from 'rxjs/operators';

import { Product, ProductType, ProductFilters, StockStats } from '../../../../shared/interfaces/product.interface';
import { Entrepot } from '../../../../shared/interfaces/warehouse.interface';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { StockAlimentationDialogComponent, AlimentationResult } from '../../components/stock-alimentation-dialog/stock-alimentation-dialog.component';
import { StockAlimentationService, BulkAlimentationPayload } from '../../services/stock-alimentation.service';
import { CeilingWarningDialogComponent } from '../../../finance/components/ceiling-warning-dialog/ceiling-warning-dialog.component';
import { finalize } from 'rxjs';
import { InvoiceFormDialogComponent } from '../../../finance/components/invoice-form-dialog/invoice-form-dialog.component';
import { CameraCaptureDialogComponent } from '../../../../shared/components/camera-capture/camera-capture-dialog.component';
import { OcrService } from '../../../../core/services/ocr.service';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector, UserIdSelector } from '../../../../core/store/auth/auth.selectors';
import { FinanceService } from '../../../finance/services/finance.service';
import { Supplier } from '../../../finance/models/finance.models';
import { ProductService } from '../../services/product.service';
import { WarehousesService } from '../../../warehouses/services/warehouses.service';
import { SelectionModel } from '@angular/cdk/collections';
import { BulkStockOutDialogComponent } from '../../dialogs/bulk-stock-out-dialog/bulk-stock-out-dialog.component';
import { BulkStockTransferDialogComponent } from '../../dialogs/bulk-stock-transfer-dialog/bulk-stock-transfer-dialog.component';
import { StockMovementHistoryDialogComponent } from '../../dialogs/stock-movement-history-dialog/stock-movement-history-dialog.component';
import { StockTransferDialogComponent } from '../../dialogs/stock-transfer-dialog/stock-transfer-dialog.component';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TypeFiche, StatutFiche } from '../../../client-management/models/fiche-client.model';
import { GlassIndex } from '../../../../core/models/glass-parameters.model';
import { GlassParametersService } from '../../../client-management/services/glass-parameters.service';
import { FicheService } from '../../../client-management/services/fiche.service';
import { ClientManagementService } from '../../../client-management/services/client.service';
import { combineLatest, startWith } from 'rxjs';

export interface StagedProduct {
    id?: string; // If existing product found
    tempId: string; // Unique ID for table management
    reference: string; // Référence Produit
    codeBarre?: string; // Code Barre (Manuel ou Scanné)
    nom: string;
    marque: string;
    categorie: string;
    quantite: number;
    prixAchat: number;
    tva: number;
    entrepotId?: string; // Target warehouse

    // Pricing Mode
    modePrix: 'FIXE' | 'COEFF';
    coefficient?: number;
    margeFixe?: number;
    prixVente: number;

    // Optical Details (OCR)
    couleur?: string;
    calibre?: string;
    pont?: string;

    // RPM Factory Data
    materiau?: string;
    forme?: string;
    genre?: string;

    existingStock?: number;
    existingPrixAchat?: number;
    suggestedWAP?: number;

    // IA Detection
    nomClient?: string; // If detected in BL

    // Internal prefill tracking (used for deduplication)
    _prefillFicheId?: string | null;
}

@Component({ // [DIAGNOSTIC] Triggering frontend rebuild
    selector: 'app-stock-entry-v2',
    standalone: true,
    imports: [
        CommonModule,
        AsyncPipe,
        ReactiveFormsModule,
        FormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatCheckboxModule,
        MatRadioModule,
        MatTabsModule,
        MatDividerModule,
        MatSnackBarModule,
        MatTooltipModule,
        MatDialogModule,
        MatDatepickerModule,
        MatMenuModule,
        MatSlideToggleModule,
        MatAutocompleteModule
    ],
    templateUrl: './stock-entry-v2.component.html',
    styleUrls: ['./stock-entry-v2.component.scss']
})
export class StockEntryV2Component implements OnInit {
    // Forms
    entryForm: FormGroup;
    documentForm: FormGroup;
    batchPricingForm: FormGroup;

    // Data lists (Moved up for better IDE visibility)
    public glassBrands$!: Observable<any[]>;
    public glassMaterials$!: Observable<any[]>;
    public glassIndices$!: Observable<any[]>;
    public glassTreatments$!: Observable<any[]>;

    // Fiche & Client Search State
    clientSearchCtrl = new FormControl('');
    clients$: Observable<any[]> = of([]);
    ficheSearchCtrl = new FormControl('');
    fiches$: Observable<any[]> = of([]);

    private _pendingPrefillFicheId: string | null = null;
    private _pendingPrefillClientName: string | null = null;

    // List of common Moroccan TVA rates
    tvaOptions = [20, 14, 10, 7, 0];

    // Staging Data
    stagedProducts: StagedProduct[] = [];
    dataSource = new MatTableDataSource<StagedProduct>([]);
    displayedColumns: string[] = ['codeBarre', 'reference', 'marque', 'nom', 'nomClient', 'categorie', 'entrepotId', 'quantite', 'prixAchat', 'tva', 'coefficient', 'prixVente', 'actions'];

    ocrProcessing = false;
    private glassData$!: Observable<any>;

    ocrError: string | null = null;
    analyzedText = '';
    useIntelligentOcr = true; // Par défaut, on utilise n8n
    isIntelligentOcr = false; // Flag to skip manual mapping UI
    showOcrData = false;
    detectedLines: any[] = [];
    suppliersList: any[] = []; // Local cache for OCR matching
    rawOcrResult: any = null; // Debug: store last raw response

    // New OCR Logic Properties
    splitLines: any[] = [];
    maxColumns = 0;
    columnMappings: { [key: number]: string } = {};
    detectedLeft: any[] = []; // Compat

    // Add missing properties for new OCR
    columnTypes = [
        { value: 'code', label: 'Code' },
        { value: 'marque', label: 'Marque' },
        { value: 'reference', label: 'Référence/Modèle' },
        { value: 'designation', label: 'Désignation' },
        { value: 'categorie', label: 'Catégorie' },
        { value: 'quantity', label: 'Quantité' },
        { value: 'prixUnitaire', label: 'Prix Unitaire' },
        { value: 'remise', label: 'Remise (%)' },
        { value: 'prixRemise', label: 'Prix Remisé' },
        { value: 'ignore', label: '-- Ignorer --' }
    ];

    // Search State
    foundProduct: any = null;
    isSearching = false;

    // Data lists
    suppliers$!: Observable<Supplier[]>;

    // Bulk Operations State
    bulkSelection = new SelectionModel<Product>(true, []);
    bulkReference = '';
    bulkBarcode = '';
    bulkMarque = '';
    bulkEntrepotId?: string;
    bulkType?: ProductType;
    bulkProducts$ = new BehaviorSubject<Product[]>([]);
    bulkDisplayedColumns: string[] = ['select', 'reference', 'marque', 'designation', 'entrepot', 'stock', 'lastMovement'];
    loadingBulk = false;
    skipPaymentPrompt = false;

    currentCentre = this.store.selectSignal(UserCurrentCentreSelector);
    currentUser = this.store.selectSignal(UserIdSelector);
    ProductType = ProductType;

    entrepots$ = new BehaviorSubject<Entrepot[]>([]);
    stats$ = new BehaviorSubject<StockStats | null>(null);
    productTypes = Object.values(ProductType);
    duplicateInvoice: any = null;
    submitting = false;

    constructor(
        private fb: FormBuilder,
        private ocrService: OcrService,
        private financeService: FinanceService,
        private productService: ProductService,
        private warehousesService: WarehousesService,
        private snackBar: MatSnackBar,
        private dialog: MatDialog,
        private store: Store,
        private route: ActivatedRoute,
        private stockService: StockAlimentationService,
        private ficheService: FicheService,
        private clientService: ClientManagementService,
        private glassService: GlassParametersService
    ) {
        this.entryForm = this.fb.group({
            reference: [''], // Not required if codeBarre present
            codeBarre: [''], // Nouveau champ
            nom: ['', Validators.required],
            marque: [''],
            categorie: ['MONTURE_OPTIQUE', Validators.required],
            quantite: [1, [Validators.required, Validators.min(1)]],
            prixAchat: [0, [Validators.required, Validators.min(0)]],
            tva: [20, Validators.required],
            modePrix: ['FIXE', Validators.required], // FIXE or COEFF
            coefficient: [2.5],
            margeFixe: [0],
            prixVente: [0, Validators.required],
            glassBrandId: [''],
            glassMaterialId: [''],
            glassIndexId: [''],
            glassTreatmentIds: [[]]
        });

        this.documentForm = this.fb.group({
            type: ['FACTURE', Validators.required],
            fournisseurId: ['', Validators.required],
            numero: ['', Validators.required],
            date: [new Date()],
            file: [null],
            centreId: [null],
            entrepotId: [''], // Facultatif
            clientId: [''],
            ficheId: ['']
        });

        this.batchPricingForm = this.fb.group({
            modePrix: ['COEFF'],
            coefficient: [2.5],
            margeFixe: [0],
            tva: [null],
            quantite: [null],
            entrepotId: [null],
            categorie: [null] // NEW
        });

        this.setupProductSearch();
    }

    ngOnInit(): void {
        this.suppliers$ = this.financeService.getSuppliers().pipe(
            tap((suppliers: any[]) => {
                console.log('[StockEntryV2] Suppliers loaded:', suppliers?.length);
                this.suppliersList = suppliers || [];
            }),
            catchError((err: any) => {
                console.error('[StockEntryV2] Error loading suppliers:', err);
                setTimeout(() => this.snackBar.open('Erreur lors du chargement des fournisseurs', 'OK', { duration: 5000 }));
                return of([]);
            })
        );
        
        // Initialize glass observables
        this.glassData$ = this.glassService.getAll().pipe(
            shareReplay(1),
            catchError(err => {
                console.error('❌ [StockEntryV2] Fatal error loading glass data:', err);
                return of({ brands: [], materials: [], treatments: [] });
            })
        );

        this.glassBrands$ = this.glassData$.pipe(map((d: any) => d.brands));
        this.glassMaterials$ = this.glassData$.pipe(map((d: any) => d.materials));
        this.glassIndices$ = this.glassData$.pipe(map((d: any) => d.materials.flatMap((m: any) => m.indices)));
        this.glassTreatments$ = this.glassData$.pipe(map((d: any) => d.treatments));


        // Load warehouses for current centre
        const center = this.currentCentre();
        const centerId = center ? center.id : undefined;

        this.warehousesService.findAll(centerId).subscribe({
            next: (data) => {
                console.log('Warehouses loaded:', data);
                this.entrepots$.next(data);
                
                // Auto-select first warehouse if none selected
                if (data && data.length > 0 && !this.documentForm.get('entrepotId')?.value) {
                    this.documentForm.patchValue({ entrepotId: data[0].id });
                }
            },
            error: (err) => console.error('Error loading warehouses:', err)

        });

        // Initialize Client Search logic
        this.clients$ = this.clientSearchCtrl.valueChanges.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(value => {
                if (!value || typeof value !== 'string' || value.length < 2) return of([]);
                return this.clientService.searchClients({ nom: value }).pipe(catchError(() => of([])));
            }),
            shareReplay(1)
        );

        // Watch for Document Number changes to auto-link with Finance BLs
        this.documentForm.get('numero')!.valueChanges.pipe(
            debounceTime(500),
            distinctUntilChanged()
        ).subscribe(value => {
            if (value && value.length >= 3) {
                this.searchExistingFinanceBL(value);
            }
        });

        // Initialize Fiche Search logic (linked to selected client if any)
        this.fiches$ = combineLatest([
            this.ficheSearchCtrl.valueChanges.pipe(startWith('')),
            this.documentForm.get('clientId')!.valueChanges.pipe(startWith(''))
        ]).pipe(
            debounceTime(300),
            switchMap(([query, clientId]) => {
                console.log(`🔍 [FicheSearch] Query: "${query}", ClientId: ${clientId}`);
                if (clientId) {
                    return this.ficheService.getFichesByClient(clientId).pipe(
                        map(fiches => fiches.filter(f => 
                            f.statut === StatutFiche.COMMANDE || 
                            (f.numero && f.numero.toString().includes(query))
                        )),
                        catchError(() => of([]))
                    );
                }
                if (query && query.length >= 2) {
                    return this.ficheService.getAllFiches().pipe(
                        map(fiches => fiches.filter(f => 
                            (f.numero && f.numero.toString().includes(query)) || 
                            (f.clientId && f.clientId.toLowerCase().includes(query.toLowerCase()))
                        ).slice(0, 10)),
                        catchError(() => of([]))
                    );
                }
                return of([]);
            }),
            shareReplay(1)
        );

        // Auto-calculate selling price when Purchase Price, Coef or Fixed Margin changes
        this.entryForm.valueChanges.subscribe(val => {
            let calculatedPrice = val.prixVente;

            if (val.modePrix === 'COEFF' && val.prixAchat && val.coefficient) {
                calculatedPrice = val.prixAchat * val.coefficient;
            } else if (val.modePrix === 'FIXE' && val.prixAchat && val.margeFixe !== undefined) {
                calculatedPrice = Number(val.prixAchat) + Number(val.margeFixe);
            }

            // avoid infinite loop if no change
            if (Math.abs(calculatedPrice - val.prixVente) > 0.01) {
                this.entryForm.patchValue({ prixVente: parseFloat(calculatedPrice.toFixed(2)) }, { emitEvent: false });
            }
        });

        // Glass Parameter Listeners to auto-generate Name and Fixed Price
        this.entryForm.get('glassBrandId')?.valueChanges.subscribe(() => this.generateGlassName());
        this.entryForm.get('glassMaterialId')?.valueChanges.subscribe(() => this.generateGlassName());
        this.entryForm.get('glassIndexId')?.valueChanges.subscribe(() => this.generateGlassName());
        this.entryForm.get('glassTreatmentIds')?.valueChanges.subscribe(() => this.generateGlassName());

        this.searchBulkProducts();

        // Initial patch for centreId
        const activeCenterId = this.currentCentre()?.id;
        if (activeCenterId) {
            this.documentForm.patchValue({ centreId: activeCenterId });
        }

        // Handle prefilled data from query params
        this.route.queryParams.pipe(take(1)).subscribe(params => {
            if (params['prefillInvoice'] || params['prefillSupplier']) {
                const invoiceNum = params['prefillInvoice'] || '';
                
                this.documentForm.patchValue({
                    numero: invoiceNum,
                    fournisseurId: params['prefillSupplier'] || '',
                    date: params['prefillDate'] ? new Date(params['prefillDate']) : new Date()
                }, { emitEvent: false });

                if (invoiceNum) {
                    this.skipPaymentPrompt = true;
                    // FORCE SEARCH: Ensure we pull the full BL record (Client, Fiche, etc.)
                    // NOTE: searchExistingFinanceBL already calls prefillFromFiche internally
                    // so we must NOT also call it from prefillFicheId to avoid double-adding.
                    this.searchExistingFinanceBL(invoiceNum);
                } else if (params['prefillFicheId']) {
                    // Only prefill from fiche if there's no BL search (to avoid duplicate)
                    this.prefillFromFiche(params['prefillFicheId'], {
                        type: params['prefillType'],
                        source: params['prefillSource'],
                        total: params['prefillTotal']
                    });
                }

                setTimeout(() => this.snackBar.open('Données du document importées', 'OK', { duration: 3000 }));
            } else if (params['prefillFicheId']) {
                // No invoice in params, safe to prefill from fiche directly
                this.prefillFromFiche(params['prefillFicheId'], {
                    type: params['prefillType'],
                    source: params['prefillSource'],
                    total: params['prefillTotal']
                });
            }
        });

        this.setupDuplicateCheck();
        this.loadStats();
    }

    loadStats() {
        this.productService.getStockStatistics().subscribe((stats: StockStats) => {
            this.stats$.next(stats);
        });
    }

    getStockStatus(qty: number): { label: string, class: string } {
        if (qty <= 0) return { label: 'Rupture', class: 'danger' };
        if (qty < 10) return { label: 'Stock Faible', class: 'warning' };
        if (qty > 100) return { label: 'Surstock', class: 'primary' };
        return { label: 'Optimal', class: 'success' };
    }

    calculateMargin(buy: number, sell: number): number {
        if (!buy || !sell) return 0;
        return ((sell - buy) / sell) * 100;
    }

    getTotalBasketValue(): number {
        return this.stagedProducts.reduce((acc, p) => acc + (p.prixAchat * p.quantite), 0);
    }

    /**
     * Search for an existing BL in the Finance module and auto-fill if found
     */
    searchExistingFinanceBL(numeroBL: string) {
        console.log('🔍 Searching for existing Finance BL:', numeroBL);
        this.financeService.getBonLivraisons({ numeroBL: numeroBL } as any).pipe(take(1)).subscribe({
            next: (response) => {
                const bl = response.data.find((b: any) => b.numeroBL === numeroBL);
                if (bl) {
                    console.log('✅ Found existing Finance BL:', bl);
                    setTimeout(() => this.snackBar.open(`BL #${bl.numeroBL} trouvé. Importation des données...`, 'OK', { duration: 3000 }));
                    
                    // 1. Update Document Form
                    this.documentForm.patchValue({
                        fournisseurId: bl.fournisseurId,
                        type: 'BL',
                        clientId: bl.clientId,
                        ficheId: bl.ficheId,
                        date: bl.dateEmission ? new Date(bl.dateEmission) : new Date()
                    }, { emitEvent: false });

                    // 2. Update Search Controls labels
                    if (bl.client) {
                        this.clientSearchCtrl.setValue(`${bl.client.nom || ''} ${bl.client.prenom || ''}`, { emitEvent: false });
                    }
                    if (bl.fiche) {
                        this.ficheSearchCtrl.setValue(`BC #${bl.fiche.numero || 'N/A'} - ${bl.fiche.type}`, { emitEvent: false });
                    }

                    // 3. Set Category and trigger lens pre-fill if applicable
                    const docType = bl.categorieBL || 'BL';
                    if (docType.includes('VERRE') || (bl.fiche && bl.fiche.type === TypeFiche.MONTURE)) {
                        this.entryForm.patchValue({ categorie: 'VERRE' });
                        if (bl.ficheId) {
                            this.prefillFromFiche(bl.ficheId, { total: bl.montantTTC, source: 'FINANCE_LINK', type: docType });
                        }
                    } else if (docType.includes('LENTILLE') || (bl.fiche && bl.fiche.type === TypeFiche.LENTILLES)) {
                        this.entryForm.patchValue({ categorie: 'LENTILLE' });
                        if (bl.ficheId) {
                            this.prefillFromFiche(bl.ficheId, { total: bl.montantTTC, source: 'FINANCE_LINK', type: docType });
                        }
                    } else {
                        // Generic fallback
                        if (bl.ficheId) {
                            this.prefillFromFiche(bl.ficheId, { total: bl.montantTTC, source: 'FINANCE_LINK', type: docType });
                        }
                    }
                }
            },
            error: (err) => console.error('Error searching for Finance BL:', err)
        });
    }

    onClientSelected(event: MatAutocompleteSelectedEvent) {
        const client = event.option.value;
        if (client && client.id) {
            this.documentForm.patchValue({ clientId: client.id, ficheId: '' });
            this.ficheSearchCtrl.setValue('', { emitEvent: false });
            const fullName = `${client.nom || ''} ${client.prenom || ''}`.trim();
            this.clientSearchCtrl.setValue(fullName, { emitEvent: false });
            this._pendingPrefillClientName = fullName;
        }
    }

    onFicheSelected(event: MatAutocompleteSelectedEvent) {
        const fiche = event.option.value;
        if (fiche && fiche.id) {
            this.documentForm.patchValue({ 
                ficheId: fiche.id,
                type: 'BL' // Auto-set as Delivery Note
            });
            console.log('✅ [StockEntryV2] Fiche selected:', fiche.id, fiche.type);
            this.prefillFromFiche(fiche.id, {
                source: 'MANUAL_LINK'
            });
            this.ficheSearchCtrl.setValue(`BC #${fiche.numero || 'N/A'} - ${fiche.type}`, { emitEvent: false });
            
            if (fiche.client) {
                this._pendingPrefillClientName = `${fiche.client.nom || ''} ${fiche.client.prenom || ''}`.trim();
            }
        }
    }

    private _isPrefilling = false;

    prefillFromFiche(ficheId: string, options: { type?: string, source?: string, total?: any } = {}) {
        if (this._isPrefilling) return;
        this._isPrefilling = true;

        console.log(`🚀 [Prefill] Starting prefill for Fiche ID: ${ficheId}`, options);
        setTimeout(() => this.snackBar.open('Importation des produits depuis le dossier...', 'Patientez', { duration: 2000 }));
        
        try {
            // Immediate deduplication: Remove any existing items from THIS fiche to avoid duplicates
            const originalCount = this.stagedProducts.length;
            this.stagedProducts = this.stagedProducts.filter(p => p._prefillFicheId !== ficheId);
            if (this.stagedProducts.length !== originalCount) {
                console.log(`🧹 [Prefill] Removed ${originalCount - this.stagedProducts.length} duplicate items for this fiche`);
                this.dataSource.data = [...this.stagedProducts];
            }

            const type = options.type || '';
            const isVerreDoc = ['ACHAT_VERRE_OPTIQUE', 'ACHAT_VERRES_OPTIQUE', 'VERRE_OPTIQUE'].includes(type.toUpperCase());
            const isLentilleDoc = ['ACHAT_LENTILLE', 'ACHAT_LENTILLES', 'LENTILLE'].includes(type.toUpperCase());
            const isGenericDoc = ['FACTURE', 'BL', 'ACHAT_STOCK', 'AUTRE', ''].includes(type.toUpperCase());
    
            this.ficheService.getFicheById(ficheId).pipe(
                timeout(8000),
                catchError(err => {
                    console.error('❌ [Prefill] Error fetching fiche:', err);
                    this.snackBar.open('Erreur: Dossier introuvable ou inaccessible', 'Fermer', { duration: 5000 });
                    this._isPrefilling = false;
                    return of(null);
                })
            ).subscribe({
                next: (fiche: any) => {
                    if (!fiche) return;

                    // Capture client name for dossier linking
                    if (fiche.client) {
                        this._pendingPrefillClientName = `${fiche.client.nom || ''} ${fiche.client.prenom || ''}`.trim();
                        console.log('👤 [Prefill] Linked to client:', this._pendingPrefillClientName);
                    }

                    const ficheType = (fiche.type || '').toUpperCase();
                    const hasVerres = !!fiche.verres;
                    const hasLentilles = !!fiche.lentilles;
                    const hasMonture = !!fiche.monture;
                    
                    // Logic: If it's a generic document or we forced a link, we check everything the fiche has
                    const isGeneric = ['FACTURE', 'BL', 'ACHAT_STOCK', 'AUTRE', ''].includes(type.toUpperCase());
                    const forceVerre = type.toUpperCase().includes('VERRE') || type.toUpperCase().includes('GLASS');
                    const forceLentille = type.toUpperCase().includes('LENTILLE') || type.toUpperCase().includes('LENS');

                    console.log(`🎯 [Prefill] Logic: isGeneric=${isGeneric}, FicheType=${ficheType}, hasVerres=${hasVerres}, hasMonture=${hasMonture}`);
                    const total = options.total || 0;
                    // --- Prefill Execution ---
                    let productsAdded = false;

                    // 1. Handle Glasses (Verres)
                    if (forceVerre || (isGeneric && hasVerres)) {
                        const verres = fiche.verres;
                        if (verres) {
                            productsAdded = true;
                            const isDifferentODOG = verres.differentODOG === true;
                            
                            // Get glass data (brands, etc.)
                            const data$ = (this.glassData$ || of({ brands: [], materials: [], treatments: [] })).pipe(
                                take(1),
                                timeout(5000),
                                catchError(() => of({ brands: [], materials: [], treatments: [] }))
                            );

                            data$.subscribe((p: any) => {
                                console.log('🔍 [Prefill] Glass Data available:', {
                                    materialsCount: p.materials?.length,
                                    treatmentsCount: p.treatments?.length
                                });

                                const buildPrefill = (marque: string, indice: string, traitement: any, side: string, qty: number) => {
                                    const tArr = Array.isArray(traitement) ? traitement : (traitement ? [traitement] : []);
                                    const traits = tArr.join(' ');
                                    const nom = `Verre ${marque || ''} ${indice || ''} ${traits}`.trim() || `Verre ${side}`;
                                    
                                    // Purchase price from BL (divided by 2 for OD/OG)
                                    const prixAchatHT = total > 0 ? total / 2 : 0;

                                    // Selling price from parameters
                                    let prixVenteConfigured = 0;
                                    const searchIdx = (indice || '').replace(',', '.').toLowerCase();
                                    
                                    // Robust Index Search
                                    const allIndices = p.materials.flatMap((m: any) => m.indices);
                                    const foundIndex = allIndices.find((i: any) => {
                                        const label = i.label.replace(',', '.').toLowerCase();
                                        return label === searchIdx || searchIdx.includes(label) || label.includes(searchIdx);
                                    });
                                    
                                    if (foundIndex) {
                                        prixVenteConfigured += (foundIndex.price || 0);
                                        console.log(`✅ [Prefill] Found Index: ${foundIndex.label} | Price: ${foundIndex.price}`);
                                        
                                        // Add treatments
                                        const foundTraits = p.treatments.filter((t: any) => 
                                            tArr.some((vt: string) => {
                                                const vtl = vt.toLowerCase();
                                                const tl = t.name.toLowerCase();
                                                return tl.includes(vtl) || vtl.includes(tl);
                                            })
                                        );
                                        const treatPrice = foundTraits.reduce((acc: number, t: any) => acc + (t.price || 0), 0);
                                        prixVenteConfigured += treatPrice;
                                        if (foundTraits.length > 0) {
                                            console.log(`✅ [Prefill] Found ${foundTraits.length} Treatments | Total Price: ${treatPrice}`);
                                        }
                                    } else {
                                        console.warn(`⚠️ [Prefill] Index not found for: "${indice}"`);
                                    }

                                    // NEW: Price from Fiche (Dossier Client)
                                    let prixFromFiche = 0;
                                    if (side === 'OD') prixFromFiche = parseFloat(String(verres.prixOD || 0));
                                    else if (side === 'OG') prixFromFiche = parseFloat(String(verres.prixOG || 0));
                                    else if (side === 'PAIRE') prixFromFiche = parseFloat(String(verres.prix || 0));

                                    // Priority: 1. Fiche Price, 2. Parameter Price, 3. Purchase Price
                                    const finalPrixVente = prixFromFiche > 0 ? prixFromFiche : (prixVenteConfigured > 0 ? prixVenteConfigured : prixAchatHT);
                                    const margeToReachTarget = finalPrixVente - prixAchatHT;

                                    if (prixFromFiche > 0) {
                                        console.log(`💎 [Prefill] Using Price from Fiche for ${side}: ${prixFromFiche}`);
                                    }

                                    console.log(`💰 [Prefill] Final Pricing for ${side}: P.Achat=${prixAchatHT}, P.Vente=${finalPrixVente}`);

                                    return {
                                        categorie: 'VERRE',
                                        nom,
                                        quantite: qty,
                                        prixAchat: parseFloat(prixAchatHT.toFixed(2)),
                                        prixVente: parseFloat(finalPrixVente.toFixed(2)),
                                        margeFixe: parseFloat(margeToReachTarget.toFixed(2)),
                                        tva: 20,
                                        modePrix: 'FIXE',
                                        marque: marque || '',
                                        reference: `${marque || 'VERRE'}-${indice || 'INDEX'}`.toUpperCase()
                                    };
                                };

                                if (isDifferentODOG) {
                                    this.entryForm.patchValue(buildPrefill(verres.marqueOD || verres.marque, verres.indiceOD || verres.indice, verres.traitementOD || verres.traitement, 'OD', 1));
                                    this.addProduct(ficheId);
                                    setTimeout(() => {
                                        this.entryForm.patchValue(buildPrefill(verres.marqueOG || verres.marque, verres.indiceOG || verres.indice, verres.traitementOG || verres.traitement, 'OG', 1));
                                        this.addProduct(ficheId);
                                    }, 400);
                                } else {
                                    this.entryForm.patchValue(buildPrefill(verres.marque, verres.indice, verres.traitement, 'PAIRE', 2));
                                    this.addProduct(ficheId);
                                }
                            });
                        }
                    }

                    // 2. Handle Frame (Monture)
                    if (isGeneric && hasMonture) {
                        productsAdded = true;
                        setTimeout(() => {
                            this.prefillFrame(fiche, ficheId);
                        }, 1000);
                    }

                    // 3. Handle Lentilles
                    if (forceLentille || (isGeneric && hasLentilles)) {
                        productsAdded = true;
                        const lentilles = fiche.lentilles;
                        const nom = `Lentille ${lentilles?.type || ''} ${lentilles?.usage || ''}`.trim() || 'Lentille Fiche';
                        this.entryForm.patchValue({
                            categorie: 'LENTILLE',
                            nom,
                            quantite: 2,
                            prixAchat: 0,
                            prixVente: 0,
                            tva: 20,
                            modePrix: 'FIXE'
                        });
                        this.addProduct(ficheId);
                    }

                    if (!productsAdded) {
                        console.warn('⚠️ [Prefill] No products matching criteria were found in this fiche');
                        this.snackBar.open('Dossier vide ou incompatible avec ce type de document', 'OK', { duration: 3000 });
                    }
                    this._isPrefilling = false;
                },
                error: (err: any) => {
                    console.error('❌ [Prefill] Observable error:', err);
                    this._isPrefilling = false;
                }
            });
        } catch (err) {
            console.error('❌ [Prefill] Fatal error during prefill:', err);
            this.snackBar.open('Erreur lors du pré-remplissage automatique', 'Fermer', { duration: 5000 });
            this._isPrefilling = false;
        }
    }

    private prefillFrame(fiche: any, ficheId: string) {
        const monture = fiche.monture;
        const prefMonture = {
            categorie: 'MONTURE_OPTIQUE',
            nom: `${monture.marque || ''} ${monture.modele || ''}`.trim() || 'Monture Fiche',
            marque: monture.marque || '',
            reference: monture.modele || '',
            codeBarre: monture.codeBarre || '',
            quantite: 1,
            prixAchat: 0,
            prixVente: parseFloat(String(monture.prix || 0)),
            tva: 20,
            modePrix: 'FIXE'
        };
        
        if (prefMonture.prixVente > 0) {
            console.log(`💎 [Prefill] Using Frame Price from Fiche: ${prefMonture.prixVente}`);
        }
        
        console.log('➕ [Prefill] Adding Frame (Monture)...');
        this.entryForm.patchValue(prefMonture);
        this._pendingPrefillFicheId = ficheId; 
        this.forceAddProduct();
    }

    generateGlassName() {
        const val = this.entryForm.getRawValue();
        if (val.categorie !== 'VERRE') return;

        combineLatest([
            this.glassBrands$,
            this.glassMaterials$,
            this.glassIndices$,
            this.glassTreatments$
        ]).pipe(take(1)).subscribe(([brands, materials, indices, treatments]: [any[], any[], any[], any[]]) => {
            const brand = brands.find((b: any) => b.id === val.glassBrandId);
            const material = materials.find((m: any) => m.id === val.glassMaterialId);
            const index = indices.find((i: any) => i.id === val.glassIndexId);
            const selectedTraits = treatments.filter((t: any) => val.glassTreatmentIds?.includes(t.id));


            let name = 'Verre';
            let hasValidProperties = false;
            
            if (brand) {
                name += ` ${brand.name}`;
                hasValidProperties = true;
            }
            if (index) {
                name += ` ${index.label}`;
                hasValidProperties = true;
            }
            if (selectedTraits.length > 0) {
                name += ` (${selectedTraits.map((t: any) => t.name).join(', ')})`;
                hasValidProperties = true;
            }

            // CALCUL DU PRIX DE VENTE FIXE (Depuis la DB)
            let fixedSellingPrice = index?.price || 0;
            selectedTraits.forEach((t: any) => fixedSellingPrice += t.price || 0);

            // Ne pas écraser un 'nom' pré-rempli riche par un simple 'Verre' si on n'a rien matché
            if (!hasValidProperties && val.nom && val.nom !== 'Verre' && val.nom.trim().length > 5) {
                name = val.nom; // Keep the existing rich name
            }

            this.entryForm.patchValue({ 
                nom: name,
                marque: brand ? brand.name : val.marque, // Update marque explicitly if a brand is resolved
                prixVente: fixedSellingPrice > 0 ? fixedSellingPrice : val.prixVente,
                modePrix: 'FIXE', // Les verres utilisent des prix fixes configurés
                margeFixe: 0      // On réinitialise la marge manuelle pour les verres
            }, { emitEvent: false });
        });
    }

    forceAddProduct() {
        const val = this.entryForm.getRawValue();
        const designation = val.nom || val.reference || 'Produit';
        
        // Pass the prefill ID if any
        this.addProduct(this._pendingPrefillFicheId);
        
        // Confirmation feedback
        setTimeout(() => this.snackBar.open(`✅ ${designation} ajouté au panier`, 'OK', { duration: 3000 }));
    }

    setupDuplicateCheck() {
        this.documentForm.valueChanges.pipe(
            debounceTime(500),
            distinctUntilChanged((prev, curr) =>
                prev.fournisseurId === curr.fournisseurId && prev.numero === curr.numero
            ),
            switchMap(val => {
                const trimmedNumero = (val.numero || '').trim();
                if (val.fournisseurId && trimmedNumero && trimmedNumero.length > 2) {
                    return this.financeService.checkInvoiceExistence(val.fournisseurId, trimmedNumero);
                }
                return of(null);
            })
        ).subscribe(res => {
            if (res && res.exists) {
                this.duplicateInvoice = res.invoice;
                setTimeout(() => this.snackBar.open(`Attention: La facture ${this.duplicateInvoice.numeroFacture} existe déjà pour ce fournisseur.`, 'Compris', { duration: 10000 }));
            } else {
                this.duplicateInvoice = null;
            }
        });
    }

    private setupProductSearch() {
        // Search triggered by reference or codeBarre
        const searchInput$ = new BehaviorSubject<string>('');

        this.entryForm.get('reference')?.valueChanges.subscribe(v => searchInput$.next(v));
        this.entryForm.get('codeBarre')?.valueChanges.subscribe(v => searchInput$.next(v));

        searchInput$.pipe(
            debounceTime(500),
            distinctUntilChanged(),
            switchMap(query => {
                if (!query || query.length < 3) {
                    this.foundProduct = null;
                    return of([]);
                }
                this.isSearching = true;
                return this.productService.searchByBarcodeOrReference(query).pipe(
                    catchError(() => of([]))
                );
            })
        ).subscribe(results => {
            this.isSearching = false;
            if (results && results.length > 0) {
                this.foundProduct = results[0];
                setTimeout(() => this.snackBar.open(`Produit existant détecté : ${this.foundProduct.nom}`, 'OK', { duration: 2000 }));
                // We don't auto-patch to avoid overwriting user intent, 
                // but we store it in foundProduct for addProduct.
            } else {
                this.foundProduct = null;
            }
        });
    }

    calculateWAP(existingStock: number, existingPrice: number, newQty: number, newPrice: number): number {
        if (existingStock <= 0) return newPrice;
        const totalValue = (existingStock * existingPrice) + (newQty * newPrice);
        const totalQty = existingStock + newQty;
        return parseFloat((totalValue / totalQty).toFixed(2));
    }


    // --- Staging Logic ---

    openAlimentationDialog() {
        if (this.stagedProducts.length === 0) return;

        const dialogRef = this.dialog.open(StockAlimentationDialogComponent, {
            width: '98vw',
            maxWidth: '1500px',
            maxHeight: '95vh',
            data: {
                products: [...this.stagedProducts],
                document: this.documentForm.getRawValue(),
                skipPaymentPrompt: this.skipPaymentPrompt
            }
        });

        dialogRef.afterClosed().subscribe((result: any) => {
            if (result && result.success) {
                this.stagedProducts = [];
                this.dataSource.data = [];
                this.documentForm.reset({ type: 'FACTURE', date: new Date() });
            }
        });
    }

    // --- Staging Logic ---

    addProduct(prefillFicheId?: string | null) {
        if (this.entryForm.invalid) {
            console.error('⚠️ [StockEntryV2] Form invalid, cannot add product:', this.entryForm.errors);
            const missing = Object.keys(this.entryForm.controls).filter(k => this.entryForm.controls[k].invalid);
            console.log('📝 [StockEntryV2] Invalid fields:', missing);
            setTimeout(() => this.snackBar.open(`Champs obligatoires manquants : ${missing.join(', ')}`, 'Fermer', { duration: 5000 }));
            return;
        }

        console.log('📦 [StockEntryV2] Adding product to basket...', this.entryForm.getRawValue());


        const val = this.entryForm.getRawValue();
        const isVerre = val.categorie === 'VERRE';

        // Validation: Must have at least a reference OR a barcode (Bypassed for VERRE)
        if (!isVerre && !val.reference?.trim() && !val.codeBarre?.trim()) {
            setTimeout(() => this.snackBar.open('Veuillez saisir une référence ou un code-barres', 'OK', { duration: 3000 }));
            return;
        }

        // Backend fallback: if no reference, use codeBarre or name (for glasses) as reference
        let finalRef = val.reference?.trim() || val.codeBarre?.trim() || '';
        if (isVerre && !finalRef) {
            finalRef = val.nom || 'VERRE_PREFILL';
        }

        const globalWh = this.documentForm.get('entrepotId')?.value;

        const product: StagedProduct = {
            tempId: crypto.randomUUID(),
            id: this.foundProduct?.id,
            reference: finalRef,
            codeBarre: val.codeBarre,
            entrepotId: globalWh,
            _prefillFicheId: prefillFicheId || undefined,
            nomClient: this._pendingPrefillClientName || undefined,
            ...val
        };

        // Keep pending prefill if it was used, so user can add more items for same client
        // this._pendingPrefillFicheId = null; 
        // this._pendingPrefillClientName = null;

        // If existing product, attach stock info and calculate WAP preview
        if (this.foundProduct) {
            product.existingStock = this.foundProduct.stock;
            product.existingPrixAchat = this.foundProduct.prixAchatHT;
            product.suggestedWAP = this.calculateWAP(
                this.foundProduct.stock || 0,
                this.foundProduct.prixAchatHT || 0,
                val.quantite,
                val.prixAchat
            );
        }

        // [DEDUPLICATION] Check if product already exists in basket
        const productRef = (product.reference || '').trim().toLowerCase();
        const productCat = product.categorie;
        const productCB = (product.codeBarre || '').trim();
        const productFiche = product._prefillFicheId;

        const existingIndex = this.stagedProducts.findIndex(p => {
            const pRef = (p.reference || '').trim().toLowerCase();
            const pCB = (p.codeBarre || '').trim();
            return pRef === productRef && p.categorie === productCat && pCB === productCB && p._prefillFicheId === productFiche;
        });

        if (existingIndex !== -1) {
            console.log('🔄 [StockEntryV2] Product exists, merging...', product.reference);
            const updatedProducts = [...this.stagedProducts];
            const existing = { ...updatedProducts[existingIndex] };
            
            existing.quantite = Number(existing.quantite) + Number(product.quantite);
            existing.prixAchat = product.prixAchat;
            existing.prixVente = product.prixVente;
            existing.tva = product.tva;
            
            updatedProducts[existingIndex] = existing;
            this.stagedProducts = updatedProducts;
        } else {
            console.log('➕ [StockEntryV2] Adding new product to basket:', product.reference);
            this.stagedProducts = [...this.stagedProducts, product];
        }

        // Notify data source
        this.dataSource.data = this.stagedProducts;
        this.refreshStats();
        console.log(`✅ [StockEntryV2] Product added! Basket size: ${this.stagedProducts.length}`);
        this.scrollToBasket();

        this.entryForm.reset({
            categorie: 'MONTURE_OPTIQUE',
            nom: '',
            reference: '',
            marque: '',
            codeBarre: '',
            quantite: 1,
            prixAchat: 0,
            tva: 20,
            modePrix: 'FIXE',
            coefficient: 2.5,
            margeFixe: 0,
            prixVente: 0,
            glassBrandId: '',
            glassMaterialId: '',
            glassIndexId: '',
            glassTreatmentIds: []
        });

        this.foundProduct = null;
    }

    removeProduct(tempId: string) {
        this.stagedProducts = this.stagedProducts.filter(p => p.tempId !== tempId);
        this.dataSource.data = [...this.stagedProducts];
        this.refreshStats();
    }

    splitProduct(element: StagedProduct) {
        if (element.quantite <= 1) {
            setTimeout(() => this.snackBar.open('Quantité insuffisante pour scinder', 'OK', { duration: 2000 }));
            return;
        }

        // 1. Reduce original
        element.quantite = element.quantite - 1;

        // 2. Add clone with qty 1
        const clone: StagedProduct = {
            ...element,
            tempId: crypto.randomUUID(),
            quantite: 1
        };

        const index = this.stagedProducts.findIndex(p => p.tempId === element.tempId);
        this.stagedProducts.splice(index + 1, 0, clone);
        this.stagedProducts = [...this.stagedProducts];
        this.dataSource.data = [...this.stagedProducts];

        setTimeout(() => this.snackBar.open('Article scindé', 'OK', { duration: 2000 }));
    }

    updateProduct(element: StagedProduct) {
        // Recalculate based on mode
        if (element.modePrix === 'COEFF' && element.coefficient) {
            element.prixVente = parseFloat((element.prixAchat * element.coefficient).toFixed(2));
        } else if (element.modePrix === 'FIXE' && element.margeFixe !== undefined) {
            element.prixVente = parseFloat((Number(element.prixAchat) + Number(element.margeFixe)).toFixed(2));
        }

        // Notify data source
        this.dataSource.data = [...this.stagedProducts];
        this.refreshStats();
    }

    applyBatchPricing() {
        const batchValues = this.batchPricingForm.getRawValue();

        this.stagedProducts.forEach(product => {
            product.modePrix = batchValues.modePrix;

            if (batchValues.modePrix === 'COEFF') {
                product.coefficient = batchValues.coefficient;
                product.prixVente = parseFloat((product.prixAchat * batchValues.coefficient).toFixed(2));
            } else if (batchValues.modePrix === 'FIXE') {
                product.margeFixe = batchValues.margeFixe;
                product.prixVente = parseFloat((Number(product.prixAchat) + Number(batchValues.margeFixe)).toFixed(2));
            }

            // Apply TVA if selected in bulk actions
            if (batchValues.tva !== null && batchValues.tva !== undefined) {
                product.tva = Number(batchValues.tva);
            }

            // Apply Quantity if specified
            if (batchValues.quantite !== null && batchValues.quantite !== undefined && batchValues.quantite > 0) {
                product.quantite = Number(batchValues.quantite);
            }

            // Apply Warehouse if selected
            if (batchValues.entrepotId !== null && batchValues.entrepotId !== undefined) {
                product.entrepotId = batchValues.entrepotId;
            }

            // Apply Category if selected
            if (batchValues.categorie !== null && batchValues.categorie !== undefined) {
                product.categorie = batchValues.categorie;
            }
        });

        this.dataSource.data = [...this.stagedProducts];
        this.refreshStats();
        setTimeout(() => this.snackBar.open(`Paramètres appliqués à ${this.stagedProducts.length} article(s)`, 'OK', { duration: 2000 }));
    }
    // --- OCR Logic (Max Best Effort) ---

    // OCR Logic
    openHistory(product: any): void {
        this.dialog.open(StockMovementHistoryDialogComponent, {
            width: '90%',
            maxWidth: '1200px',
            data: { product }
        });
    }

    clearOcrData(): void {
        this.documentForm.patchValue({ file: null });
        this.detectedLines = [];
        this.showOcrData = false;
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.documentForm.patchValue({ file });
            this.processOCR(file);
        }
    }


    // --- Legacy OCR Helpers (Removed) ---

    // --- OCR Logic (Granular Split & Cleanup) ---
    // User Request: Migrate granular logic from ocr-invoice-import to here

    async processOCR(file: File) {
        this.ocrProcessing = true;
        this.ocrError = null;
        this.detectedLines = [];
        this.splitLines = [];

        try {
            const result = await this.ocrService.recognizeText(file, !this.useIntelligentOcr);

            if (result.error) {
                this.ocrError = result.error;
                this.ocrProcessing = false;
                setTimeout(() => {
                    this.snackBar.open(`⚠️ ${result.error}`, 'Utiliser OCR Local', { duration: 10000 })
                        .onAction().subscribe(() => {
                            this.useIntelligentOcr = false;
                            this.processOCR(file);
                        });
                });
                return;
            }

            this.analyzedText = result.text || '';
            this.rawOcrResult = result; // Store for debug view
            console.log(`📦 OCR: Data received from ${result.source || 'LOCAL (Tesseract)'}`, result);

            // Handle n8n array response wrapper
            const data = Array.isArray(result) ? result[0] : result;

            // Auto-fill header fields (Universal support - old and new field names)
            const invNum = data.numero_facture || data.invoiceNumber || data.facture?.numero;
            const invDate = data.date_facture || data.invoiceDate || data.facture?.date;
            const supplier = data.fournisseur || data.supplierName || data.fournisseur?.nom;
            const docType = data.type_document || data.documentType || '';

            if (invNum) {
                this.documentForm.patchValue({ numero: invNum });
                console.log('📋 OCR: Numéro pièce détecté:', invNum);
            }
            if (invDate) {
                this.documentForm.patchValue({ date: new Date(invDate) });
                console.log('📋 OCR: Date pièce détectée:', invDate);
            }

            // Auto-detect document type from OCR
            if (docType.toUpperCase().includes('LIVRAISON') || docType.toUpperCase().includes('BL') || this.analyzedText.toUpperCase().includes('BON DE LIVRAISON')) {
                this.documentForm.patchValue({ type: 'BL' });
                console.log('📋 OCR: Type détecté: Bon de Livraison');
            } else if (docType.toUpperCase().includes('FACTURE') || this.analyzedText.toUpperCase().includes('FACTURE')) {
                this.documentForm.patchValue({ type: 'FACTURE' });
                console.log('📋 OCR: Type détecté: Facture');
            }

            if (supplier) {
                console.log('📋 OCR: Fournisseur détecté:', supplier);
                const found = (this.suppliersList || []).find(s =>
                    s.nom.toLowerCase().includes(supplier.toLowerCase())
                );
                if (found) {
                    this.documentForm.patchValue({ fournisseurId: found.id });
                    console.log('✅ OCR: Fournisseur trouvé et sélectionné:', found.nom);
                } else {
                    console.warn('⚠️ OCR: Fournisseur non trouvé dans la liste:', supplier);
                }
            }

            // NEW: Ultra-flexible article detection (Search for any array of articles)
            const findArticles = (obj: any): any[] | null => {
                if (!obj || typeof obj !== 'object') return null;
                
                // If it's already an array of articles, return it
                if (Array.isArray(obj)) {
                    const looksLikeArticles = obj.length > 0 && typeof obj[0] === 'object' && (obj[0].reference || obj[0].designation || obj[0].marque || obj[0].description);
                    if (looksLikeArticles) return obj;
                }

                // Check common keys
                const commonKeys = ['articles', 'items', 'produits', 'lignes', 'rows', 'data'];
                for (const key of commonKeys) {
                    if (Array.isArray(obj[key])) {
                        const result = findArticles(obj[key]);
                        if (result) return result;
                    }
                }

                // Recursive search for ANY array of objects
                for (const key in obj) {
                    if (obj[key] && typeof obj[key] === 'object' && !commonKeys.includes(key)) {
                        const result = findArticles(obj[key]);
                        if (result) return result;
                    }
                }
                return null;
            };

            const items = findArticles(result); // Use raw result for multi-depth search

            // DEBUG AGRESSIF : Alerte si rien n'est trouvé
            if (!items || items.length === 0) {
                const rawJson = JSON.stringify(result).substring(0, 500);
                console.warn('❌ OCR: Aucun article trouvé dans le JSON reçu:', result);
                if (result.source === 'n8n') {
                    window.alert(`🚨 DEBUG OCR: n8n a répondu mais aucun article trouvé. \n\nRéponse brute (début): ${rawJson}`);
                }
            }

            if (items && items.length > 0) {
                console.log(`✨ OCR: ${items.length} articles detected via Intelligent search. Processing...`);
                this.isIntelligentOcr = true;
                this.addIntelligentArticles(items);
                this.showOcrData = false;
                setTimeout(() => this.snackBar.open(`✅ ${items.length} articles extraits par l'IA !`, 'OK', { duration: 5000 }));
                return;
            }

            this.isIntelligentOcr = false;

            // Extract lines and split into columns with GRANULAR logic (Legacy/Fallback)
            if (result.lines && result.lines.length > 0) {
                this.splitLines = result.lines.map((line: any) => {
                    const rawText = line.raw || line.description || '';
                    let columns: string[] = [];

                    // Default: Simple Space Splitting Strategy
                    columns = rawText.trim().split(/\s+/).filter((c: string) => c.trim());

                    // CLEANUP: Remove common OCR noise artifacts from EACH column
                    // Removes: ] ) } | from start and end
                    columns = columns.map(c => c.replace(/^[\]\)}|]+|[\]\)}|]+$/g, ''));

                    // Fallback
                    if (columns.length === 0) columns = [rawText];

                    return {
                        columns: columns,
                        originalLine: line,
                        raw: rawText
                    };
                });

                // Calculate max columns
                this.maxColumns = Math.max(...this.splitLines.map(l => l.columns.length));
                this.initializeDefaultMappings();
                this.showOcrData = true;
            }

            setTimeout(() => this.snackBar.open(`✅ Analyse terminée : ${this.splitLines.length} ligne(s) brute(s) détectée(s)`, 'OK', {
                duration: 3000
            }));

        } catch (err: any) {
            console.error('OCR Failed', err);
            this.ocrError = err.message || 'Erreur lors de l\'analyse OCR';
            this.snackBar.open('❌ Erreur OCR : ' + this.ocrError, 'Fermer');
        } finally {
            this.ocrProcessing = false;
        }
    }

    initializeDefaultMappings() {
        this.columnMappings = {};
        if (this.maxColumns >= 5) {
            this.columnMappings[0] = 'code';
            this.columnMappings[1] = 'marque';
            this.columnMappings[2] = 'reference';
            this.columnMappings[this.maxColumns - 1] = 'prixUnitaire';
            this.columnMappings[this.maxColumns - 2] = 'remise';
        } else {
            this.columnMappings[0] = 'code';
            this.columnMappings[1] = 'designation';
            if (this.maxColumns > 2) {
                this.columnMappings[this.maxColumns - 1] = 'prixUnitaire';
            }
        }
    }

    reSplit(strategy: 'spaces' | 'smart' | 'tabs') {
        if (!this.splitLines || this.splitLines.length === 0) return;

        console.log('Re-splitting with strategy:', strategy);
        this.splitLines = this.splitLines.map(line => {
            const rawText = line.raw;
            let columns: string[] = [];

            if (strategy === 'spaces') {
                columns = rawText.trim().split(/[\s\u00A0]+/).filter((c: string) => c.trim().length > 0);
            }
            else if (strategy === 'tabs') {
                columns = rawText.split('\t').map((c: string) => c.trim()).filter((c: string) => c);
            }
            else { // Smart (basic fallback)
                columns = rawText.split(/\s{3,}/).map((c: string) => c.trim()).filter((c: string) => c);
            }

            // CLEANUP noise
            columns = columns.map(c => c.replace(/^[\]\)}|]+|[\]\)}|]+$/g, ''));
            if (columns.length === 0) columns = [rawText];

            return { ...line, columns: columns };
        });

        this.maxColumns = Math.max(...this.splitLines.map(l => l.columns.length));
        this.initializeDefaultMappings();
        setTimeout(() => this.snackBar.open(`Redécoupage effectué : ${strategy}`, 'OK', { duration: 2000 }));
    }

    getColumnArray(): number[] {
        return Array.from({ length: this.maxColumns }, (_, i) => i);
    }

    removeLine(index: number) {
        this.splitLines.splice(index, 1);
    }

    trackByIndex(index: number, obj: any): any {
        return index;
    }

    // --- NEW BRIDGE: Apply Mapping -> Basket ---
    applyMappingsToBasket() {
        const newProducts: StagedProduct[] = [];
        const globalWh = this.documentForm.get('entrepotId')?.value;
        const defaultTva = this.entryForm.get('tva')?.value || 20;

        let addedCount = 0;

        this.splitLines.forEach(splitLine => {
            const mapped: any = {
                designation: '',
                quantity: 1,
                price: 0,
                code: '',
                reference: '',
                marque: '',
                remise: 0,
                categorie: ''
            };

            // 1. Extract values based on mapping
            splitLine.columns.forEach((col: string, index: number) => {
                const mapping = this.columnMappings[index];
                if (!mapping || mapping === 'ignore') return;

                switch (mapping) {
                    case 'code': mapped.code = col; break;
                    case 'marque': mapped.marque = col; break;
                    case 'categorie': mapped.categorie = col; break;
                    case 'reference': mapped.reference = col; break;
                    case 'designation': mapped.designation = (mapped.designation ? mapped.designation + ' ' : '') + col; break;
                    case 'quantity':
                        mapped.quantity = parseFloat(col.replace(/[^\d.,]/g, '').replace(',', '.')) || 1;
                        break;
                    case 'prixUnitaire':
                        mapped.price = parseFloat(col.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
                        break;
                    case 'remise':
                        // Allow % for discount
                        mapped.remise = parseFloat(col.replace(/[^\d.,%]/g, '').replace(',', '.')) || 0;
                        break;
                    case 'prixRemise':
                        mapped.prixRemise = parseFloat(col.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
                        break;
                }
            });

            // 2. Strict Designation Construction (User Request)
            const parts: string[] = [];
            if (mapped.marque && mapped.marque.trim()) parts.push(mapped.marque.trim());
            if (mapped.reference && mapped.reference.trim()) parts.push(mapped.reference.trim());

            if (parts.length > 0) {
                mapped.designation = parts.join(' ');
            } else {
                // Only fallback if no structural info at all
                if (!mapped.designation) mapped.designation = splitLine.raw;
            }

            // 3. Create Staged Product
            // Auto-detect category or use mapped category
            const categorie = this.resolveCategory(mapped.categorie, mapped.designation || '');

            // Calculate final cost if discount exists
            let finalCost = mapped.price;
            if (mapped.remise > 0) {
                // heuristic: if remise > 1, assume percent ? Usually in invoices it is percent.
                // If it is small (0.x), maybe it is coef? Let's assume % for now as per label.
                finalCost = finalCost * (1 - (mapped.remise / 100));
            }

            const product: StagedProduct = {
                tempId: crypto.randomUUID(),
                reference: mapped.reference || 'SANS-REF',
                codeBarre: mapped.code,
                nom: mapped.designation,
                marque: mapped.marque || 'Sans Marque',
                categorie: categorie,
                entrepotId: globalWh,
                quantite: mapped.quantity,
                prixAchat: parseFloat(finalCost.toFixed(2)),
                tva: defaultTva,
                modePrix: 'COEFF',
                coefficient: 2.5,
                margeFixe: 0,
                prixVente: parseFloat((finalCost * 2.5).toFixed(2))
            };

            newProducts.push(product);
            addedCount++;
        });

        // Add to basket with deduplication
        newProducts.forEach(product => {
            const existingIndex = this.stagedProducts.findIndex(p => 
                (p.reference || '').trim().toLowerCase() === (product.reference || '').trim().toLowerCase() && 
                p.categorie === product.categorie &&
                ((p.codeBarre || '').trim() === (product.codeBarre || '').trim()) &&
                p._prefillFicheId === product._prefillFicheId
            );

            if (existingIndex !== -1) {
                const existing = this.stagedProducts[existingIndex];
                existing.quantite += product.quantite;
                existing.prixAchat = product.prixAchat;
                existing.prixVente = product.prixVente;
            } else {
                this.stagedProducts.push(product);
            }
        });

        this.stagedProducts = [...this.stagedProducts]; // Trigger change detection
        this.dataSource.data = [...this.stagedProducts];
        this.scrollToBasket();

        // Close OCR panel or clear it?
        // Let's keep it visible or hide it? User might want to re-scan.
        // Let's clear splitLines to indicate "Done"
        this.detectedLines = []; // Clear old compat
        this.splitLines = [];
        this.showOcrData = false;

        setTimeout(() => this.snackBar.open(`${addedCount} articles ajoutés au panier !`, 'OK', { duration: 3000 }));
    }

    createAndSelectSupplier(name: string) {
        // Basic cleanup of name (remove headers triggers if captured)
        // Also remove trailing punctuation often captured (e.g. ;)
        // Filter out known sponsors that might appear on the same line (Context specific fix)
        let cleanName = name.replace(/^(STE|SOCIETE)\s+/i, '')
            .replace(/[;:,.]+$/, '')
            .trim();

        // Heuristic: If name contains "CHARMANT", "SEIKO", etc (sponsors), split and take first part
        // Example: "DK DISTRIBUTION CHARMANT" -> "DK DISTRIBUTION"
        const sponsors = ['CHARMANT', 'SEIKO', 'IKKS', 'ESPRIT', 'ELLE', 'MINAMOTO', 'FESTINA'];
        const sponsorRegex = new RegExp(`\\s+(${sponsors.join('|')})[\\s\\S]*`, 'i');
        cleanName = cleanName.replace(sponsorRegex, '').trim();

        setTimeout(() => this.snackBar.open(`Création automatique du fournisseur : ${cleanName}...`, 'Patientez', { duration: 2000 }));

        // Create with just the name as requested, avoiding validation errors on empty email
        this.financeService.createSupplier({ nom: cleanName }).subscribe({
            next: (newSupplier: any) => {
                console.log('[OCR] New supplier created:', newSupplier);
                // 1. Add to local list so it's found next time
                this.suppliersList.push(newSupplier);

                // 2. Select it
                this.documentForm.patchValue({ fournisseurId: newSupplier.id });
                setTimeout(() => this.snackBar.open(`Fournisseur créé et sélectionné : ${newSupplier.nom}`, 'OK', { duration: 3000 }));
            },
            error: (err) => {
                console.error('[OCR] Failed to create supplier:', err);
                setTimeout(() => this.snackBar.open(`Erreur lors de la création du fournisseur ${cleanName}`, 'Fermer'));
            }
        });
    }

    // --- CAMERA / IA BRIDGE ---

    addIntelligentArticles(articles: any[]) {
        if (!articles || !Array.isArray(articles)) {
            console.error('❌ addIntelligentArticles: Input is not an array', articles);
            return;
        }

        console.log('✨ addIntelligentArticles: Processing', articles.length, 'items');
        const newProducts: StagedProduct[] = [];
        const globalWh = this.documentForm.get('entrepotId')?.value;
        const defaultTva = this.entryForm.get('tva')?.value || 20;

        articles.forEach((art, index) => {
            if (!art || typeof art !== 'object') return;

            // Permissive mapping
            let ref = art.reference || art.ref || art.model || art.modele || art.code || 'SANS-REF';
            let marque = art.marque || art.brand || art.fabricant || 'Sans Marque';
            let des = art.designation || art.nom || art.name || art.description || '';
            let qte = parseFloat(art.quantite || art.qte || art.quantity || 1) || 1;
            
            // Reconstruct designation if empty or short
            if (!des || des.length < 5) {
                des = `${marque} ${ref}`.trim();
            }
            if (!des || des === 'Sans Marque SANS-REF') {
                des = art.designation_brute || 'Article ' + (index + 1);
            }

            let pu = art.prix_unitaire || art.prix_achat || art.price || art.pu || 0;
            // Robust Parsing
            if (typeof pu === 'string') {
                pu = parseFloat(pu.replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0;
            } else {
                pu = Number(pu) || 0;
            }

            console.log(`💰 OCR DEBUG: Ref=${ref}, RawPrice=${art.prix_unitaire}, Parsed=${pu}`);

            // Robust Remise Parsing
            let discount = art.remise;
            if (typeof discount === 'string') {
                discount = parseFloat(discount.replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0;
            } else {
                discount = Number(discount) || 0;
            }

            // Calculate final cost if discount exists
            let finalCost = pu;
            if (discount > 0) {
                finalCost = pu * (1 - (discount / 100));
            }

            // Detect category
            const categorie = this.resolveCategory(art.categorie || art.type, des);

            const product: StagedProduct = {
                tempId: crypto.randomUUID(),
                reference: ref,
                codeBarre: art.code || art.code_barre || '',
                nom: des,
                marque: marque,
                categorie: categorie,
                entrepotId: globalWh,
                quantite: qte,
                prixAchat: parseFloat(finalCost.toFixed(2)),
                tva: defaultTva,
                modePrix: 'COEFF',
                coefficient: 2.5,
                margeFixe: 0,
                prixVente: parseFloat((finalCost * 2.5).toFixed(2)),
                couleur: art.couleur,
                calibre: art.calibre?.toString(),
                pont: art.pont?.toString(),
                materiau: art.materiau,
                forme: art.forme,
                genre: art.genre
            };

            newProducts.push(product);
        });

        this.stagedProducts = [...this.stagedProducts, ...newProducts];
        this.dataSource.data = [...this.stagedProducts];
        setTimeout(() => this.snackBar.open(`✅ ${newProducts.length} articles extraits par l'IA !`, 'OK', { duration: 5000 }));
    }

    private resolveCategory(inputCategory: string | undefined, designation: string): string {
        if (!inputCategory) return this.determineCategory(designation);

        const cat = inputCategory.toUpperCase();
        if (cat.includes('SOLAIRE') || cat.includes('SUN')) return 'MONTURE_SOLAIRE';
        if (cat.includes('OPTIQUE') || cat.includes('FRAME') || cat.includes('VUE') || cat.includes('LUNETTE') || cat.includes('MONTURE')) return 'MONTURE_OPTIQUE';
        if (cat.includes('LENT') || cat.includes('LENS')) return 'LENTILLE';
        if (cat.includes('VERRE') || cat.includes('GLASS')) return 'VERRE';
        if (cat.includes('ACCESSOIRE')) return 'ACCESSOIRE';

        return this.determineCategory(designation);
    }

    private determineCategory(text: string): string {
        const lower = text.toLowerCase();
        if (lower.includes('lent') || lower.includes('lens')) return 'LENTILLE';
        if (lower.includes('sol') || lower.includes('sun') || lower.includes('solaire')) return 'MONTURE_SOLAIRE';
        if (lower.includes('verre')) return 'VERRE';
        if (lower.includes('optique') || lower.includes('frame')) return 'MONTURE_OPTIQUE';
        return 'MONTURE_OPTIQUE'; // Default
    }

    openCamera() {
        const dialogRef = this.dialog.open(CameraCaptureDialogComponent, {
            width: '800px',
            maxWidth: '95vw',
            data: { title: 'Scanner le Document' }
        });

        dialogRef.afterClosed().subscribe((result: Blob | File) => {
            if (result) {
                // Determine file
                let file: File;
                if (result instanceof File) {
                    file = result;
                } else {
                    // Blob to File
                    file = new File([result], `scan_${new Date().getTime()}.jpg`, { type: 'image/jpeg' });
                }

                // Update Form
                this.documentForm.patchValue({ file: file });
                setTimeout(() => this.snackBar.open('Document scanné avec succès', 'OK', { duration: 2000 }));

                // Trigger OCR
                this.processOCR(file);
            }
        });
    }


    viewDocument() {
        const file = this.documentForm.get('file')?.value;
        if (file) {
            const url = URL.createObjectURL(file);
            window.open(url, '_blank');
            // Suggestion: Revoke object URL after some time or on destroy to prevent leaks,
            // though window.open might need it for a bit.
        }
    }





    // --- LIVE EDIT & RE-ANALYSIS ---

    onDescriptionChange(element: StagedProduct) {
        // Concatenate Ref + Designation for broader search
        const textToScan = `${element.reference || ''} ${element.nom || ''}`;

        console.log(`✨ Live Re-analysis for: ${textToScan}`);

        // 1. RPM (Calibre / Pont) Regex - e.g. "54 18", "54-18", "54[]18"
        // Avoid prices (e.g. .80) by checking bounds: Calibre (40-66), Pont (14-24)
        const rpmRegex = /(?:^|\s|\.|-)(4[0-9]|5[0-9]|6[0-6])[\s\-\[\]xX\*\/]{1,3}(1[4-9]|2[0-4])(?:\s|$|\.)/;
        const match = textToScan.match(rpmRegex);

        if (match) {
            // Apply only if missing or if user explicitly wants overwrite (here we fill if empty)
            if (!element.calibre) {
                element.calibre = match[1];
                console.log(`   -> Recovered Calibre: ${match[1]}`);
            }
            if (!element.pont) {
                element.pont = match[2];
                console.log(`   -> Recovered Pont: ${match[2]}`);
            }
        }

        // 2. Color Detection (Simple List)
        if (!element.couleur) {
            const colors = ['NOIR', 'BLACK', 'OR', 'GOLD', 'ARGENT', 'SILVER', 'ECAILLE', 'HAVANA', 'BLEU', 'BLUE', 'ROUGE', 'RED', 'ROSE', 'PINK', 'VERT', 'GREEN', 'GRIS', 'GREY', 'MARRON', 'BROWN', 'VIOLET', 'PURPLE', 'BEIGE', 'NUDE', 'BLANC', 'WHITE', 'TRANSPARENT', 'CRYSTAL'];
            const foundColor = colors.find(c => textToScan.toUpperCase().includes(c));
            if (foundColor) {
                element.couleur = foundColor;
                console.log(`   -> Recovered Color: ${foundColor}`);
            }
        }

        this.updateProduct(element);
    }

    // --- BULK OPERATIONS LOGIC ---

    searchBulkProducts(): void {
        this.loadingBulk = true;
        const filters: ProductFilters = {
            reference: this.bulkReference?.trim() || undefined,
            codeBarres: this.bulkBarcode?.trim() || undefined,
            marque: this.bulkMarque?.trim() || undefined,
            typeArticle: this.bulkType,
            entrepotId: this.bulkEntrepotId
        };

        this.productService.findAll(filters).pipe(
            tap(products => {
                this.bulkProducts$.next(products);
                this.loadingBulk = false;
                this.bulkSelection.clear();
            }),
            catchError(err => {
                console.error('Error fetching bulk products:', err);
                this.bulkProducts$.next([]);
                this.loadingBulk = false;
                return of([]);
            })
        ).subscribe();
    }

    refreshStats(): void {
        const center = this.currentCentre();
        const centerId = center ? center.id : undefined;
        this.productService.getStockStatistics(centerId).subscribe((stats: StockStats) => {
            this.stats$.next(stats);
        });
    }

    resetBulkFilters(): void {
        this.bulkReference = '';
        this.bulkBarcode = '';
        this.bulkMarque = '';
        this.bulkType = undefined;
        this.bulkEntrepotId = undefined;
        this.searchBulkProducts();
    }

    isAllBulkSelected() {
        const numSelected = this.bulkSelection.selected.length;
        const numRows = this.bulkProducts$.value.length;
        return numSelected === numRows && numRows > 0;
    }

    masterBulkToggle() {
        if (this.isAllBulkSelected()) {
            this.bulkSelection.clear();
        } else {
            this.bulkProducts$.value.forEach(row => this.bulkSelection.select(row));
        }
    }

    openBulkStockOut() {
        if (this.bulkSelection.isEmpty()) return;

        const dialogRef = this.dialog.open(BulkStockOutDialogComponent, {
            width: '1200px',
            maxWidth: '95vw',
            data: { products: this.bulkSelection.selected }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.bulkSelection.clear();
                this.searchBulkProducts();
            }
        });
    }

    openBulkTransfer() {
        if (this.bulkSelection.isEmpty()) return;

        const dialogRef = this.dialog.open(BulkStockTransferDialogComponent, {
            width: '1200px',
            maxWidth: '95vw',
            data: { products: this.bulkSelection.selected }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.bulkSelection.clear();
                this.searchBulkProducts();
            }
        });
    }

    async finalizeAlimentation() {
        if (this.submitting) return;

        if (this.duplicateInvoice) {
            setTimeout(() => this.snackBar.open('Opération impossible : Cette facture existe déjà pour ce fournisseur.', 'Compris', { duration: 5000 }));
            return;
        }

        if (this.documentForm.invalid || this.stagedProducts.length === 0) {
            setTimeout(() => this.snackBar.open('Veuillez compléter les informations du document et ajouter des produits', 'OK', { duration: 3000 }));
            return;
        }

        const allAllocations: any[] = [];
        const doc = this.documentForm.getRawValue();
        const centreId = doc.centreId || this.currentCentre()?.id;

        this.stagedProducts.forEach(p => {
            allAllocations.push({
                productId: p.id,
                reference: p.reference,
                codeBarre: p.codeBarre,
                nom: p.nom.split(']')[0].split('1040')[0].trim(),
                marque: p.marque,
                categorie: p.categorie,
                warehouseId: p.entrepotId || centreId, // Use item warehouse or fallback to global/center
                quantite: Number(p.quantite),
                prixAchat: Number(p.prixAchat),
                prixVente: Number(p.prixVente),
                tva: Number(p.tva),
                materiau: p.materiau,
                forme: p.forme,
                genre: p.genre,
                couleur: p.couleur,
                calibre: p.calibre,
                pont: p.pont,
                ficheId: p._prefillFicheId // Send the specific ficheId for this product
            });
        });

        // Note: Warehouse and Date are now optional according to user request.
        // If date is null, we can default to now or leave as null if backend allows.

        // Handle File Attachment
        let base64File: string | undefined;
        let fileName: string | undefined;
        if (doc.file) {
            base64File = await this.fileToBase64(doc.file);
            fileName = doc.file.name;
        }

        const rawDate = doc.date || new Date();
        const utcDate = new Date(Date.UTC(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate()));
        const trimmedNumero = (doc.numero || '').trim();

        const payload: BulkAlimentationPayload = {
            numeroFacture: trimmedNumero || `ENTREE_${Date.now()}`,
            dateEmission: utcDate.toISOString(),
            type: doc.type,
            fournisseurId: doc.fournisseurId,
            centreId: centreId,
            base64File: base64File,
            fileName: fileName,
            ficheId: doc.ficheId, // Inclus l'ID de la fiche pour la sortie auto
            userId: this.currentUser() || undefined, // Send the current user ID
            allocations: allAllocations
        };

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const totalTTC = allAllocations.reduce((sum, a) => {
            const tvaAmount = Number(a.prixAchat) * (Number(a.tva) / 100);
            return sum + ((Number(a.prixAchat) + tvaAmount) * Number(a.quantite));
        }, 0);

        this.financeService.getSupplier(payload.fournisseurId).pipe(
            switchMap(supplier => {
                let monthlyPaymentAmount = 0;
                if (rawDate.getMonth() === currentMonth && rawDate.getFullYear() === currentYear) {
                    monthlyPaymentAmount = this.calculateFirstInstallment(supplier, totalTTC);
                }

                return this.financeService.getTreasurySummary(currentYear, currentMonth + 1, centreId).pipe(
                    switchMap(summary => {
                        const threshold = summary?.monthlyThreshold || 50000;
                        const totalWithEntry = (summary?.totalExpenses || 0) + monthlyPaymentAmount;

                        if (totalWithEntry > threshold && monthlyPaymentAmount > 0) {
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
                );
            }),
            finalize(() => this.ocrProcessing = false)
        ).subscribe((result: any) => {
            if (!result || result.action === 'CANCEL') return;

            if (result.action === 'RESCHEDULE' && result.date) {
                const targetDateStr = result.date.toISOString();
                payload.dateEmission = targetDateStr;
                payload.dateEcheance = targetDateStr;
            }

            this.saveEntry(payload);
        });
    }

    private calculateFirstInstallment(supplier: any, totalTTC: number): number {
        const echeanceArray = supplier.convention?.echeancePaiement || [];
        const conditions = (echeanceArray[0] || supplier.conditionsPaiement2 || supplier.conditionsPaiement || '').toLowerCase();

        if (conditions.includes('60 jours')) return totalTTC / 2;
        if (conditions.includes('90 jours')) return totalTTC / 3;
        if (conditions.includes('30 jours')) return 0;
        if (conditions.match(/r[eé]partie?\s*sur\s*(\d+)\s*mois/)) {
            const match = conditions.match(/r[eé]partie?\s*sur\s*(\d+)\s*mois/);
            const months = parseInt(match![1], 10);
            return totalTTC / months;
        }
        return totalTTC;
    }

    private saveEntry(payload: BulkAlimentationPayload) {
        this.submitting = true;
        this.stockService.bulkAlimentation(payload).pipe(
            finalize(() => this.submitting = false)
        ).subscribe({
            next: (res: any) => {
                setTimeout(() => this.snackBar.open('Stock alimenté avec succès !', 'OK', { duration: 3000 }));

                const completePayment = confirm('Stock alimenté. Souhaitez-vous maintenant compléter les modalités de paiement pour cette facture ?');
                if (completePayment && res && res.id) {
                    const invoiceDialog = this.dialog.open(InvoiceFormDialogComponent, {
                        width: '1200px',
                        maxWidth: '95vw',
                        data: { invoice: res }
                    });
                    invoiceDialog.afterClosed().subscribe(() => this.resetAfterSave());
                } else {
                    this.resetAfterSave();
                }
            },
            error: (err) => {
                const msg = err.error?.message || 'Erreur lors de l\'enregistrement';
                setTimeout(() => this.snackBar.open(msg, 'OK', { duration: 5000 }));
            }
        });
    }

    resetAll() {
        if (confirm('Voulez-vous vraiment réinitialiser tout le formulaire et vider le panier ?')) {
            this.resetAfterSave();
            setTimeout(() => this.snackBar.open('Formulaire réinitialisé', 'OK', { duration: 3000 }));
        }
    }

    clearDocument() {

        if (confirm('Voulez-vous vraiment vider tout le panier ?')) {
            this.resetAfterSave();
        }
    }

    private resetAfterSave() {
        this.stagedProducts = [];
        this.dataSource.data = [];
        this.entryForm.reset({
            categorie: 'MONTURE_OPTIQUE',
            nom: '',
            reference: '',
            marque: '',
            codeBarre: '',
            quantite: 1,
            prixAchat: 0,
            tva: 20,
            modePrix: 'FIXE',
            coefficient: 2.5,
            margeFixe: 0,
            prixVente: 0,
            glassBrandId: '',
            glassMaterialId: '',
            glassIndexId: '',
            glassTreatmentIds: []
        });
        this.documentForm.reset({ type: 'FACTURE', date: new Date(), centreId: this.currentCentre()?.id });
        this.clientSearchCtrl.setValue('');
        this.ficheSearchCtrl.setValue('');
        this._pendingPrefillFicheId = null;
        this.refreshStats();
    }

    private fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    }

    formatTypeLabel(type: string | undefined): string {
        if (!type) return '';
        switch (type) {
            case 'MONTURE_OPTIQUE': return 'Optique';
            case 'MONTURE_SOLAIRE': return 'Solaire';
            case 'VERRE': return 'Verre';
            case 'LENTILLE': return 'Lentille';
            case 'ACCESSOIRE': return 'Accessoire';
            default:
                return type.split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
        }
    }

    parseInputPrice(value: any): number {
        if (!value) return 0;
        // Replace comma with dot and remove spaces
        const cleaned = value.toString().replace(/\s/g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
    }

    private scrollToBasket() {
        setTimeout(() => {
            const basketElement = document.querySelector('.basket-summary');
            if (basketElement) {
                basketElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300);
    }
}
