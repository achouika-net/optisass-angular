import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, AbstractControl, ReactiveFormsModule, Validators, FormArray, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
import { FicheService } from '../../services/fiche.service';
import { FicheMontureCreate, TypeFiche, StatutFiche, TypeEquipement, SuggestionIA } from '../../models/fiche-client.model';

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
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatTabsModule,
        MatCheckboxModule
    ],
    templateUrl: './monture-form.component.html',
    styleUrls: ['./monture-form.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MontureFormComponent implements OnInit {
    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
    @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
    @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

    ficheForm: FormGroup;
    clientId: string | null = null;
    ficheId: string | null = null;
    activeTab = 0;
    loading = false;
    isEditMode = false;

    readonly TypeEquipement = TypeEquipement;

    // Contrôle indépendant pour la sélection du type d'équipement (ajout dynamique)
    selectedEquipmentType = new FormControl<TypeEquipement | null>(null);

    // Enums pour les dropdowns
    typesEquipement = Object.values(TypeEquipement);

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

    // Prix des verres (logique de calcul)
    private LENS_PRICES: Record<string, Record<string, number>> = {
        'Organique (CR-39)': {
            '1.50 (Standard)': 200,
            '1.56': 300,
            '1.60': 400,
            '1.67': 500,
            '1.74': 700
        },
        'Polycarbonate': {
            '1.59': 450
        },
        'Trivex': {
            '1.53': 400
        }
    };

    private TREATMENT_PRICES: Record<string, number> = {
        'Anti-reflet': 100,
        'Durci': 50,
        'Hydrophobe': 75,
        'Anti-rayure': 60
    };

    constructor(
        private fb: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private ficheService: FicheService,
        private cdr: ChangeDetectorRef,
        private sanitizer: DomSanitizer
    ) {
        this.ficheForm = this.initForm();
    }

    ngOnInit(): void {
        this.clientId = this.route.snapshot.paramMap.get('clientId');
        this.ficheId = this.route.snapshot.paramMap.get('ficheId');

        if (this.ficheId && this.ficheId !== 'new') {
            this.isEditMode = true;
            this.loadFiche();
        }

        // Setup generic listeners for Main Equipment
        this.setupLensListeners(this.ficheForm);

        // Sync selectedEquipmentType with Main Equipment Type if no added equipments
        this.selectedEquipmentType.valueChanges.subscribe(value => {
            if (value && this.equipements.length === 0) {
                this.ficheForm.get('monture.typeEquipement')?.setValue(value);
            }
        });
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
                prescripteur: ['']
            }),

            // Onglet 2: Monture & Verres
            monture: this.fb.group({
                typeEquipement: [TypeEquipement.MONTURE, Validators.required],
                reference: [''],
                codeBarres: [''],
                marque: [''],
                couleur: ['Noir mat'],
                taille: ['52-18-145'],
                prixMonture: [0, Validators.required]
            }),

            verres: this.fb.group({
                matiere: ['Organique (CR-39)', Validators.required],
                indice: ['1.50 (Standard)', Validators.required],
                traitement: [['Anti-reflet']],
                prixOD: [0],
                prixOG: [0],
                differentODOG: [false],

                // Champs OD
                matiereOD: ['Organique (CR-39)'],
                indiceOD: ['1.50 (Standard)'],
                traitementOD: [['Anti-reflet']],

                // Champs OG
                matiereOG: ['Organique (CR-39)'],
                indiceOG: ['1.50 (Standard)'],
                traitementOG: [['Anti-reflet']]
            }),

            // Liste des équipements additionnels
            equipements: this.fb.array([])
        });
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
                verresGroup.patchValue({
                    matiereOD: currentVals.matiere,
                    indiceOD: currentVals.indice,
                    traitementOD: currentVals.traitement,
                    matiereOG: currentVals.matiere,
                    indiceOG: currentVals.indice,
                    traitementOG: currentVals.traitement
                }, { emitEvent: false });
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

            prixOD = this.LENS_PRICES[matiereOD]?.[indiceOD] || 0;
            traitementsOD.forEach((t: string) => {
                prixOD += this.TREATMENT_PRICES[t] || 0;
            });
        } else {
            const matiere = verresGroup.get('matiere')?.value;
            const indice = verresGroup.get('indice')?.value;
            const traitements = verresGroup.get('traitement')?.value || [];

            prixOD = this.LENS_PRICES[matiere]?.[indice] || 0;
            traitements.forEach((t: string) => {
                prixOD += this.TREATMENT_PRICES[t] || 0;
            });
        }

        // Prix OG
        let prixOG = 0;
        if (differentODOG) {
            const matiereOG = verresGroup.get('matiereOG')?.value;
            const indiceOG = verresGroup.get('indiceOG')?.value;
            const traitementsOG = verresGroup.get('traitementOG')?.value || [];

            prixOG = this.LENS_PRICES[matiereOG]?.[indiceOG] || 0;
            traitementsOG.forEach((t: string) => {
                prixOG += this.TREATMENT_PRICES[t] || 0;
            });
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
        const od = this.ficheForm.get('ordonnance.od')?.value;
        const og = this.ficheForm.get('ordonnance.og')?.value;

        this.suggestions = [];

        // Suggestion pour OD
        if (Math.abs(od.sphere) > 3) {
            this.suggestions.push({
                type: 'OD',
                matiere: 'Organique (CR-39)',
                indice: '1.67',
                raison: 'Correction forte - important pour réduire l\'épaisseur',
                epaisseur: '~1.5-2mm'
            });
        } else {
            this.suggestions.push({
                type: 'OD',
                matiere: 'Organique (CR-39)',
                indice: '1.50 (Standard)',
                raison: 'Correction faible - épaisseur normale suffisante',
                epaisseur: '~3-4mm'
            });
        }

        // Suggestion pour OG
        if (Math.abs(og.sphere) > 3) {
            this.suggestions.push({
                type: 'OG',
                matiere: 'Organique (CR-39)',
                indice: '1.67',
                raison: 'Correction forte - important pour réduire l\'épaisseur',
                epaisseur: '~1.5-2mm'
            });
        } else {
            this.suggestions.push({
                type: 'OG',
                matiere: 'Organique (CR-39)',
                indice: '1.50 (Standard)',
                raison: 'Correction faible - épaisseur normale suffisante',
                epaisseur: '~3-4mm'
            });
        }

        this.showSuggestions = true;
        this.cdr.markForCheck();
    }

    applySuggestion(suggestion: SuggestionIA, parentGroup: AbstractControl = this.ficheForm): void {
        const verresGroup = parentGroup.get('verres');
        if (!verresGroup) return;

        if (suggestion.type === 'OD') {
            verresGroup.patchValue({
                matiere: suggestion.matiere,
                indice: suggestion.indice,
                matiereOD: suggestion.matiere,
                indiceOD: suggestion.indice
            });
        } else {
            verresGroup.patchValue({
                differentODOG: true,
                matiereOG: suggestion.matiere,
                indiceOG: suggestion.indice
            });

            // Sync OD fields if needed
            const currentMatiere = verresGroup.get('matiere')?.value;
            const currentIndice = verresGroup.get('indice')?.value;
            if (currentMatiere) {
                verresGroup.patchValue({
                    matiereOD: currentMatiere,
                    indiceOD: currentIndice
                }, { emitEvent: false });
            }
        }

        this.calculateLensPrices(parentGroup);
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
                prixMonture: [0]
            }),
            verres: this.fb.group({
                matiere: ['Organique (CR-39)'],
                indice: ['1.50 (Standard)'],
                traitement: [['Anti-reflet']],
                prixOD: [0],
                prixOG: [0],
                differentODOG: [false],
                matiereOD: ['Organique (CR-39)'],
                indiceOD: ['1.50 (Standard)'],
                traitementOD: [['Anti-reflet']],
                matiereOG: ['Organique (CR-39)'],
                indiceOG: ['1.50 (Standard)'],
                traitementOG: [['Anti-reflet']]
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
            this.router.navigate(['/clients', this.clientId]);
        } else {
            this.router.navigate(['/clients']);
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

    extractData(file: PrescriptionFile): void {
        console.log(`Extraction automatique des données de ${file.name}...`);
        setTimeout(() => {
            const odGroup = this.ficheForm.get('ordonnance.od');
            const ogGroup = this.ficheForm.get('ordonnance.og');
            if (odGroup && ogGroup) {
                odGroup.patchValue({
                    sphere: '-1.25',
                    cylindre: '-0.50',
                    axe: '90°',
                    ep: '32'
                });
                ogGroup.patchValue({
                    sphere: '-1.00',
                    cylindre: '-0.25',
                    axe: '85°',
                    ep: '32'
                });
                console.log('Données extraites et injectées automatiquement');
                this.cdr.markForCheck();
            }
        }, 1500);
    }

    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    loadFiche(): void {
        // TODO: Charger la fiche existante
    }

    setActiveTab(index: number): void {
        this.activeTab = index;
    }

    nextTab(): void {
        if (this.activeTab < 2) {
            this.activeTab++;
        }
    }

    prevTab(): void {
        if (this.activeTab > 0) {
            this.activeTab--;
        }
    }

    formatSphereValue(eye: 'od' | 'og', event: Event): void {
        const input = event.target as HTMLInputElement;
        const value = parseFloat(input.value);
        if (!isNaN(value)) {
            const formatted = value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
            this.ficheForm.get(`ordonnance.${eye}.sphere`)?.setValue(formatted, { emitEvent: false });
            input.value = formatted;
        }
    }

    formatCylindreValue(eye: 'od' | 'og', event: Event): void {
        const input = event.target as HTMLInputElement;
        const value = parseFloat(input.value);
        if (!isNaN(value)) {
            const formatted = value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
            this.ficheForm.get(`ordonnance.${eye}.cylindre`)?.setValue(formatted, { emitEvent: false });
            input.value = formatted;
        }
    }

    formatAdditionValue(eye: 'od' | 'og', event: Event): void {
        const input = event.target as HTMLInputElement;
        const value = parseFloat(input.value);
        if (!isNaN(value)) {
            const formatted = value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
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
        const value = parseFloat(input.value);
        if (!isNaN(value)) {
            const formatted = value.toFixed(2);
            this.ficheForm.get(`ordonnance.${eye}.prisme`)?.setValue(formatted, { emitEvent: false });
            input.value = formatted;
        }
    }

    formatEPValue(eye: 'od' | 'og', event: Event): void {
        const input = event.target as HTMLInputElement;
        const cleanValue = input.value.replace(/[^0-9.]/g, '');
        const value = parseFloat(cleanValue);
        if (!isNaN(value)) {
            const formatted = `${value.toFixed(2)} mm`;
            this.ficheForm.get(`ordonnance.${eye}.ep`)?.setValue(value, { emitEvent: false });
            input.value = formatted;
        }
    }

    formatBaseValue(eye: 'od' | 'og', event: Event): void {
        const input = event.target as HTMLInputElement;
        const value = input.value.toUpperCase();
        this.ficheForm.get(`ordonnance.${eye}.base`)?.setValue(value, { emitEvent: false });
        input.value = value;
    }

    onSubmit(): void {
        if (this.ficheForm.invalid || !this.clientId) return;
        this.loading = true;
        const formValue = this.ficheForm.value;
        const montantTotal = formValue.monture.prixMonture + formValue.verres.prixOD + formValue.verres.prixOG;
        const ficheData: FicheMontureCreate = {
            clientId: this.clientId,
            type: TypeFiche.MONTURE,
            statut: StatutFiche.EN_COURS,
            ordonnance: formValue.ordonnance,
            monture: formValue.monture,
            verres: formValue.verres,
            montantTotal,
            montantPaye: 0
        };
        this.ficheService.createFicheMonture(ficheData).subscribe({
            next: () => {
                this.loading = false;
                this.router.navigate(['/clients', this.clientId]);
            },
            error: (err) => {
                console.error('Error creating fiche:', err);
                this.loading = false;
                this.cdr.markForCheck();
            }
        });
    }

    // Camera capture methods
    async openCamera(): Promise<void> {
        try {
            this.showCameraModal = true;
            this.cdr.markForCheck();
            await new Promise(resolve => setTimeout(resolve, 100));
            this.cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false
            });
            if (this.videoElement) {
                this.videoElement.nativeElement.srcObject = this.cameraStream;
            }
        } catch (error) {
            console.error('Camera access error:', error);
            alert('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
            this.closeCamera();
        }
    }

    capturePhoto(): void {
        if (!this.videoElement || !this.canvasElement) return;
        const video = this.videoElement.nativeElement;
        const canvas = this.canvasElement.nativeElement;
        const context = canvas.getContext('2d');
        if (!context) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        this.capturedImage = canvas.toDataURL('image/jpeg', 0.9);
        this.cdr.markForCheck();
    }

    retakePhoto(): void {
        this.capturedImage = null;
        this.cdr.markForCheck();
    }

    useCapture(): void {
        if (!this.capturedImage) return;
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
                    file: file,
                    uploadDate: new Date()
                };
                this.prescriptionFiles.push(prescriptionFile);
                this.extractData(prescriptionFile);
                this.closeCamera();
                this.cdr.markForCheck();
            });
    }

    closeCamera(): void {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        this.showCameraModal = false;
        this.capturedImage = null;
        this.cdr.markForCheck();
    }
}
