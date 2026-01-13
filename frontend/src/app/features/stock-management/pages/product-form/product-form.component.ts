import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatStepperModule } from '@angular/material/stepper';
import { ProductService } from '../../services/product.service';
import { GroupsService } from '../../../groups/services/groups.service';
import { CentersService } from '../../../centers/services/centers.service';
import { WarehousesService } from '../../../warehouses/services/warehouses.service';
import { CameraCaptureDialogComponent } from '../../../../shared/components/camera-capture/camera-capture-dialog.component';
import {
    ProductType,
    ProductStatus,
    FrameCategory,
    Gender,
    FrameShape,
    FrameMaterial,
    HingeType,
    FrameType,
    LensType,
    LensMaterial,
    LensTint,
    LensFilter,
    LensTreatment,
    LensIndex,
    ContactLensType,
    ContactLensUsage,
    AccessoryCategory
} from '../../../../shared/interfaces/product.interface';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';
import { Groupe, Centre, Entrepot } from '../../../../shared/interfaces/warehouse.interface';

@Component({
    selector: 'app-product-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        RouterModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        MatCardModule,
        MatTooltipModule,
        MatDialogModule,
        MatProgressSpinnerModule,
        MatStepperModule
    ],
    templateUrl: './product-form.component.html',
    styleUrls: ['./product-form.component.scss']
})
export class ProductFormComponent implements OnInit {
    productForm: FormGroup;
    isEditMode = false;
    productId: string | null = null;
    entrepotId: string | null = null;
    productType: ProductType = ProductType.MONTURE_OPTIQUE;
    isSubmitting = false;

    // Hierarchy Data
    groups: Groupe[] = [];
    centers: Centre[] = [];
    warehouses: Entrepot[] = [];

    // Selected Hierarchy
    selectedGroup: string | null = null;
    selectedCenter: string | null = null;
    selectedWarehouse: string | null = null;

    // Enums for dropdowns
    productTypes = Object.values(ProductType);
    productStatuses = Object.values(ProductStatus);
    frameCategories = Object.values(FrameCategory);
    genders = Object.values(Gender);
    frameShapes = Object.values(FrameShape);
    frameMaterials = Object.values(FrameMaterial);
    hingeTypes = Object.values(HingeType);
    frameTypes = Object.values(FrameType);

    // Lens enums
    lensTypes = Object.values(LensType);
    lensMaterials = Object.values(LensMaterial);
    lensTints = Object.values(LensTint);
    lensFilters = Object.values(LensFilter);
    lensTreatments = Object.values(LensTreatment);
    lensIndices = Object.values(LensIndex);

    // Contact lens enums
    contactLensTypes = Object.values(ContactLensType);
    contactLensUsages = Object.values(ContactLensUsage);

    // Accessory enums
    accessoryCategories = Object.values(AccessoryCategory);

    // Expose enum to template
    ProductType = ProductType;

    constructor(
        private fb: FormBuilder,
        private productService: ProductService,
        private groupsService: GroupsService,
        private centersService: CentersService,
        private warehousesService: WarehousesService,
        public route: ActivatedRoute,
        public router: Router,
        private dialog: MatDialog
    ) {
        this.productForm = this.createForm();
    }

    ngOnInit(): void {
        this.productId = this.route.snapshot.paramMap.get('id');

        if (this.productId) {
            this.isEditMode = true;
            this.loadProduct(this.productId);
        }

        this.route.queryParams.subscribe(params => {
            if (params['entrepotId']) {
                this.entrepotId = params['entrepotId'];
                this.selectedWarehouse = this.entrepotId;
            } else if (!this.isEditMode) {
                // If new product and no context, load hierarchy
                this.loadGroups();
            }
        });

        // Listen to product type changes
        this.productForm.get('typeArticle')?.valueChanges.subscribe(type => {
            this.productType = type;
            this.updateValidators(type);

            // Optional: Regenerate internal code prefix if it was auto-generated and hasn't been manually changed?
            // For simplicity, we only generate if empty or on init.
            if (!this.isEditMode && !this.productForm.get('codeInterne')?.dirty) {
                this.generateInternalCode();
            }
        });

        // Calculate prices automatically
        this.setupPriceCalculations();

        // Initial validator setup
        this.updateValidators(this.productType);

        // Sync Reference and Model
        this.setupRefModelSync();

        // Auto-generate codes for new products
        if (!this.isEditMode) {
            // Use setTimeout to ensure form is fully ready if needed, currently sync is fine
            this.generateInternalCode();
            this.generateBarcode();
        }
    }

    // Hierarchy Management
    loadGroups() {
        this.groupsService.findAll().subscribe(groups => {
            this.groups = groups;
        });
    }

    onGroupChange(groupId: string) {
        this.selectedGroup = groupId;
        this.selectedCenter = null;
        this.selectedWarehouse = null;
        this.entrepotId = null;
        this.centers = [];
        this.warehouses = [];

        if (groupId) {
            this.centersService.findAll(groupId).subscribe(centers => {
                this.centers = centers;
            });
        }
    }

    onCenterChange(centerId: string) {
        console.log('onCenterChange called with:', centerId);
        this.selectedCenter = centerId;
        console.log('selectedCenter set to:', this.selectedCenter);
        this.selectedWarehouse = null;
        this.entrepotId = null;
        this.warehouses = [];

        if (centerId) {
            this.warehousesService.findAll(centerId).subscribe(warehouses => {
                console.log('Warehouses loaded:', warehouses);
                this.warehouses = warehouses;
            });
        }
    }

    onWarehouseChange(warehouseId: string) {
        this.selectedWarehouse = warehouseId;
        this.entrepotId = warehouseId;
    }

    setupPriceCalculations(): void {
        this.productForm.get('prixAchatHT')?.valueChanges.subscribe(() => this.calculatePrices());
        this.productForm.get('coefficient')?.valueChanges.subscribe(() => this.calculatePrices());
        this.productForm.get('tauxTVA')?.valueChanges.subscribe(() => this.calculatePrices());
    }

    openCamera(): void {
        const dialogRef = this.dialog.open(CameraCaptureDialogComponent, {
            width: '600px',
            disableClose: true
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                // Result is a data URL (base64)
                this.productForm.patchValue({ photo: result });
                this.productForm.markAsDirty();
            }
        });
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            const file = input.files[0];
            const reader = new FileReader();

            reader.onload = (e) => {
                const result = e.target?.result as string;
                this.productForm.patchValue({ photo: result });
                this.productForm.markAsDirty();
            };

            reader.readAsDataURL(file);
        }
    }

    removePhoto(): void {
        this.productForm.patchValue({ photo: null });
        this.productForm.markAsDirty();
    }

    createForm(): FormGroup {
        return this.fb.group({
            // Common fields
            typeArticle: [ProductType.MONTURE_OPTIQUE, Validators.required],
            // Disabled by default as requested
            codeInterne: [{ value: '', disabled: true }, Validators.required],
            codeBarres: [{ value: '', disabled: true }],
            referenceFournisseur: [''],
            designation: ['', Validators.required],
            marque: [''],
            modele: [''],


            fournisseurPrincipal: [''],
            photo: [''],

            // Stock & Pricing
            quantiteActuelle: [0, [Validators.required, Validators.min(0)]],
            seuilAlerte: [2, [Validators.required, Validators.min(0)]],
            prixAchatHT: [0, [Validators.required, Validators.min(0)]],
            coefficient: [2.5, [Validators.required, Validators.min(1)]],
            prixVenteHT: [{ value: 0, disabled: true }],
            prixVenteTTC: [{ value: 0, disabled: true }],
            tauxTVA: [0.20, [Validators.required, Validators.min(0)]],
            statut: [ProductStatus.DISPONIBLE],

            // Frame specific fields
            categorie: [''],
            genre: [''],
            forme: [''],
            matiere: [''],
            calibre: [0, Validators.min(0)],
            pont: [0, Validators.min(0)],
            branche: [0, Validators.min(0)],
            typeCharniere: [''],
            typeMonture: [''],
            photoFace: [''],
            photoProfil: [''],

            // Lens specific fields
            typeVerre: [''],
            materiau: [''],
            indiceRefraction: [0],
            teinte: [''],
            filtres: [[]],
            traitements: [[]],
            puissanceSph: [0],
            puissanceCyl: [0],
            axe: [0],
            addition: [0],
            diametre: [0],
            base: [0],
            courbure: [0],
            fabricant: [''],
            familleOptique: [''],

            // Contact Lens specific fields
            typeLentille: [''],
            usage: [''],
            modeleCommercial: [''],
            laboratoire: [''],
            rayonCourbure: [0],
            nombreParBoite: [0],
            prixParBoite: [0],
            prixParUnite: [0],
            numeroLot: [''],
            datePeremption: [''],
            quantiteBoites: [0],
            quantiteUnites: [0],

            // Accessory specific fields
            categorieAccessoire: [''],
            sousCategorie: ['']
        });
    }

    updateValidators(type: ProductType): void {
        // Reset all specific validators
        const frameFields = ['categorie', 'genre', 'forme', 'matiere', 'calibre', 'pont', 'branche', 'typeMonture'];
        const lensFields = ['typeVerre', 'materiau', 'puissanceSph', 'diametre'];
        const contactLensFields = ['typeLentille', 'usage', 'rayonCourbure', 'diametre', 'puissanceSph'];
        const accessoryFields = ['categorieAccessoire'];

        // Include designation to manage its required state dynamically
        const allSpecificFields = ['designation', ...frameFields, ...lensFields, ...contactLensFields, ...accessoryFields];

        allSpecificFields.forEach(field => {
            this.productForm.get(field)?.clearValidators();
            this.productForm.get(field)?.updateValueAndValidity();
        });

        // Add validators based on type
        if (type === ProductType.MONTURE_OPTIQUE || type === ProductType.MONTURE_SOLAIRE) {
            this.productForm.get('designation')?.setValidators(Validators.required);
            this.productForm.get('categorie')?.setValidators(Validators.required);
            this.productForm.get('forme')?.setValidators(Validators.required);
            this.productForm.get('matiere')?.setValidators(Validators.required);
            this.productForm.get('calibre')?.setValidators([Validators.required, Validators.min(1)]);
            this.productForm.get('pont')?.setValidators([Validators.required, Validators.min(1)]);
            this.productForm.get('branche')?.setValidators([Validators.required, Validators.min(1)]);
            this.productForm.get('typeMonture')?.setValidators(Validators.required);
        } else if (type === ProductType.VERRE) {
            // Designation might be auto-generated or optional for lenses?
            // For now, making it optional to pass validation if hidden
            this.productForm.get('typeVerre')?.setValidators(Validators.required);
            this.productForm.get('materiau')?.setValidators(Validators.required);
            this.productForm.get('puissanceSph')?.setValidators(Validators.required);
        } else if (type === ProductType.LENTILLE) {
            // Same for lenses
            this.productForm.get('typeLentille')?.setValidators(Validators.required);
            this.productForm.get('usage')?.setValidators(Validators.required);
            this.productForm.get('puissanceSph')?.setValidators(Validators.required);
        } else if (type === ProductType.ACCESSOIRE) {
            this.productForm.get('designation')?.setValidators(Validators.required); // Required for accessories
            this.productForm.get('categorieAccessoire')?.setValidators(Validators.required);
        }

        // Update validity for relevant fields
        allSpecificFields.forEach(field => {
            this.productForm.get(field)?.updateValueAndValidity();
        });
    }

    // Debug helper
    getInvalidControls(): string[] {
        const invalid = [];
        const controls = this.productForm.controls;
        for (const name in controls) {
            if (controls[name].invalid) {
                invalid.push(name);
            }
        }
        return invalid;
    }

    calculatePrices(): void {
        const prixAchat = this.productForm.get('prixAchatHT')?.value || 0;
        const coefficient = this.productForm.get('coefficient')?.value || 1;
        const tauxTVA = this.productForm.get('tauxTVA')?.value || 0.20;

        const prixVenteHT = this.productService.calculateSellingPrice(prixAchat, coefficient);
        const prixVenteTTC = this.productService.calculatePriceTTC(prixVenteHT, tauxTVA);

        this.productForm.patchValue({
            prixVenteHT: prixVenteHT,
            prixVenteTTC: prixVenteTTC
        }, { emitEvent: false });
    }

    private setupRefModelSync(): void {
        const refControl = this.productForm.get('referenceFournisseur');
        const modelControl = this.productForm.get('modele');

        if (refControl && modelControl) {
            refControl.valueChanges.subscribe(val => {
                const currentModel = modelControl.value;
                if (!currentModel || currentModel === '' || currentModel === refControl.pristine) {
                    modelControl.setValue(val, { emitEvent: false });
                }
            });

            modelControl.valueChanges.subscribe(val => {
                const currentRef = refControl.value;
                if (!currentRef || currentRef === '' || currentRef === modelControl.pristine) {
                    refControl.setValue(val, { emitEvent: false });
                }
            });
        }
    }

    generateBarcode(): void {
        // Generate a simple barcode (EAN-13 format)
        const prefix = '200';
        const random = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
        const code = prefix + random;

        // Calculate EAN-13 checksum
        let sum = 0;
        for (let i = 0; i < 12; i++) {
            sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
        }
        const checksum = (10 - (sum % 10)) % 10;

        this.productForm.patchValue({
            codeBarres: code + checksum
        });
    }

    generateInternalCode(): void {
        const type = this.productForm.get('typeArticle')?.value;
        let prefix = 'PRD';

        switch (type) {
            case ProductType.MONTURE_OPTIQUE:
            case ProductType.MONTURE_SOLAIRE:
                prefix = 'MON';
                break;
            case ProductType.VERRE:
                prefix = 'VER';
                break;
            case ProductType.LENTILLE:
                prefix = 'LEN';
                break;
            case ProductType.ACCESSOIRE:
                prefix = 'ACC';
                break;
        }

        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        this.productForm.patchValue({
            codeInterne: `${prefix}${random}`
        });
    }

    loadProduct(id: string): void {
        this.productService.findOne(id).subscribe(product => {
            if (product) {
                this.productType = product.typeArticle;
                this.entrepotId = product.entrepotId; // Set entrepotId for update
                this.selectedWarehouse = product.entrepotId;

                // Handle Accessory mapping: frontend use 'categorieAccessoire' but backend uses 'categorie'
                if (product.typeArticle === ProductType.ACCESSOIRE && (product as any).categorie) {
                    (product as any).categorieAccessoire = (product as any).categorie;
                }

                // Flatten specificData for form patching
                const formValue = {
                    ...product,
                    ...(product.specificData || {})
                };

                this.productForm.patchValue(formValue);

                // Sync Ref/Model if one is missing
                if (product.referenceFournisseur && !product.modele) {
                    this.productForm.patchValue({ modele: product.referenceFournisseur });
                } else if (product.modele && !product.referenceFournisseur) {
                    this.productForm.patchValue({ referenceFournisseur: product.modele });
                }

                this.calculatePrices();
            }
        });
    }

    onSubmit(): void {
        console.log('Form submitted');

        // Auto-generate codes if missing on submit (fallback)
        if (!this.isEditMode) {
            if (!this.productForm.get('codeInterne')?.value) {
                this.generateInternalCode();
            }
            if (!this.productForm.get('codeBarres')?.value) {
                this.generateBarcode();
            }
        }

        console.log('Form valid:', this.productForm.valid);

        // Use getRawValue() to include disabled fields like codeInterne and codeBarres
        const formValue = this.productForm.getRawValue();
        console.log('Form value (raw):', formValue);

        if (this.productForm.valid) {
            // Check if entrepotId is present for new products
            if (!this.isEditMode && !this.entrepotId) {
                alert("Erreur: Aucun entrepôt sélectionné (paramètre 'entrepotId' manquant). Veuillez passer par la page de l'entrepôt.");
                return;
            }

            const productData = {
                ...formValue,
                entrepotId: this.entrepotId, // Include warehouse ID
                prixVenteHT: this.productForm.get('prixVenteHT')?.value,
                prixVenteTTC: this.productForm.get('prixVenteTTC')?.value,
                utilisateurCreation: 'admin' // TODO: Get from auth service
            };

            if (this.isEditMode && this.productId) {
                console.log('Updating product:', this.productId);
                this.isSubmitting = true;
                this.productService.update(this.productId, productData).subscribe({
                    next: () => {
                        console.log('Product updated');
                        this.isSubmitting = false;
                        this.navigateBack();
                    },
                    error: (error) => {
                        console.error('Error updating product:', error);
                        this.isSubmitting = false;
                        alert('Une erreur est survenue lors de la mise à jour du produit. ' + (error.error?.message || ''));
                    }
                });
            } else {
                console.log('Creating new product');
                this.isSubmitting = true;
                this.productService.create(productData).subscribe({
                    next: (newProduct) => {
                        console.log('Product created:', newProduct);
                        this.isSubmitting = false;
                        this.navigateBack();
                    },
                    error: (error) => {
                        console.error('Error creating product:', error);
                        this.isSubmitting = false;
                        alert('Une erreur est survenue lors de la création du produit. ' + (error.error?.message || ''));
                    }
                });
            }
        } else {
            console.error('Form is invalid. Please check required fields.');
            const invalidControls = this.getInvalidControls();
            alert(`Le formulaire est invalide. Veuillez vérifier les champs suivants : ${invalidControls.join(', ')}`);

            Object.keys(this.productForm.controls).forEach(key => {
                this.productForm.get(key)?.markAsTouched();
            });
        }
    }

    navigateBack(): void {
        if (this.entrepotId) {
            this.router.navigate(['/p/warehouses', this.entrepotId]);
        } else {
            this.router.navigate(['/p/stock']);
        }
    }

    onCancel(): void {
        this.navigateBack();
    }

    formatTypeLabel(type: string | undefined): string {
        if (!type) return '';
        return type.split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
}
