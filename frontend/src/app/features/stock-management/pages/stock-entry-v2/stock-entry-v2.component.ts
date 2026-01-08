import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { StockAlimentationDialogComponent, AlimentationResult } from '../../components/stock-alimentation-dialog/stock-alimentation-dialog.component';
import { CameraCaptureDialogComponent } from '../../../../shared/components/camera-capture/camera-capture-dialog.component';
import { OcrService } from '../../../../core/services/ocr.service';
import { FinanceService } from '../../../finance/services/finance.service';
import { Supplier } from '../../../finance/models/finance.models';

export interface StagedProduct {
    id?: string; // If existing product found
    tempId: string; // Unique ID for table management
    reference: string; // Référence Produit
    codeBarre?: string; // Code Barre (Manuel ou Scanné)
    nom: string;
    marque: string;
    categorie: string; // 'MONTURE', 'VERRE', etc.
    quantite: number;
    prixAchat: number;
    tva: number; // 0 or 20
    // Pricing Mode
    modePrix: 'FIXE' | 'COEFF';
    coefficient?: number;
    margeFixe?: number;
    prixVente: number;
}

@Component({
    selector: 'app-stock-entry-v2',
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
        MatTableModule,
        MatCheckboxModule,
        MatRadioModule,
        MatTabsModule,
        MatDividerModule,
        MatSnackBarModule,
        MatTooltipModule,
        MatDialogModule // Added MatDialogModule as it's used
    ],
    templateUrl: './stock-entry-v2.component.html',
    styleUrls: ['./stock-entry-v2.component.scss']
})
export class StockEntryV2Component implements OnInit {
    // Forms
    entryForm: FormGroup;
    documentForm: FormGroup;
    batchPricingForm: FormGroup;

    // List of common Moroccan TVA rates
    tvaOptions = [20, 14, 10, 7, 0];

    // Staging Data
    stagedProducts: StagedProduct[] = [];
    productsSubject = new BehaviorSubject<StagedProduct[]>([]);
    displayedColumns: string[] = ['reference', 'codeBarre', 'marque', 'nom', 'categorie', 'quantite', 'prixAchat', 'tva', 'modePrix', 'prixVente', 'actions'];

    // OCR State
    ocrProcessing = false;
    analyzedText = '';

    // Data lists
    suppliers$!: Observable<Supplier[]>;

    constructor(
        private fb: FormBuilder,
        private ocrService: OcrService,
        private financeService: FinanceService,
        private snackBar: MatSnackBar,
        private dialog: MatDialog
    ) {
        this.entryForm = this.fb.group({
            reference: ['', Validators.required],
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
            prixVente: [0, Validators.required]
        });

        this.documentForm = this.fb.group({
            type: ['FACTURE', Validators.required], // FACTURE or BL
            fournisseurId: ['', Validators.required],
            numero: [''],
            date: [new Date()],
            file: [null]
        });

        this.batchPricingForm = this.fb.group({
            modePrix: ['COEFF'],
            coefficient: [2.5],
            margeFixe: [0]
        });
    }

    ngOnInit(): void {
        this.suppliers$ = this.financeService.getSuppliers().pipe(
            tap((suppliers: any[]) => console.log('[StockEntryV2] Suppliers loaded:', suppliers?.length)),
            catchError((err: any) => {
                console.error('[StockEntryV2] Error loading suppliers:', err);
                this.snackBar.open('Erreur lors du chargement des fournisseurs', 'OK', { duration: 5000 });
                return of([]);
            })
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

        // Inverse: If Prix Vente changes manually in Coeff mode (optional UX choice: update coef?)
        // For now, let's keep Coeff master if Mode IS Coeff.
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
                document: this.documentForm.getRawValue()
            }
        });

        dialogRef.afterClosed().subscribe((result: any) => {
            if (result && result.success) {
                this.stagedProducts = [];
                this.productsSubject.next([]);
                this.documentForm.reset({ type: 'FACTURE', date: new Date() });
            }
        });
    }

    // --- Staging Logic ---

    addProduct() {
        if (this.entryForm.invalid) return;

        const val = this.entryForm.getRawValue();
        const product: StagedProduct = {
            tempId: crypto.randomUUID(),
            codeBarre: val.codeBarre, // New field mapping
            ...val
        };

        this.stagedProducts = [...this.stagedProducts, product];
        this.productsSubject.next(this.stagedProducts);

        this.entryForm.reset({
            categorie: 'MONTURE_OPTIQUE',
            quantite: 1,
            prixAchat: 0,
            tva: 20,
            modePrix: 'FIXE',
            coefficient: 2.5,
            margeFixe: 0,
            prixVente: 0,
            codeBarre: '' // Reset codeBarre
        });
    }

    removeProduct(tempId: string) {
        this.stagedProducts = this.stagedProducts.filter(p => p.tempId !== tempId);
        this.productsSubject.next(this.stagedProducts);
    }

    updateProduct(element: StagedProduct) {
        // Recalculate based on mode
        if (element.modePrix === 'COEFF' && element.coefficient) {
            element.prixVente = parseFloat((element.prixAchat * element.coefficient).toFixed(2));
        } else if (element.modePrix === 'FIXE' && element.margeFixe !== undefined) {
            element.prixVente = parseFloat((Number(element.prixAchat) + Number(element.margeFixe)).toFixed(2));
        }

        // Notify subject
        this.productsSubject.next(this.stagedProducts);
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
        });

        this.productsSubject.next(this.stagedProducts);
        this.snackBar.open(`Tarification appliquée à ${this.stagedProducts.length} article(s)`, 'OK', { duration: 2000 });
    }
    // --- OCR Logic (Max Best Effort) ---

    // OCR Logic
    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.documentForm.patchValue({ file });
            this.processOCR(file);
        }
    }

    detectedLines: any[] = [];
    showOcrData = false;
    ocrError: string | null = null;

    async processOCR(file: File) {
        this.ocrProcessing = true;
        this.detectedLines = [];
        this.analyzedText = '';
        this.ocrError = null;

        try {
            // Pass file directly; service handles PDF/Image logic
            const result = await this.ocrService.recognizeText(file);

            if (result.error) {
                this.ocrError = result.error;
            }

            this.analyzedText = result.rawText;
            this.detectedLines = result.lines || [];
            this.showOcrData = true;

            if (!result.error) {
                this.snackBar.open('Analyse terminée. Vérifiez les données détectées.', 'OK', { duration: 3000 });
            }

            if (result.date) {
                this.documentForm.patchValue({ date: result.date });
            }

            // Auto-open OCR panel if lines found
            if (this.detectedLines.length > 0) {
                // Logic handled in template via *ngIf
            }


        } catch (err) {
            console.error('OCR Failed', err);
            this.snackBar.open('Erreur lors de l\'analyse du document', 'Fermer');
        } finally {
            this.ocrProcessing = false;
        }
    }

    // --- Camera Logic ---
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
                this.snackBar.open('Document scanné avec succès', 'OK', { duration: 2000 });

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

    private determineCategory(text: string): string {
        const lower = text.toLowerCase();
        if (lower.includes('solaire')) return 'MONTURE_SOLAIRE';
        if (lower.includes('verre')) return 'VERRE';
        if (lower.includes('optique')) return 'MONTURE_OPTIQUE';
        if (lower.includes('lentille')) return 'LENTILLE';
        // Default fallback changed to ACCESSOIRE per user request
        return 'ACCESSOIRE';
    }

    useDetectedLine(line: any) {
        // Use structured fields if available, otherwise fallback to raw logic
        const finalPrice = line.computedPrice || (line.priceCandidates && line.priceCandidates[0]) || 0;
        let reference = line.reference || '';
        const rawContent = line.raw || '';

        // --- LOGIC UPDATE: Handle Barcode vs Reference ---
        let codeBarre = '';

        // If 'reference' or raw string looks like a EAN/UPC (8, 12, 13 digits), consider it a barcode
        // "si dans une facture fournisseur on trouve un code, on peut le considerer comme un code a barre"
        const isBarcode = (str: string) => /^\d{8}$|^\d{12,14}$/.test(str?.trim());

        if (isBarcode(rawContent)) {
            codeBarre = rawContent.trim();
            // If the raw content was JUST a detected barcode, don't use it as reference
            if (reference === rawContent) reference = '';
        } else if (isBarcode(reference)) {
            codeBarre = reference;
            reference = ''; // Move it to codeBarre
        }

        // Create a cleaner function to remove detected values from name
        const cleanDesignation = (text: string, ref: string, qty: number, price: number, disc: number) => {
            let t = text;
            if (ref) t = t.replace(ref, '').trim();
            // Remove Qty + Price + Discount if they appear at the end or as a block
            // We use a regex to find numbers matching our values
            const valuesToStrip = [qty.toString(), price.toFixed(2), disc.toFixed(2), disc.toString()];
            valuesToStrip.forEach(v => {
                if (v && v !== '0') {
                    const escaped = v.replace(/\./g, '\\.');
                    t = t.replace(new RegExp('\\s+' + escaped + '(%|f|DH|MAD)?', 'gi'), '');
                }
            });
            return t.trim();
        };

        // Use line.designation if available (from parser), else raw
        const textToClean = line.designation || line.raw || '';
        let rawNom = cleanDesignation(textToClean, reference, line.qty || 1, finalPrice, line.discount || 0);

        // Split designation into Marque and Nom
        let marque = '';
        let nom = rawNom;
        // Basic heuristic: First word is often Brand if uppercase
        if (nom.includes(' ') && nom.split(' ')[0] === nom.split(' ')[0].toUpperCase() && nom.split(' ')[0].length > 2) {
            const parts = nom.split(/\s+/);
            marque = parts[0];
            nom = parts.slice(1).join(' ');
        }

        // Auto-detect category
        const categorie = this.determineCategory(rawContent);

        this.entryForm.patchValue({
            reference: reference, // Supplier Ref
            codeBarre: codeBarre, // Detected Barcode
            nom: nom,
            marque: marque,
            categorie: categorie,
            quantite: line.qty || 1,
            prixAchat: finalPrice,
            tva: 20
        });

        // Trigger price verification
        this.entryForm.markAsDirty();
    }


    addAllDetectedLines() {
        const newProducts: StagedProduct[] = [];

        // Create a cleaner function to remove detected values from name
        const cleanDesignation = (text: string, ref: string, qty: number, price: number, disc: number) => {
            let t = text;
            if (ref) t = t.replace(ref, '').trim();
            const valuesToStrip = [qty.toString(), price.toFixed(2), disc.toFixed(2), disc.toString()];
            valuesToStrip.forEach(v => {
                if (v && v !== '0') {
                    const escaped = v.replace(/\./g, '\\.');
                    t = t.replace(new RegExp('\\s+' + escaped + '(%|f|DH|MAD)?', 'gi'), '');
                }
            });
            return t.trim();
        };

        const defaultTva = this.entryForm.get('tva')?.value || 20;

        this.detectedLines.forEach(line => {
            const prixAchat = line.computedPrice || (line.priceCandidates && line.priceCandidates[0]) || 0;
            const reference = line.reference || '';
            const rawContent = line.raw || '';

            // Handle Barcode Logic for Bulk too? Maybe keep simple for now or mirror
            let codeBarre = '';
            const isBarcode = (str: string) => /^\d{8}$|^\d{12,14}$/.test(str?.trim());
            if (isBarcode(rawContent)) codeBarre = rawContent.trim(); // Simplified

            const rawNom = cleanDesignation(line.designation || rawContent, reference, line.qty || 1, prixAchat, line.discount || 0);

            let marque = '';
            let nom = rawNom;
            if (nom.includes(' ')) {
                const parts = nom.split(/\s+/);
                marque = parts[0];
                nom = parts.slice(1).join(' ');
            }

            // Auto-detect category
            const categorie = this.determineCategory(rawContent);

            const product: StagedProduct = {
                tempId: crypto.randomUUID(),
                reference: reference,
                codeBarre: codeBarre,
                nom: nom,
                marque: marque,
                categorie: categorie,
                quantite: line.qty || 1,
                prixAchat: prixAchat,
                tva: defaultTva,
                modePrix: 'COEFF',
                coefficient: 2.5,
                margeFixe: 0,
                prixVente: parseFloat((prixAchat * 2.5).toFixed(2))
            };

            newProducts.push(product);
        });

        this.stagedProducts = [...this.stagedProducts, ...newProducts];
        this.productsSubject.next(this.stagedProducts);
        this.snackBar.open(`${newProducts.length} articles ajoutés au panier`, 'OK', { duration: 3000 });

        // Clear results after successful bulk addition
        this.detectedLines = [];
        this.showOcrData = false;
    }
}
