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
import { BehaviorSubject } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { StockAlimentationDialogComponent, AlimentationResult } from '../../components/stock-alimentation-dialog/stock-alimentation-dialog.component';
import { CameraCaptureDialogComponent } from '../../../../shared/components/camera-capture/camera-capture-dialog.component';
import { OcrService } from '../../../../core/services/ocr.service';

export interface StagedProduct {
    id?: string; // If existing product found
    tempId: string; // Unique ID for table management
    reference: string;
    nom: string;
    marque: string;
    categorie: string; // 'MONTURE', 'VERRE', etc.
    quantite: number;
    prixAchat: number;
    tva: number; // 0 or 20
    // Pricing Mode
    modePrix: 'FIXE' | 'COEFF';
    coefficient?: number;
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
        MatTooltipModule
    ],
    templateUrl: './stock-entry-v2.component.html',
    styleUrls: ['./stock-entry-v2.component.scss']
})
export class StockEntryV2Component implements OnInit {
    // Forms
    entryForm: FormGroup;
    documentForm: FormGroup;

    // Staging Data
    stagedProducts: StagedProduct[] = [];
    productsSubject = new BehaviorSubject<StagedProduct[]>([]);
    displayedColumns: string[] = ['reference', 'nom', 'quantite', 'prixAchat', 'modePrix', 'prixVente', 'actions'];

    // OCR State
    ocrProcessing = false;
    analyzedText = '';

    constructor(
        private fb: FormBuilder,
        private ocrService: OcrService,
        private snackBar: MatSnackBar,
        private dialog: MatDialog
    ) {
        this.entryForm = this.fb.group({
            reference: ['', Validators.required],
            nom: ['', Validators.required],
            marque: [''],
            categorie: ['MONTURE', Validators.required],
            quantite: [1, [Validators.required, Validators.min(1)]],
            prixAchat: [0, [Validators.required, Validators.min(0)]],
            tva: [20, Validators.required],
            modePrix: ['FIXE', Validators.required], // FIXE or COEFF
            coefficient: [2.5],
            prixVente: [0, Validators.required]
        });

        this.documentForm = this.fb.group({
            type: ['FACTURE', Validators.required], // FACTURE or BL
            numero: [''],
            date: [new Date()],
            file: [null]
        });
    }

    ngOnInit(): void {
        // Auto-calculate selling price when Purchase Price or Coef changes
        this.entryForm.valueChanges.subscribe(val => {
            if (val.modePrix === 'COEFF' && val.prixAchat && val.coefficient) {
                const calculatedPrice = val.prixAchat * val.coefficient;
                // avoid infinite loop if no change
                if (Math.abs(calculatedPrice - val.prixVente) > 0.01) {
                    this.entryForm.patchValue({ prixVente: parseFloat(calculatedPrice.toFixed(2)) }, { emitEvent: false });
                }
            }
        });

        // Inverse: If Prix Vente changes manually in Coeff mode (optional UX choice: update coef?)
        // For now, let's keep Coeff master if Mode IS Coeff.
    }

    // --- Staging Logic ---

    openAlimentationDialog() {
        if (this.stagedProducts.length === 0) return;

        const dialogRef = this.dialog.open(StockAlimentationDialogComponent, {
            width: '850px',
            maxHeight: '90vh',
            data: { products: [...this.stagedProducts] }
        });

        dialogRef.afterClosed().subscribe((result: AlimentationResult) => {
            if (result) {
                console.log('📦 Committing Stock Entry:', result);
                this.snackBar.open('Stock alimenté avec succès (Simulation)', 'OK', { duration: 3000 });
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
            ...val
        };

        this.stagedProducts = [...this.stagedProducts, product];
        this.productsSubject.next(this.stagedProducts);

        this.entryForm.reset({
            categorie: 'MONTURE',
            quantite: 1,
            prixAchat: 0,
            tva: 20,
            modePrix: 'FIXE',
            coefficient: 2.5,
            prixVente: 0
        });
    }

    removeProduct(tempId: string) {
        this.stagedProducts = this.stagedProducts.filter(p => p.tempId !== tempId);
        this.productsSubject.next(this.stagedProducts);
    }

    updateProduct(element: StagedProduct) {
        // Recalculate if in Coefficient mode
        if (element.modePrix === 'COEFF' && element.coefficient) {
            element.prixVente = parseFloat((element.prixAchat * element.coefficient).toFixed(2));
        }

        // Notify subject
        this.productsSubject.next(this.stagedProducts);
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

    async processOCR(file: File) {
        this.ocrProcessing = true;
        this.detectedLines = [];
        this.analyzedText = '';

        try {
            // Pass file directly; service handles PDF/Image logic
            const result = await this.ocrService.recognizeText(file);

            this.analyzedText = result.rawText;
            this.detectedLines = result.lines || [];
            this.showOcrData = true;

            console.log('🔍 OCR Extraction:', result);
            this.snackBar.open('Analyse terminée. Vérifiez les données détectées.', 'OK', { duration: 3000 });

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

    useDetectedLine(line: any) {
        // Use structured fields if available, otherwise fallback to raw logic
        const finalPrice = line.computedPrice || (line.priceCandidates && line.priceCandidates[0]) || 0;
        const reference = line.reference || '';
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

        let rawNom = cleanDesignation(line.designation || line.raw || '', reference, line.qty || 1, finalPrice, line.discount || 0);

        // Split designation into Marque and Nom
        let marque = '';
        let nom = rawNom;

        if (nom.includes(' ')) {
            const parts = nom.split(/\s+/);
            // In these invoices, the first word after the code is usually the brand (CH-HER)
            marque = parts[0];
            nom = parts.slice(1).join(' ');
        }

        this.entryForm.patchValue({
            reference: reference,
            nom: nom,
            marque: marque,
            quantite: line.qty || 1,
            prixAchat: finalPrice
        });
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

        this.detectedLines.forEach(line => {
            const prixAchat = line.computedPrice || (line.priceCandidates && line.priceCandidates[0]) || 0;
            const reference = line.reference || '';
            const rawNom = cleanDesignation(line.designation || line.raw || '', reference, line.qty || 1, prixAchat, line.discount || 0);

            let marque = '';
            let nom = rawNom;
            if (nom.includes(' ')) {
                const parts = nom.split(/\s+/);
                marque = parts[0];
                nom = parts.slice(1).join(' ');
            }

            const product: StagedProduct = {
                tempId: crypto.randomUUID(),
                reference: reference,
                nom: nom,
                marque: marque,
                categorie: 'MONTURE', // Default
                quantite: line.qty || 1,
                prixAchat: prixAchat,
                tva: 20, // Default
                modePrix: 'COEFF',
                coefficient: 2.5,
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
