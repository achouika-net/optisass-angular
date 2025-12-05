import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { ProductService } from '../services/product.service';
import {
    Frame,
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
} from '../../../shared/interfaces/product.interface';

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
        MatCardModule
    ],
    templateUrl: './product-form.component.html',
    styleUrls: ['./product-form.component.scss']
})
export class ProductFormComponent implements OnInit {
    productForm: FormGroup;
    isEditMode = false;
    productId: string | null = null;
    productType: ProductType = ProductType.MONTURE;

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

    constructor(
        private fb: FormBuilder,
        private productService: ProductService,
        private route: ActivatedRoute,
        private router: Router
    ) {
        this.productForm = this.createForm();
    }

    ngOnInit(): void {
        this.productId = this.route.snapshot.paramMap.get('id');
        if (this.productId) {
            this.isEditMode = true;
            this.loadProduct(this.productId);
        }

        // Listen to product type changes
        this.productForm.get('typeArticle')?.valueChanges.subscribe(type => {
            this.productType = type;
            this.updateValidators(type);
        });

        // Listen to price changes for automatic calculation
        this.productForm.get('prixAchatHT')?.valueChanges.subscribe(() => this.calculatePrices());
        this.productForm.get('coefficient')?.valueChanges.subscribe(() => this.calculatePrices());
        this.productForm.get('tauxTVA')?.valueChanges.subscribe(() => this.calculatePrices());
    }

    createForm(): FormGroup {
        return this.fb.group({
            // Common fields
            typeArticle: [ProductType.MONTURE, Validators.required],
            codeInterne: ['', Validators.required],
            codeBarres: [''],
            referenceFournisseur: [''],
            designation: ['', Validators.required],
            marque: [''],
            modele: [''],
            couleur: [''],
            famille: [''],
            sousFamille: [''],
            fournisseurPrincipal: [''],

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
            couleurMonture: [''],
            couleurBranches: [''],
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

        const allSpecificFields = [...frameFields, ...lensFields, ...contactLensFields, ...accessoryFields];

        allSpecificFields.forEach(field => {
            this.productForm.get(field)?.clearValidators();
            this.productForm.get(field)?.updateValueAndValidity();
        });

        // Add validators based on type
        if (type === ProductType.MONTURE) {
            this.productForm.get('categorie')?.setValidators(Validators.required);
            this.productForm.get('forme')?.setValidators(Validators.required);
            this.productForm.get('matiere')?.setValidators(Validators.required);
            this.productForm.get('calibre')?.setValidators([Validators.required, Validators.min(1)]);
            this.productForm.get('pont')?.setValidators([Validators.required, Validators.min(1)]);
            this.productForm.get('branche')?.setValidators([Validators.required, Validators.min(1)]);
            this.productForm.get('typeMonture')?.setValidators(Validators.required);
        } else if (type === ProductType.VERRE) {
            this.productForm.get('typeVerre')?.setValidators(Validators.required);
            this.productForm.get('materiau')?.setValidators(Validators.required);
            this.productForm.get('puissanceSph')?.setValidators(Validators.required);
        } else if (type === ProductType.LENTILLE) {
            this.productForm.get('typeLentille')?.setValidators(Validators.required);
            this.productForm.get('usage')?.setValidators(Validators.required);
            this.productForm.get('puissanceSph')?.setValidators(Validators.required);
        } else if (type === ProductType.ACCESSOIRE) {
            this.productForm.get('categorieAccessoire')?.setValidators(Validators.required);
        }

        // Update validity for relevant fields
        allSpecificFields.forEach(field => {
            this.productForm.get(field)?.updateValueAndValidity();
        });
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
            case ProductType.MONTURE:
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
                this.productForm.patchValue(product);
                this.calculatePrices();
            }
        });
    }

    onSubmit(): void {
        console.log('Form submitted');
        console.log('Form valid:', this.productForm.valid);
        console.log('Form value:', this.productForm.value);

        if (this.productForm.valid) {
            const productData = {
                ...this.productForm.value,
                prixVenteHT: this.productForm.get('prixVenteHT')?.value,
                prixVenteTTC: this.productForm.get('prixVenteTTC')?.value,
                utilisateurCreation: 'admin' // TODO: Get from auth service
            };

            if (this.isEditMode && this.productId) {
                console.log('Updating product:', this.productId);
                this.productService.update(this.productId, productData).subscribe(() => {
                    console.log('Product updated, navigating to /p/stock');
                    this.router.navigate(['/p/stock']);
                });
            } else {
                console.log('Creating new product');
                this.productService.create(productData).subscribe((newProduct) => {
                    console.log('Product created:', newProduct);
                    this.router.navigate(['/p/stock']);
                });
            }
        } else {
            console.error('Form is invalid. Please check required fields.');
            Object.keys(this.productForm.controls).forEach(key => {
                this.productForm.get(key)?.markAsTouched();
            });
        }
    }

    onCancel(): void {
        this.router.navigate(['/p/stock']);
    }
}
