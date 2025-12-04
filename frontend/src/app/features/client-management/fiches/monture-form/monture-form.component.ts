import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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

    ficheForm: FormGroup;
    clientId: string | null = null;
    ficheId: string | null = null;
    activeTab = 0;
    loading = false;
    isEditMode = false;

    // Enums pour les dropdowns
    typesEquipement = Object.values(TypeEquipement);

    // Suggestions IA
    suggestions: SuggestionIA[] = [];
    showSuggestions = false;

    // Fichiers prescription
    prescriptionFiles: PrescriptionFile[] = [];
    viewingFile: PrescriptionFile | null = null;

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

        this.setupPriceListeners();
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
                typeEquipement: [TypeEquipement.VISION_LOIN, Validators.required],
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

                // Champs OD (utilisés si differentODOG = true)
                matiereOD: ['Organique (CR-39)'],
                indiceOD: ['1.50 (Standard)'],
                traitementOD: [['Anti-reflet']],

                // Champs OG (utilisés si differentODOG = true)
                matiereOG: ['Organique (CR-39)'],
                indiceOG: ['1.50 (Standard)'],
                traitementOG: [['Anti-reflet']]
            })
        });
    }

    setupPriceListeners(): void {
        // Écouter les changements pour calculer automatiquement les prix
        this.ficheForm.get('verres.matiere')?.valueChanges.subscribe(() => this.calculateLensPrices());
        this.ficheForm.get('verres.indice')?.valueChanges.subscribe(() => this.calculateLensPrices());
        this.ficheForm.get('verres.traitement')?.valueChanges.subscribe(() => this.calculateLensPrices());

        // Sync logic when switching to split view
        this.ficheForm.get('verres.differentODOG')?.valueChanges.subscribe((isSplit: boolean) => {
            if (isSplit) {
                const verres = this.ficheForm.get('verres')?.value;
                this.ficheForm.get('verres')?.patchValue({
                    matiereOD: verres.matiere,
                    indiceOD: verres.indice,
                    traitementOD: verres.traitement,
                    matiereOG: verres.matiere,
                    indiceOG: verres.indice,
                    traitementOG: verres.traitement
                }, { emitEvent: false });
            }
            this.calculateLensPrices();
        });

        this.ficheForm.get('verres.matiereOG')?.valueChanges.subscribe(() => this.calculateLensPrices());
        this.ficheForm.get('verres.indiceOG')?.valueChanges.subscribe(() => this.calculateLensPrices());
        this.ficheForm.get('verres.traitementOG')?.valueChanges.subscribe(() => this.calculateLensPrices());
        this.ficheForm.get('verres.matiereOD')?.valueChanges.subscribe(() => this.calculateLensPrices());
        this.ficheForm.get('verres.indiceOD')?.valueChanges.subscribe(() => this.calculateLensPrices());
        this.ficheForm.get('verres.traitementOD')?.valueChanges.subscribe(() => this.calculateLensPrices());
    }

    calculateLensPrices(): void {
        const verresGroup = this.ficheForm.get('verres');
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

    checkSuggestion(): void {
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

    applySuggestion(suggestion: SuggestionIA): void {
        const verresGroup = this.ficheForm.get('verres');
        if (!verresGroup) return;

        if (suggestion.type === 'OD') {
            // Update both common and OD specific fields
            verresGroup.patchValue({
                matiere: suggestion.matiere,
                indice: suggestion.indice,
                matiereOD: suggestion.matiere,
                indiceOD: suggestion.indice
            });
        } else {
            // For OG, we must switch to split mode
            verresGroup.patchValue({
                differentODOG: true,
                matiereOG: suggestion.matiere,
                indiceOG: suggestion.indice
            });

            // Also ensure OD fields are populated with current common values if they weren't already
            const currentMatiere = verresGroup.get('matiere')?.value;
            const currentIndice = verresGroup.get('indice')?.value;
            if (currentMatiere) {
                verresGroup.patchValue({
                    matiereOD: currentMatiere,
                    indiceOD: currentIndice
                }, { emitEvent: false });
            }
        }

        this.calculateLensPrices();
    }

    closeSuggestions(): void {
        this.showSuggestions = false;
        this.cdr.markForCheck();
    }

    // File Handling
    openFileUpload(): void {
        this.fileInput.nativeElement.click();
    }

    onFilesSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files) return;

        Array.from(input.files).forEach(file => {
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
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

                // Automatic OCR extraction for images
                if (file.type.startsWith('image/')) {
                    this.extractData(prescriptionFile);
                }

                this.cdr.markForCheck();
            };
            reader.readAsDataURL(file);
        });

        input.value = ''; // Reset input
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
        // Automatic extraction without confirmation
        console.log(`Extraction automatique des données de ${file.name}...`);

        // Simulate OCR extraction (replace with real OCR service)
        setTimeout(() => {
            // Mock extracted data
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

    // Formatage des champs de prescription
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
        const value = input.value.replace(/[^0-9]/g, ''); // Remove non-numeric characters

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
            const formatted = value.toFixed(2); // Prisme usually doesn't need + sign, just decimals
            this.ficheForm.get(`ordonnance.${eye}.prisme`)?.setValue(formatted, { emitEvent: false });
            input.value = formatted;
        }
    }

    formatEPValue(eye: 'od' | 'og', event: Event): void {
        const input = event.target as HTMLInputElement;
        // Remove 'mm' and spaces to parse the number
        const cleanValue = input.value.replace(/[^0-9.]/g, '');
        const value = parseFloat(cleanValue);

        if (!isNaN(value)) {
            const formatted = `${value.toFixed(2)} mm`;
            this.ficheForm.get(`ordonnance.${eye}.ep`)?.setValue(value, { emitEvent: false }); // Keep number in model
            input.value = formatted; // Show formatted in input
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

        const montantTotal =
            formValue.monture.prixMonture +
            formValue.verres.prixOD +
            formValue.verres.prixOG;

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

    goBack(): void {
        if (this.clientId) {
            this.router.navigate(['/clients', this.clientId]);
        } else {
            this.router.navigate(['/clients']);
        }
    }
}
