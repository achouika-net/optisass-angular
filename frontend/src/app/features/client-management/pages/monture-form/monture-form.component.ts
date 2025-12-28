import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, of, BehaviorSubject, firstValueFrom } from 'rxjs';
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
import { MatSnackBar } from '@angular/material/snack-bar';
import { ClientManagementService } from '../../services/client.service';
import { Client, isClientParticulier, isClientProfessionnel } from '../../models/client.model';
import { FicheService } from '../../services/fiche.service';
import { FicheMontureCreate, TypeFiche, StatutFiche, TypeEquipement, SuggestionIA } from '../../models/fiche-client.model';
import { FactureService, Facture } from '../../services/facture.service';
import { FactureFormComponent } from '../facture-form/facture-form.component';
import { PaymentListComponent } from '../../components/payment-list/payment-list.component';
import { map, switchMap, tap, catchError, take, takeUntil } from 'rxjs/operators';
import { getLensSuggestion, Correction, FrameData, calculateLensPrice, determineLensType } from '../../utils/lensLogic';
import { getLensMaterials, getLensIndices } from '../../utils/lensDatabase';
import { StockSearchDialogComponent } from '../../../stock-management/dialogs/stock-search-dialog/stock-search-dialog.component';
import { ProductService } from '../../../stock-management/services/product.service';
import { Product, ProductStatus } from '../../../../shared/interfaces/product.interface';
import { forkJoin, timer, Subject } from 'rxjs';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';

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
        RouterModule,
        FactureFormComponent,
        PaymentListComponent
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
    activeTab = 0;
    loading = false;
    isEditMode = false;

    readonly TypeEquipement = TypeEquipement;

    // Contrôle indépendant pour la sélection du type d'équipement (ajout dynamique)
    selectedEquipmentType = new FormControl<TypeEquipement | null>(null);

    // Enums pour les dropdowns
    typesEquipement = Object.values(TypeEquipement);

    // Master Lists (From Database)
    lensMaterials: string[] = getLensMaterials();

    dateToday = new Date();

    get minDate(): Date {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }

    isTabAccessible(index: number): boolean {
        if (index <= 1) return true;

        // Requirements for moving past tab 1 (Montures et Verres)
        // 1. Must be saved in database
        if (!this.ficheId || this.ficheId === 'new') return false;

        // 2. Must have valid delivery date
        const dateVal = this.ficheForm.get('dateLivraisonEstimee')?.value;
        if (!dateVal) return false;

        const selectedDate = new Date(dateVal);
        selectedDate.setHours(0, 0, 0, 0);
        if (selectedDate < this.minDate) return false;

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
    private linkedFactureSubject = new BehaviorSubject<Facture | null>(null);
    linkedFacture$ = this.linkedFactureSubject.asObservable();

    private destroy$ = new Subject<void>();

    get isSaleEnInstance(): boolean {
        return this.linkedFactureSubject.value?.statut === 'VENTE_EN_INSTANCE';
    }
    receptionComplete = false;
    isReserved = false;
    isTransit = false;
    currentFiche: any = null; // Store loaded fiche for template/checks
    initialLines: any[] = [];
    initialProductStatus: string | null = null; // Track initial status: 'RUPTURE' or 'DISPONIBLE'

    nomenclatureString: string | null = null;
    showFacture = false;

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
        private store: Store
    ) {
        this.ficheForm = this.initForm();
    }

    ngOnInit(): void {
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
        this.route.paramMap.subscribe(params => {
            this.clientId = params.get('clientId');
            this.ficheId = params.get('ficheId');

            if (this.clientId) {
                this.clientService.getClient(this.clientId).subscribe(client => {
                    this.client = client;
                    this.cdr.markForCheck();
                });
            }

            if (this.ficheId && this.ficheId !== 'new') {
                // VIEW MODE: Existing Fiche
                this.isEditMode = false;
                this.ficheForm.disable(); // Disable form in view mode
                this.loadFiche();

                // Load linked facture via Service
                this.loadLinkedFacture();
            } else {
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
        this.linkedFacture$.subscribe(facture => {
            if (facture?.statut === 'VENTE_EN_INSTANCE' && this.currentFiche) {
                console.log('🔄 [RECEPTION] Reactive trigger (Invoice changed or loaded)');
                this.checkReceptionForInstance(this.currentFiche);
            }
        });

        // POLLING: Check reception status every 5 seconds if waiting
        timer(5000, 5000).pipe(
            takeUntil(this.destroy$)
        ).subscribe(() => {
            if ((this.isReserved || this.isTransit) && !this.receptionComplete && this.currentFiche) {
                console.log('🔄 [POLLING] Checking reception status...');
                this.checkReceptionForInstance(this.currentFiche);
            }
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    // New: Check if products in an INSTANCE sale are now received OR if transfer was cancelled
    checkReceptionForInstance(fiche: any): void {
        console.log('🔍 [RECEPTION] Checking reception status for fiche...');
        const isInstance = (this.linkedFactureSubject.value?.statut === 'VENTE_EN_INSTANCE');
        console.log('📋 [RECEPTION] Is instance?', isInstance, '| Invoice status:', this.linkedFactureSubject.value?.statut);

        if (!isInstance) return;

        // Reset flags before fresh check
        this.receptionComplete = false;
        this.isReserved = false;
        this.isTransit = false;

        // NEW: Track exactly WHICH field each product ID belongs to
        const mappings: { path: string, originalId: string }[] = [];

        if (fiche.monture?.productId) {
            mappings.push({ path: 'monture', originalId: fiche.monture.productId });
        }

        if (fiche.verres?.differentODOG) {
            if (fiche.verres.productIdOD) mappings.push({ path: 'verres.od', originalId: fiche.verres.productIdOD });
            if (fiche.verres.productIdOG) mappings.push({ path: 'verres.og', originalId: fiche.verres.productIdOG });
        } else if (fiche.verres?.productId) {
            mappings.push({ path: 'verres.both', originalId: fiche.verres.productId });
        }

        if (mappings.length === 0) {
            console.log('⚠️ [RECEPTION] No products found in fiche.');
            if (isInstance) {
                console.log('✅ [RECEPTION] Instance sale with no products. Marking as ready for validation.');
                this.receptionComplete = true;
                this.cdr.markForCheck();
            }
            return;
        }

        console.log('📦 [RECEPTION] Products to initial check:', mappings);

        // Fetch all products AND current center ID
        this.store.select(UserCurrentCentreSelector).pipe(take(1)).subscribe(currentCentre => {
            const currentCentreId = currentCentre?.id;
            console.log('🏢 [RECEPTION] Current Center ID:', currentCentreId);

            const checks = mappings.map(m => this.productService.findOne(m.originalId).pipe(
                map(p => ({ ...p, mappingPath: m.path })),
                catchError(err => {
                    console.error(`❌ [RECEPTION] Error fetching product ${m.originalId}:`, err);
                    return of(null);
                })
            ));

            forkJoin(checks).subscribe((productsWithMetadata: any[]) => {
                const products = productsWithMetadata.filter(p => !!p);

                console.log('📊 [RECEPTION] Current product details (remote or local):', products.map(p => ({
                    path: p.mappingPath,
                    id: p.id,
                    ref: p.modele || p.referenceFournisseur,
                    centerId: p.entrepot?.centreId,
                    statut: p.statut,
                    stock: p.quantiteActuelle,
                    pendingStatus: p.specificData?.pendingIncoming?.status
                })));

                // Store initial status if not already set (first time checking)
                if (!this.initialProductStatus && products.length > 0) {
                    this.initialProductStatus = products[0].quantiteActuelle <= 0 ? 'RUPTURE' : 'DISPONIBLE';
                    console.log('💾 [RECEPTION] Stored initial product status:', this.initialProductStatus);
                }

                // A product is ONLY received if it is IN the current center's PRINCIPAL warehouse
                // and has status DISPONIBLE with no pending incoming status.
                const allReceivedLocally = products.every(p =>
                    p.statut === ProductStatus.DISPONIBLE &&
                    !p.specificData?.pendingIncoming &&
                    p.quantiteActuelle > 0 &&
                    p.entrepot?.centreId === currentCentreId
                );

                console.log('✅ [RECEPTION] All products received locally?', allReceivedLocally);

                if (allReceivedLocally) {
                    this.receptionComplete = true;
                    this.isReserved = false;
                    this.isTransit = false;

                    // PIVOT: Map each product to its local equivalent (already mostly handled by allReceivedLocally but ensure sync)
                    console.log('🔍 [RECEPTION] Synchronizing local stock IDs by factory reference...');

                    const localMappingChecks = products.map(p => {
                        const reference = p.modele || p.referenceFournisseur || p.designation;
                        const couleur = p.couleur || '';

                        if (!reference) {
                            console.warn(`⚠️ [RECEPTION] No reference found for ${p.mappingPath}. Using existing ID.`);
                            return of({ ...p, localProduct: p });
                        }

                        console.log(`🔍 [RECEPTION] Searching local match for "${reference}"...`);
                        return this.productService.findAll({ search: reference }).pipe(
                            map(results => {
                                const localMatch = results.find(r =>
                                    r.entrepot?.centreId === currentCentreId &&
                                    r.entrepot?.type === 'PRINCIPAL' &&
                                    (r.modele === reference || r.referenceFournisseur === reference || r.designation === reference) &&
                                    (r.couleur === couleur || !couleur)
                                ) || p;

                                if (localMatch.id !== p.id) {
                                    console.log(`📍 [RECEPTION] Mapped ${p.mappingPath}: ${p.id} -> ${localMatch.id} (Match found in ${localMatch.entrepot?.nom})`);
                                }
                                return { ...p, localProduct: localMatch };
                            }),
                            catchError(err => {
                                console.error(`❌ [RECEPTION] Error searching for ${reference}:`, err);
                                return of({ ...p, localProduct: p });
                            })
                        );
                    });

                    forkJoin(localMappingChecks).subscribe((mappedResults: any[]) => {
                        let changed = false;
                        const formValue = this.ficheForm.getRawValue();

                        mappedResults.forEach(res => {
                            const localP = res.localProduct;
                            const path = res.mappingPath;

                            if (path === 'monture') {
                                if (formValue.monture?.productId !== localP.id || formValue.monture?.isPendingTransfer) {
                                    this.ficheForm.get('monture')?.patchValue({
                                        productId: localP.id,
                                        entrepotType: 'PRINCIPAL',
                                        isPendingTransfer: false
                                    });
                                    changed = true;
                                }
                            } else if (path === 'verres.od') {
                                if (formValue.verres?.productIdOD !== localP.id || formValue.verres?.isPendingTransfer) {
                                    this.ficheForm.get('verres')?.patchValue({
                                        productIdOD: localP.id,
                                        entrepotType: 'PRINCIPAL',
                                        isPendingTransfer: false
                                    });
                                    changed = true;
                                }
                            } else if (path === 'verres.og') {
                                if (formValue.verres?.productIdOG !== localP.id || formValue.verres?.isPendingTransfer) {
                                    this.ficheForm.get('verres')?.patchValue({
                                        productIdOG: localP.id,
                                        entrepotType: 'PRINCIPAL',
                                        isPendingTransfer: false
                                    });
                                    changed = true;
                                }
                            } else if (path === 'verres.both') {
                                if (formValue.verres?.productId !== localP.id || formValue.verres?.isPendingTransfer) {
                                    this.ficheForm.get('verres')?.patchValue({
                                        productId: localP.id,
                                        entrepotType: 'PRINCIPAL',
                                        isPendingTransfer: false
                                    });
                                    changed = true;
                                }
                            }
                        });

                        if (changed) {
                            console.log('💾 [RECEPTION] Differences detected. Auto-saving synced local IDs...');
                            this.saveFicheSilently();
                        } else {
                            console.log('✅ [RECEPTION] All IDs already local and synced.');
                        }
                        this.cdr.markForCheck();
                    });
                } else {
                    // Handle transit/reserved banners BASED ON ACTUAL PRODUCT DATA
                    this.isTransit = products.some(p => p.specificData?.pendingIncoming?.status === 'SHIPPED');
                    // Reserved means it is at center expéditeur (not shipped yet) OR stored at another center
                    this.isReserved = products.some(p =>
                        p.specificData?.pendingIncoming?.status === 'RESERVED' ||
                        (p.entrepot?.centreId !== currentCentreId && !p.specificData?.pendingIncoming)
                    );

                    this.receptionComplete = false;
                    console.log(`📦 [RECEPTION] Reception incomplete. Local: false, Transit: ${this.isTransit}, Reserved: ${this.isReserved}`);
                    this.cdr.markForCheck();
                }
            });
        });
    }


    loadLinkedFacture(): void {
        if (!this.clientId || !this.ficheId) return;

        // Find invoice linked to this fiche
        this.factureService.findAll({ clientId: this.clientId }).subscribe(factures => {
            const found = factures.find(f => f.ficheId === this.ficheId);
            if (found) {
                console.log('🔗 Linked Facture found:', found.numero);
                this.linkedFactureSubject.next(found);
                // Trigger check if fiche is already available
                if (this.currentFiche) {
                    this.checkReceptionForInstance(this.currentFiche);
                }
            } else {
                this.linkedFactureSubject.next(null);
            }
        });
    }

    onInvoiceSaved(facture: any): void {
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
        }

        this.calculateLensPrices(parentGroup);
    }

    openStockSearch(index: number = -1, target: 'monture' | 'verres' | 'od' | 'og' = 'monture'): void {
        const dialogRef = this.dialog.open(StockSearchDialogComponent, {
            width: '90vw',
            maxWidth: '1200px',
            height: '80vh',
            autoFocus: false,
            data: { context: 'sales' }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && (result.action === 'SELECT' || result.action === 'ORDER_AND_SELL') && result.product) {
                // ONE-CLICK LOGIC: Auto-enable edit mode if we are just viewing
                if (!this.isEditMode) {
                    console.log('⚡ [ONE-CLICK] Auto-enabling edit mode for product selection...');
                    this.isEditMode = true;
                    this.ficheForm.enable();
                }

                this.allProducts.push(result.product);
                const isPending = result.action === 'ORDER_AND_SELL' || (result.isPendingTransfer || false);
                this.fillProductDetails(result.product, index, target, isPending);

                if (result.action === 'ORDER_AND_SELL') {
                    this.snackBar.open(
                        'Produit commandé. La vente sera mise en instance jusqu\'à réception du stock.',
                        'OK',
                        { duration: 6000 }
                    );
                }

                // AUTO-SUBMIT: Immediately save the fiche.
                // We use a small timeout to ensure fillProductDetails has finished patching the form
                console.log('🚀 [ONE-CLICK] Auto-submitting fiche after selection...');
                setTimeout(() => this.onSubmit(), 300);
            }
        });
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

                if (product.specificData) {
                    const specs = product.specificData;
                    if (specs.calibre && specs.pont && specs.branche) {
                        montureGroup.patchValue({
                            taille: `${specs.calibre}-${specs.pont}-${specs.branche}`
                        });
                    }
                    if (specs.cerclage) {
                        montureGroup.patchValue({ cerclage: specs.cerclage });
                    }
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
        return this.ficheForm.get('suiviCommande.statut')?.value || 'A_COMMANDER';
    }

    setOrderStatus(statut: string): void {
        const group = this.ficheForm.get('suiviCommande');
        if (!group) return;

        group.patchValue({ statut });

        const now = new Date();

        // Auto-fill dates based on status transition
        if (statut === 'COMMANDE') {
            if (!group.get('dateCommande')?.value) {
                group.patchValue({ dateCommande: now });
            }
        } else if (statut === 'RECU') {
            if (!group.get('dateReception')?.value) {
                group.patchValue({ dateReception: now });
            }
        } else if (statut === 'LIVRE_CLIENT') {
            if (!group.get('dateLivraison')?.value) {
                group.patchValue({ dateLivraison: now });
            }
        }

        // Mark form as dirty to enable save
        this.ficheForm.markAsDirty();
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
                diametreEffectif: ['65/70'],
                capturedImage: [null], // [NEW] Base64 image from centering tablet
                remarques: ['']
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
                commentaire: ['']
            })
        });
    }

    addEquipment(): void {
        const typeEquipement = 'Monture';

        const equipmentGroup = this.fb.group({
            type: [typeEquipement],
            dateAjout: [new Date()],
            monture: this.fb.group({
                reference: [''],
                marque: [''],
                couleur: [''],
                taille: [''],
                cerclage: ['cerclée'],
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
                productIdOD: [null],
                productIdOG: [null],
                isPendingTransfer: [false]
            })
        });

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
                    file,
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

    loadFiche(): void {
        if (!this.ficheId) return;

        this.loading = true;
        this.ficheService.getFicheById(this.ficheId).subscribe({
            next: (fiche: any) => {
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
            error: (err) => {
                console.error('Error loading fiche:', err);
                this.loading = false;
                alert('Erreur lors du chargement de la fiche.');
            }
        });
    }

    private patchForm(fiche: any): void {
        // Patch Form Values
        this.ficheForm.patchValue({
            ordonnance: fiche.ordonnance,
            monture: fiche.monture,
            montage: fiche.montage,
            suggestions: fiche.suggestions,
            dateLivraisonEstimee: fiche.dateLivraisonEstimee,
            suiviCommande: fiche.suiviCommande
        }, { emitEvent: false });

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
                // Manually rebuild structure to ensure arrays (treatments) are handled correctly
                // and to include new fields like 'cerclage'
                const eqGroup = this.fb.group({
                    type: [eq.type],
                    dateAjout: [eq.dateAjout],
                    monture: this.fb.group({
                        reference: [eq.monture?.reference || ''],
                        marque: [eq.monture?.marque || ''],
                        couleur: [eq.monture?.couleur || ''],
                        taille: [eq.monture?.taille || ''],
                        cerclage: [eq.monture?.cerclage || 'cerclée'], // Added Field
                        prixMonture: [eq.monture?.prixMonture || 0],
                        productId: [eq.monture?.productId || null], // [NEW] Load if exists
                        entrepotId: [eq.monture?.entrepotId || null],
                        entrepotType: [eq.monture?.entrepotType || null],
                        isPendingTransfer: [eq.monture?.isPendingTransfer || false]
                    }),
                    verres: this.fb.group({
                        matiere: [eq.verres?.matiere],
                        marque: [eq.verres?.marque],
                        indice: [eq.verres?.indice ? String(eq.verres.indice) : null], // Type conversion
                        traitement: [eq.verres?.traitement || []], // Array safe here because passed as initial value? No, safest is patchValue below.
                        prixOD: [eq.verres?.prixOD],
                        prixOG: [eq.verres?.prixOG],
                        differentODOG: [eq.verres?.differentODOG || false],
                        matiereOD: [eq.verres?.matiereOD],
                        marqueOD: [eq.verres?.marqueOD],
                        indiceOD: [eq.verres?.indiceOD ? String(eq.verres.indiceOD) : null],
                        traitementOD: [eq.verres?.traitementOD || []],
                        matiereOG: [eq.verres?.matiereOG],
                        marqueOG: [eq.verres?.marqueOG],
                        indiceOG: [eq.verres?.indiceOG ? String(eq.verres.indiceOG) : null],
                        traitementOG: [eq.verres?.traitementOG || []],
                        productId: [eq.verres?.productId || null],
                        entrepotId: [eq.verres?.entrepotId || null],
                        isPendingTransfer: [eq.verres?.isPendingTransfer || false]
                    })
                });

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
            this.calculateLensPrices();
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

    // Load client invoices
    loadClientFactures() {
        if (this.clientId) {
            this.clientFactures$ = this.factureService.findAll({ clientId: this.clientId });
            if (this.ficheId && this.ficheId !== 'new') {
                this.linkedFacture$ = this.clientFactures$.pipe(
                    map(factures => factures.find(f => f.ficheId === this.ficheId) || null)
                );
            }
        }
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
            proprietes: {
                nomenclature: this.nomenclatureString || ''
            }
        };

        this.factureService.create(factureData).subscribe({
            next: (f) => this.router.navigate(['/p/clients/factures', f.id]),
            error: (err) => {
                const msg = err.error?.message || err.statusText || 'Erreur inconnue';
                alert(`Erreur: ${msg}`);
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

    async onSubmit() {
        console.log('🚀 [DIAGNOSTIC] onSubmit starting...');
        if (this.ficheForm.invalid || !this.clientId) {
            console.log('⚠️ [DIAGNOSTIC] Form Invalid or No Client ID', { invalid: this.ficheForm.invalid, clientId: this.clientId });
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

        if (hasPendingTransfer) {
            // [NEW] Reinforced Financial Status Logic (Devis vs Vente en Instance)
            // If there is a payment, it's an Instance. If not, it's a Devis.
            if (hasPayment) {
                userForcedType = 'DEVIS';
                userForcedStatut = 'VENTE_EN_INSTANCE';
                this.snackBar.open('Transfert en cours détecté. Vente mise en instance (Acompte présent).', 'OK', { duration: 5000 });
            } else {
                userForcedType = 'DEVIS';
                userForcedStatut = 'BROUILLON'; // Reverted to generic draft numbering for Devis
                this.snackBar.open('Transfert en cours détecté. Enregistré comme Devis (Pas d’acompte).', 'OK', { duration: 5000 });
            }

            userForcedStockDecrement = false;

            if (this.factureComponent) {
                this.factureComponent.form.patchValue({ type: userForcedType, statut: userForcedStatut });
            }
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
                userForcedType = 'DEVIS';
                userForcedStatut = 'VENTE_EN_INSTANCE';
                userForcedStockDecrement = false; // Changed from true
                if (this.factureComponent) {
                    this.factureComponent.form.patchValue({ type: 'DEVIS', statut: 'VENTE_EN_INSTANCE' });
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

                        // Pass extraProps to saveAsObservable
                        return this.factureComponent.saveAsObservable(true, extraProps).pipe(
                            map(() => fiche),
                            catchError(err => {
                                console.error('Error saving linked invoice:', err);
                                return of(fiche);
                            })
                        );
                    }
                    // Scenario 2: FactureComponent not active (Tab never visited) -> Check if invoice exists, create if not
                    else {
                        // First, check if an invoice already exists for this fiche
                        // Use the linkedFacture$ observable if available, otherwise query by client
                        // FIX: Explicitly check service for existing invoice (linkedFacture$ might be stale or not updated)
                        const checkExisting$ = this.factureService.findAll({ clientId: this.clientId }).pipe(
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
                                        map(() => fiche),
                                        catchError(err => {
                                            console.error('Error auto-updating invoice:', err);
                                            // Fallback: Just return fiche if update fails, don't block
                                            return of(fiche);
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
                                    map(() => fiche),
                                    catchError(err => {
                                        // If error is unique constraint on ficheId, it means it was created in parallel.
                                        // We can ignore this error safely as the goal (invoice exists) is met.
                                        if (err?.error?.message?.includes('ficheId') || err?.error?.code === 'P2002') {
                                            console.log('⚠️ Race condition prevented: Invoice already created during process.');
                                            return of(fiche);
                                        }
                                        console.error('Error auto-creating invoice:', err);
                                        return of(fiche);
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
            next: (fiche) => {
                this.loading = false;
                console.log('Fiche saved:', fiche);

                // Stay in edit mode and update state
                this.isEditMode = true;
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
            error: (err) => {
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
                const factures = await firstValueFrom(this.factureService.findAll({ clientId: this.clientId || '' }));
                const currentFacture = factures.find(f => f.ficheId === this.ficheId);
                if (currentFacture) {
                    await this.performSaleValidation(currentFacture);
                }
            } catch (e) {
                console.error('Error in validateInstancedSale:', e);
                this.loading = false;
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

        // 1. Detect if we have any valid products with stock
        const invoiceLines = this.getInvoiceLines();
        const productsWithStock = invoiceLines.filter(l => l.productId && l.entrepotId);

        if (productsWithStock.length === 0) {
            console.log('ℹ️ No products with stock detected. No special alert needed.');
            return;
        }

        // [FIX] Check if invoice is already validated - skip prompt if already VALIDE
        try {
            const factures = await firstValueFrom(this.factureService.findAll({ clientId: this.clientId || '' }));
            const currentFacture = factures.find(f => f.ficheId === this.ficheId);

            if (currentFacture && (currentFacture.statut === 'VALIDE' || currentFacture.type === 'FACTURE')) {
                console.log('✅ Invoice already validated. Skipping validation prompt.');
                return;
            }
        } catch (e) {
            console.error('Error checking invoice status:', e);
        }

        const warehouses = [...new Set(productsWithStock.map(p => p.entrepotNom || p.entrepotType))].join(' / ');
        const message = `Vente effectuée depuis l'entrepôt : ${warehouses}.\n\nSouhaitez-vous VALIDER la vente ou la LAISSER EN INSTANCE ?`;

        const choice = confirm(`${message}\n\nOK = Valider\nAnnuler = En Instance`);

        if (choice) {
            try {
                this.loading = true;
                const factures = await firstValueFrom(this.factureService.findAll({ clientId: this.clientId || '' }));
                const currentFacture = factures.find(f => f.ficheId === this.ficheId);
                if (currentFacture) {
                    await this.performSaleValidation(currentFacture);
                } else {
                    this.loading = false;
                }
            } catch (e) {
                this.loading = false;
            }
        } else {
            // ... (rest of instance logic)
            try {
                this.loading = true;
                const factures = await firstValueFrom(this.factureService.findAll({ clientId: this.clientId || '' }));
                const currentFacture = factures.find(f => f.ficheId === this.ficheId);
                if (currentFacture) {
                    this.setInstanceFicheFacture(currentFacture);
                } else {
                    this.loading = false;
                }
            } catch (e) {
                this.loading = false;
            }
        }
    }

    private async performSaleValidation(currentFacture: any) {
        console.log('📄 [VALIDATION] Converting Devis to official Facture:', currentFacture.numero);
        const lines = this.getInvoiceLines();

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
                forceStockDecrement: true  // Ensure stock is decremented upon validation from fiche
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
            montantTotal,
            montantPaye: this.currentFiche?.montantPaye || 0
        };

        console.log('📤 [RECEPTION] Sending silent update to background...', { monture: formValue.monture?.productId });
        this.ficheService.updateFiche(this.ficheId, ficheData).subscribe({
            next: (res) => {
                console.log('✅ [RECEPTION] Fiche synced with local IDs.');
                if (reload) {
                    console.log('🔄 Reloading data...');
                    this.snackBar.open('Données sauvegardées', 'OK', { duration: 2000 });
                    // We reload to break the mapping loop and ensure all states (including currentFiche) are fresh
                    this.loadFiche();
                } else {
                    // Update currentFiche locally to reflect saved state without full reload
                    this.currentFiche = { ...this.currentFiche, ...ficheData };
                }
            },
            error: (err) => {
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
                                capturedImage: measurement.imageDataUrl || null
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
            const hTotalVal = this.ficheForm.get('montage.hauteurVerre')?.value;
            let hTotal = parseFloat(hTotalVal);

            // Fallback to local storage if form failed
            if (isNaN(hTotal) && this.lastMeasFrameHeight !== null) {
                hTotal = this.lastMeasFrameHeight;
                console.log('⚠️ Using local fallback for Frame Height:', hTotal);
            }

            // Console log for debugging
            console.log('✏️ Drawing Frame M Height:', hTotal, 'Raw:', hTotalVal);

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
     * Print type to toggle specific print layouts
     */
    currentPrintType: 'FICHE_MONTAGE' | 'BON_COMMANDE' | null = null;

    /**
     * Print Fiche Montage
     */
    printFicheMontage(): void {
        this.currentPrintType = 'FICHE_MONTAGE';
        this.cdr.detectChanges();
        setTimeout(() => {
            window.print();
        }, 100);
    }

    /**
     * Print Bon de Commande Verre
     */
    printBonCommandeVerre(): void {
        this.currentPrintType = 'BON_COMMANDE';
        this.cdr.detectChanges();
        setTimeout(() => {
            window.print();
        }, 100);
    }

    /**
     * Generate and download montage sheet PDF (placeholder)
     */
    generateMontageSheet(): void {
        this.printFicheMontage();
    }
}

