import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, of, BehaviorSubject } from 'rxjs';
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
import { ClientService } from '../../services/client.service';
import { Client, isClientParticulier, isClientProfessionnel } from '../../models/client.model';
import { FicheService } from '../../services/fiche.service';
import { FicheMontureCreate, TypeFiche, StatutFiche, TypeEquipement, SuggestionIA } from '../../models/fiche-client.model';
import { FactureService, Facture } from '../../services/facture.service';
import { FactureFormComponent } from '../../factures/facture-form/facture-form.component';
import { PaymentListComponent } from '../../payments/payment-list/payment-list.component';
import { map, switchMap, tap, catchError } from 'rxjs/operators';
import { getLensSuggestion, Correction, FrameData, calculateLensPrice, determineLensType } from '../../utils/lensLogic';
import { getLensMaterials, getLensIndices } from '../../utils/lensDatabase';

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
    templateUrl: './monture-form.component.html',
    styleUrls: ['./monture-form.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MontureFormComponent implements OnInit {
    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
    @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
    @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;
    @ViewChild('centeringCanvas') centeringCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild('frameCanvas') frameCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild(FactureFormComponent) factureComponent!: FactureFormComponent;
    @ViewChild(PaymentListComponent) paymentListComponent!: PaymentListComponent;

    ficheForm: FormGroup;
    clientId: string | null = null;
    client: Client | null = null;
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
    initialLines: any[] = [];
    nomenclatureString: string | null = null;
    showFacture = false;
    // Paste text dialog removed


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
        private clientService: ClientService,
        private ficheService: FicheService,
        private cdr: ChangeDetectorRef,
        private sanitizer: DomSanitizer,
        private dialog: MatDialog,
        private factureService: FactureService
    ) {
        this.ficheForm = this.initForm();
    }

    ngOnInit(): void {
        // Draw frame visualization when tab changes to Fiche Montage
        this.ficheForm.valueChanges.subscribe(() => {
            if (this.activeTab === 2) {
                setTimeout(() => this.drawFrameVisualization(), 100);
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
    }

    loadLinkedFacture(): void {
        if (!this.clientId || !this.ficheId) return;

        // Find invoice linked to this fiche
        this.factureService.findAll({ clientId: this.clientId }).subscribe(factures => {
            const found = factures.find(f => f.ficheId === this.ficheId);
            if (found) {
                console.log('🔗 Linked Facture found:', found.numero);
                this.linkedFactureSubject.next(found);
            } else {
                this.linkedFactureSubject.next(null);
            }
        });
    }

    onInvoiceSaved(facture: any): void {
        console.log('✅ Invoice saved/updated in Monture Form:', facture);

        // Update the subject to reflect the new state (e.g. Valid status, New Number)
        this.linkedFactureSubject.next(facture);

        // Also ensure inputs are synced if they weren't
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

    initForm(): FormGroup {
        return this.fb.group({
            // Onglet 1: Ordonnance
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
                prescriptionFiles: [[]]  // Store prescription attachments
            }),

            // Onglet 2: Monture & Verres
            monture: this.fb.group({
                typeEquipement: [TypeEquipement.MONTURE, Validators.required],
                reference: [''],
                codeBarres: [''],
                marque: [''],
                couleur: ['Noir mat'],
                taille: ['52-18-145'],
                cerclage: ['cerclée'], // Type de cerclage: cerclée/nylor/percée
                prixMonture: [0, Validators.required]
            }),

            verres: this.fb.group({
                matiere: [null],
                marque: [null],
                indice: [null],
                traitement: [[]],
                prixOD: [0],
                prixOG: [0],
                differentODOG: [false],

                // Champs OD
                matiereOD: [null],
                marqueOD: [null],
                indiceOD: [null],
                traitementOD: [[]],

                // Champs OG
                matiereOG: [null],
                marqueOG: [null],
                indiceOG: [null],
                traitementOG: [[]]
            }),

            // Onglet 3: Fiche Montage
            montage: this.fb.group({
                typeMontage: ['Cerclé (Complet)'],
                ecartPupillaireOD: [32, [Validators.required, Validators.min(20), Validators.max(40)]],
                ecartPupillaireOG: [32, [Validators.required, Validators.min(20), Validators.max(40)]],
                hauteurOD: [20, [Validators.required, Validators.min(10), Validators.max(30)]],
                hauteurOG: [20, [Validators.required, Validators.min(10), Validators.max(30)]],
                diametreEffectif: ['65/70'],
                remarques: ['']
            }),

            // AI suggestions
            suggestions: [[]],

            // Liste des équipements additionnels
            equipements: this.fb.array([]),

            // Date Livraison (Required)
            dateLivraisonEstimee: [null, Validators.required]
        });
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

    closeSuggestions(): void {
        this.showSuggestions = false;
        this.activeSuggestionIndex = null;
        this.cdr.markForCheck();
    }

    // Scan Functionality
    scanBarcode(fieldName: string, groupIndex: number = -1): void {
        // Determine target group (Main vs Added)
        const montureGroup = groupIndex === -1
            ? this.ficheForm.get('monture')
            : this.equipements.at(groupIndex)?.get('monture');

        if (montureGroup) {
            // Simulate scanning delay
            // In a real app, this would open a barcode scanner
            const mockBarcode = 'REF-' + Math.floor(100000 + Math.random() * 900000);
            montureGroup.get(fieldName)?.setValue(mockBarcode);
            this.cdr.markForCheck();
        }
    }

    // Equipment Management
    get equipements(): FormArray {
        return this.ficheForm.get('equipements') as FormArray;
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
                prixMonture: [0]
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
                traitementOG: [[]]
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
                    this.patchForm(fiche);
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
            dateLivraisonEstimee: fiche.dateLivraisonEstimee
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
                        prixMonture: [eq.monture?.prixMonture || 0]
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
                        traitementOG: [eq.verres?.traitementOG || []]
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
            this.drawFrameVisualization();
            if (this.activeTab === 2) this.drawCenteringCanvas();
        }, 500);

        // Force UI update (OnPush strategy might miss patchValue with emitEvent: false)
        this.cdr.markForCheck();
    }

    setActiveTab(index: number): void {
        this.activeTab = index;
        // Draw canvas when switching to Fiche Montage tab
        if (index === 2) {
            setTimeout(() => {
                this.drawFrameVisualization();
            }, 100);
        }
        // Load invoices when switching to Billing tab
        if (index === 3 && this.client) {
            this.updateInitialLines();
            this.loadClientFactures();
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
                lignes.push({
                    description: `Monture ${marque} ${ref}`.trim(),
                    qte: 1,
                    prixUnitaireTTC: prixMonture,
                    remise: 0,
                    totalTTC: prixMonture
                });
            }

            // Verres
            const differentODOG = mainVerres.differentODOG;
            const matiere = mainVerres.matiere || 'Verre';

            // Generate Nomenclature String (Internal use for notes, but removed from line description per request)
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
                        totalTTC: prixOD
                    });
                }
                if (prixOG > 0) {
                    lignes.push({
                        description: `Verre OG ${matiereOG} ${indiceOG}`.trim(),
                        qte: 1,
                        prixUnitaireTTC: prixOG,
                        remise: 0,
                        totalTTC: prixOG
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
                        totalTTC: prixOD
                    });
                }
                if (prixOG > 0) {
                    lignes.push({
                        description: `Verre OG ${matiere} ${indice}`.trim(),
                        qte: 1,
                        prixUnitaireTTC: prixOG,
                        remise: 0,
                        totalTTC: prixOG
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
                    const prix = parseFloat(monture.prixMonture) || 0;
                    if (prix > 0) {
                        lignes.push({
                            description: `Monture Eq${index + 1} ${monture.marque || ''} ${monture.reference || ''}`.trim(),
                            qte: 1,
                            prixUnitaireTTC: prix,
                            remise: 0,
                            totalTTC: prix
                        });
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
                            totalTTC: prixOD
                        });
                    }
                    const prixOG = parseFloat(verres.prixOG) || 0;
                    if (prixOG > 0) {
                        lignes.push({
                            description: getDesc('OG'),
                            qte: 1,
                            prixUnitaireTTC: prixOG,
                            remise: 0,
                            totalTTC: prixOG
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
        if (targetTab === 4) {
            if (this.factureComponent && (!this.factureComponent.id || this.factureComponent.id === 'new')) {
                if (this.factureComponent.form.value.lignes.length > 0) {
                    this.factureComponent.saveAsObservable().subscribe(() => {
                        this.activeTab = targetTab;
                        setTimeout(() => {
                            if (this.paymentListComponent) this.paymentListComponent.loadPayments();
                        }, 200);
                    });
                    return;
                }
            }
        }
        if (this.activeTab < 4) {
            this.activeTab++;
            if (this.activeTab === 2) setTimeout(() => this.drawFrameVisualization(), 100);
            if (this.activeTab === 3) this.generateInvoiceLines();
        }
    }

    prevTab(): void {
        if (this.activeTab > 0) {
            this.activeTab--;
            if (this.activeTab === 2) setTimeout(() => this.drawFrameVisualization(), 100);
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

    onSubmit(): void {
        if (this.ficheForm.invalid || !this.clientId) return;
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

                        return this.factureComponent.saveAsObservable().pipe(
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

                                    this.generateInvoiceLines();
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
                                            nomenclature: this.nomenclatureString || ''
                                        },
                                        resteAPayer: total // Usually resets amount to pay if content changes? Valid for BROUILLON.
                                    };

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
                                this.generateInvoiceLines();
                                console.log('📋 Generating nomenclature for new invoice:', this.nomenclatureString);

                                const total = generatedLines.reduce((acc, val) => acc + val.totalTTC, 0);
                                const tvaRate = 0.20;
                                const totalHT = total / (1 + tvaRate);
                                const tva = total - totalHT;

                                const factureData: any = {
                                    type: 'FACTURE',
                                    statut: 'BROUILLON',
                                    dateEmission: new Date(),
                                    clientId: this.clientId,
                                    ficheId: fiche.id,
                                    lignes: generatedLines,
                                    totalTTC: total,
                                    totalHT: totalHT,
                                    totalTVA: tva,
                                    proprietes: {
                                        nomenclature: this.nomenclatureString || ''
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
                // this.snackBar.open ... handling in saveAsObservable for invoice, but we need one for Fiche?
                // FactureFormComponent shows its own snackbar.
                // We should show "Fiche enregistrée".
                // Use a simple prompt or snackbar if available.
                // The original code used alert or logic in 'next'.
                // We'll just log and maybe navigate if needed.
                console.log('Fiche saved:', fiche);

                // FIX: Patch form with saved data to ensure UI reflects backend state (prevents fields clearing)
                this.patchForm(fiche);

                // Fix: Ensure form is disabled after save (View Mode)
                if (!wasNew) {
                    this.ficheForm.disable();
                    this.isEditMode = false;
                }

                if (wasNew) { // Use captured state
                    this.router.navigate(['/p/clients', this.clientId, 'fiche-monture', fiche.id], { replaceUrl: true });
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

    ngAfterViewInit(): void {
        // Ensure view is fully initialized
        this.cdr.detectChanges();

        // Initialize canvas drawing with longer delay to ensure DOM is ready
        setTimeout(() => {
            this.drawFrameVisualization();
        }, 500);

        // Listen to montage form changes for real-time canvas updates
        this.ficheForm.get('montage')?.valueChanges.subscribe(() => {
            this.drawFrameVisualization();
        });
    }

    /**
     * Draw centering canvas with OD/OG circles and crosshairs
     */
    drawCenteringCanvas(): void {
        console.log('drawCenteringCanvas called');

        if (!this.centeringCanvas) {
            console.warn('Canvas ViewChild not initialized');
            return;
        }

        const canvas = this.centeringCanvas.nativeElement;
        console.log('Canvas element:', canvas);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Could not get 2D context');
            return;
        }

        console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Get values from form
        const pdOD = this.ficheForm.get('montage.ecartPupillaireOD')?.value || 32;
        const pdOG = this.ficheForm.get('montage.ecartPupillaireOG')?.value || 32;
        const hauteurOD = this.ficheForm.get('montage.hauteurOD')?.value || 20;
        const hauteurOG = this.ficheForm.get('montage.hauteurOG')?.value || 20;

        // Scale: 1mm = 4px
        const scale = 4;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Calculate positions
        const odX = centerX - (pdOD * scale / 2);
        const ogX = centerX + (pdOG * scale / 2);
        const odY = centerY - (hauteurOD * scale / 2);
        const ogY = centerY - (hauteurOG * scale / 2);

        // Draw OD circle (blue)
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(odX, odY, 30, 0, 2 * Math.PI);
        ctx.stroke();

        // Draw OD crosshair
        ctx.strokeStyle = '#4f46e5';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(odX - 15, odY);
        ctx.lineTo(odX + 15, odY);
        ctx.moveTo(odX, odY - 15);
        ctx.lineTo(odX, odY + 15);
        ctx.stroke();

        // Draw OG circle (green)
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ogX, ogY, 30, 0, 2 * Math.PI);
        ctx.stroke();

        // Draw OG crosshair
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ogX - 15, ogY);
        ctx.lineTo(ogX + 15, ogY);
        ctx.moveTo(ogX, ogY - 15);
        ctx.lineTo(ogX, ogY + 15);
        ctx.stroke();

        // Draw labels
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillStyle = '#4f46e5';
        ctx.fillText('OD', odX - 10, odY - 40);
        ctx.fillStyle = '#10b981';
        ctx.fillText('OG', ogX - 10, ogY - 40);

        // Draw center reference line
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(centerX, 0);
        ctx.lineTo(centerX, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw scale indicator
        ctx.font = '12px Inter, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('Échelle: 1mm = 4px', 10, canvas.height - 10);
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
                        // Populate form with measurements (Precise values)
                        this.ficheForm.patchValue({
                            montage: {
                                ecartPupillaireOD: measurement.pdRightMm.toFixed(1), // Keep 1 decimal
                                ecartPupillaireOG: measurement.pdLeftMm.toFixed(1),
                                hauteurOD: measurement.heightRightMm ? measurement.heightRightMm.toFixed(1) : null,
                                hauteurOG: measurement.heightLeftMm ? measurement.heightLeftMm.toFixed(1) : null
                            },
                            // Sync Ecarts to Ordonnance tab as well
                            ordonnance: {
                                od: { ep: measurement.pdRightMm.toFixed(1) },
                                og: { ep: measurement.pdLeftMm.toFixed(1) }
                            }
                        });

                        // Redraw canvas with new values
                        setTimeout(() => {
                            this.drawCenteringCanvas();
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
     * Draw frame visualization with TWO LENSES and measurement indicators
     */
    drawFrameVisualization(): void {
        // Only draw if we are on the correct tab and canvas exists
        if (this.activeTab !== 2 || !this.frameCanvas || !this.frameCanvas.nativeElement) {
            return;
        }

        const canvas = this.frameCanvas.nativeElement;
        // console.log('Canvas element:', canvas); // Reduce logs
        console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Could not get 2D context');
            return;
        }

        // Clear canvas with WHITE background (save ink!)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Get frame data
        const taille = this.ficheForm.get('monture.taille')?.value || '52-18-140';
        const [calibreStr, pontStr] = taille.split('-');
        const calibre = parseInt(calibreStr) || 52;
        const pont = parseInt(pontStr) || 18;

        const hauteurOD = this.ficheForm.get('montage.hauteurOD')?.value || 20;
        const hauteurOG = this.ficheForm.get('montage.hauteurOG')?.value || 20;
        const epOD = this.ficheForm.get('montage.ecartPupillaireOD')?.value || 32;
        const epOG = this.ficheForm.get('montage.ecartPupillaireOG')?.value || 32;

        // Get mounting type for frame adjustment
        const typeMontage = this.ficheForm.get('montage.typeMontage')?.value || '';

        // Frame width adjustment based on mounting type (simplified)
        let frameAdjustment = 0;
        if (typeMontage.includes('Percé') || typeMontage.includes('Nylor')) {
            frameAdjustment = 0; // 0mm for rimless/drilled (no frame)
        } else {
            frameAdjustment = 5; // +5mm for framed (Cerclé, Demi-Cerclé, Complet)
        }

        // Canvas dimensions and scale
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const scale = 3.5; // 1mm = 3.5px (increased for better visibility)

        // Lens dimensions
        const lensWidth = calibre * scale;
        const lensHeight = lensWidth * 0.65;
        const bridgeWidth = pont * scale;

        // Calculate positions for TWO LENSES
        const leftLensX = centerX - bridgeWidth / 2 - lensWidth / 2;
        const rightLensX = centerX + bridgeWidth / 2 + lensWidth / 2;
        const lensY = centerY;

        // Helper function to draw rounded rectangle
        const drawRoundedRect = (x: number, y: number, width: number, height: number, radius: number) => {
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.stroke();
        };

        // Draw LEFT LENS (OG)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        drawRoundedRect(leftLensX - lensWidth / 2, lensY - lensHeight / 2, lensWidth, lensHeight, 15);

        // Draw RIGHT LENS (OD)
        drawRoundedRect(rightLensX - lensWidth / 2, lensY - lensHeight / 2, lensWidth, lensHeight, 15);

        // Draw BRIDGE
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(leftLensX + lensWidth / 2, lensY - 10);
        ctx.lineTo(rightLensX - lensWidth / 2, lensY - 10);
        ctx.stroke();

        // RED LINE - Bridge center (vertical)
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, lensY - lensHeight / 2 - 30);
        ctx.lineTo(centerX, lensY + lensHeight / 2 + 30);
        ctx.stroke();

        // ORANGE LINES - Frame total width (vertical at outer edges with adjustment)
        ctx.strokeStyle = '#FF8800';
        ctx.lineWidth = 3;
        const adjustmentScaled = frameAdjustment * scale;
        const leftEdge = leftLensX - lensWidth / 2 - adjustmentScaled / 2;
        const rightEdge = rightLensX + lensWidth / 2 + adjustmentScaled / 2;
        ctx.beginPath();
        ctx.moveTo(leftEdge, lensY - lensHeight / 2 - 20);
        ctx.lineTo(leftEdge, lensY + lensHeight / 2 + 20);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rightEdge, lensY - lensHeight / 2 - 20);
        ctx.lineTo(rightEdge, lensY + lensHeight / 2 + 20);
        ctx.stroke();

        // PUPIL POSITIONS (centers of each lens)
        const pupilODX = rightLensX;
        const pupilOGX = leftLensX;
        const pupilY = lensY; // Center height

        // BLUE DOTTED LINE - Distance between pupils (EP horizontal)
        ctx.strokeStyle = '#0066FF';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]); // Dotted line
        ctx.beginPath();
        ctx.moveTo(pupilOGX, pupilY);
        ctx.lineTo(pupilODX, pupilY);
        ctx.stroke();
        ctx.setLineDash([]); // Reset to solid

        // Draw pupil markers (small circles)
        ctx.fillStyle = '#0066FF';
        ctx.beginPath();
        ctx.arc(pupilODX, pupilY, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pupilOGX, pupilY, 4, 0, 2 * Math.PI);
        ctx.fill();

        // BLUE VERTICAL LINES - Height from pupil to bottom of lens
        const bottomOD = lensY + lensHeight / 2;
        const bottomOG = lensY + lensHeight / 2;

        ctx.strokeStyle = '#0066FF';
        ctx.lineWidth = 2;
        // OD height
        ctx.beginPath();
        ctx.moveTo(pupilODX, pupilY);
        ctx.lineTo(pupilODX, bottomOD);
        ctx.stroke();
        // OG height
        ctx.beginPath();
        ctx.moveTo(pupilOGX, pupilY);
        ctx.lineTo(pupilOGX, bottomOG);
        ctx.stroke();

        // Labels
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';

        // Caliber label (bottom center)
        ctx.fillText(`${calibre}mm`, centerX, lensY + lensHeight / 2 + 50);

        // Bridge label (top center)
        ctx.font = '11px Arial';
        ctx.fillText(`Pont: ${pont}mm`, centerX, lensY - lensHeight / 2 - 35);

        // EP labels (separate for OD and OG)
        ctx.font = 'bold 11px Arial';
        ctx.fillStyle = '#0066FF';
        ctx.textAlign = 'center';
        // EP OD (right side)
        ctx.fillText(`EP OD: ${epOD}mm`, rightLensX, lensY - lensHeight / 2 - 50);
        // EP OG (left side)
        ctx.fillText(`EP OG: ${epOG}mm`, leftLensX, lensY - lensHeight / 2 - 50);

        // Height labels
        ctx.font = '10px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`H: ${hauteurOD}mm`, pupilODX + 8, (pupilY + bottomOD) / 2);
        ctx.fillText(`H: ${hauteurOG}mm`, pupilOGX + 8, (pupilY + bottomOG) / 2);

        // Lens labels
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#3b82f6';
        ctx.fillText('OD', rightLensX, lensY - lensHeight / 2 + 20);
        ctx.fillStyle = '#22c55e';
        ctx.fillText('OG', leftLensX, lensY - lensHeight / 2 + 20);

        // Calculate total width for later use
        const totalWidth = calibre * 2 + pont + frameAdjustment;

        // Helper function to draw dimension line with arrows
        const drawDimension = (x1: number, y: number, x2: number, label: string, color: string) => {
            const arrowSize = 6;

            // Main horizontal line
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x1, y);
            ctx.lineTo(x2, y);
            ctx.stroke();

            // Left arrow
            ctx.beginPath();
            ctx.moveTo(x1, y);
            ctx.lineTo(x1 + arrowSize, y - arrowSize);
            ctx.lineTo(x1 + arrowSize, y + arrowSize);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();

            // Right arrow
            ctx.beginPath();
            ctx.moveTo(x2, y);
            ctx.lineTo(x2 - arrowSize, y - arrowSize);
            ctx.lineTo(x2 - arrowSize, y + arrowSize);
            ctx.closePath();
            ctx.fill();

            // Label
            ctx.fillStyle = color;
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(label, (x1 + x2) / 2, y - 8);
        };

        // COTATION 1: Largeur du verre (calibre) - EN BAS du verre OG
        const dimensionY1 = lensY + lensHeight / 2 + 40; // Below the lens
        const dimensionX1Start = leftLensX - lensWidth / 2;
        const dimensionX1End = leftLensX + lensWidth / 2;
        drawDimension(dimensionX1Start, dimensionY1, dimensionX1End, `${calibre}mm`, '#000000');

        // COTATION 2: Largeur totale de la monture - en bas (plus bas pour meilleure visibilité)
        const dimensionY2 = lensY + lensHeight / 2 + 100; // Increased from 80 to 100
        const totalLeftEdge = leftLensX - lensWidth / 2 - adjustmentScaled / 2;
        const totalRightEdge = rightLensX + lensWidth / 2 + adjustmentScaled / 2;
        drawDimension(totalLeftEdge, dimensionY2, totalRightEdge, `Largeur totale: ${totalWidth}mm`, '#FF8800');
    }

    /**
     * Print Fiche Montage
     */
    printFicheMontage(): void {
        window.print();
    }

    /**
     * Generate and download montage sheet PDF (placeholder)
     */
    generateMontageSheet(): void {
        // TODO: Implement PDF generation with jsPDF or pdfmake
        window.print();
    }
}
