import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { OcrService } from '../../../../core/services/ocr.service';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-ocr-invoice-import',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatDatepickerModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
        MatTableModule
    ],
    templateUrl: './ocr-invoice-import.component.html',
    styleUrls: ['./ocr-invoice-import.component.scss']
})
export class OcrInvoiceImportComponent implements OnInit {
    documentForm!: FormGroup;
    selectedFile: File | null = null;
    previewUrl: string | null = null;

    // OCR State
    ocrProcessing = false;
    ocrError: string | null = null;
    analyzedText = '';
    detectedLines: any[] = [];

    // Data
    suppliers$!: Observable<any[]>;

    // Column Mapping
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

    columnMappings: { [key: number]: string } = {};
    splitLines: any[] = [];
    maxColumns = 0;

    displayedColumns = ['designation', 'quantity', 'price', 'actions'];

    constructor(
        private fb: FormBuilder,
        private ocrService: OcrService,
        private snackBar: MatSnackBar,
        private router: Router
    ) { }

    ngOnInit() {
        this.documentForm = this.fb.group({
            fournisseurId: [null],
            type: ['FACTURE', Validators.required],
            numero: ['', Validators.required],
            date: [new Date(), Validators.required]
        });

        // Suppliers will be loaded via API in production
        // For now, using empty observable
        this.suppliers$ = new Observable(observer => {
            observer.next([]);
            observer.complete();
        });
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.selectedFile = file;

            // Create preview
            const reader = new FileReader();
            reader.onload = (e: any) => {
                this.previewUrl = e.target.result;
            };
            reader.readAsDataURL(file);

            // Process OCR
            this.processOCR(file);
        }
    }

    async processOCR(file: File) {
        this.ocrProcessing = true;
        this.ocrError = null;
        this.detectedLines = [];

        try {
            const result = await this.ocrService.recognizeText(file);

            if (result.error) {
                this.ocrError = result.error;
                return;
            }

            this.analyzedText = result.text || '';

            // Auto-fill form fields
            if (result.invoiceNumber) {
                this.documentForm.patchValue({ numero: result.invoiceNumber });
            }

            if (result.invoiceDate) {
                this.documentForm.patchValue({ date: new Date(result.invoiceDate) });
            }

            if (result.supplierName) {
                // Try to find supplier by name
                this.suppliers$.subscribe(suppliers => {
                    const found = suppliers.find(s =>
                        s.nom.toLowerCase().includes(result.supplierName.toLowerCase())
                    );
                    if (found) {
                        this.documentForm.patchValue({ fournisseurId: found.id });
                    }
                });
            }

            // Extract lines and split into columns with improved logic
            if (result.lines && result.lines.length > 0) {
                this.splitLines = result.lines.map((line: any) => {
                    const rawText = line.raw || line.description || '';
                    let columns: string[] = [];

                    // Strategy 1: Split by pipe character
                    if (rawText.includes('|')) {
                        columns = rawText.split('|').map((c: string) => c.trim()).filter((c: string) => c);
                    }
                    // Strategy 2: Split by tab
                    else if (rawText.includes('\t')) {
                        columns = rawText.split('\t').map((c: string) => c.trim()).filter((c: string) => c);
                    }
                    // Strategy 3: Split by 3+ spaces
                    else if (/\s{3,}/.test(rawText)) {
                        columns = rawText.split(/\s{3,}/).map((c: string) => c.trim()).filter((c: string) => c);
                    }
                    // Strategy 4: Smart pattern-based split
                    else {
                        const parts: string[] = [];
                        let remaining = rawText.trim();

                        // Extract code at start (alphanumeric with dashes/slashes)
                        const codeMatch = remaining.match(/^([A-Z0-9\-\/\.]+)\s+/i);
                        if (codeMatch) {
                            parts.push(codeMatch[1]);
                            remaining = remaining.substring(codeMatch[0].length);
                        }

                        // Extract numbers at end (prices, quantities, percentages)
                        const trailingNumbers: string[] = [];
                        // Match patterns like: 1045.00, 15.00%, 888.25
                        const numberPattern = /\s+([\d\.,]+%?)\s*$/;
                        let match;
                        while ((match = numberPattern.exec(remaining)) !== null) {
                            trailingNumbers.unshift(match[1]);
                            remaining = remaining.substring(0, match.index);
                        }

                        // Middle part is description - split if has 2+ spaces
                        if (remaining.trim()) {
                            if (/\s{2,}/.test(remaining)) {
                                const descParts = remaining.split(/\s{2,}/).filter((c: string) => c.trim());
                                parts.push(...descParts);
                            } else {
                                parts.push(remaining.trim());
                            }
                        }

                        parts.push(...trailingNumbers);
                        columns = parts.filter((c: string) => c);
                    }

                    // Fallback: single column
                    if (columns.length === 0) {
                        columns = [rawText];
                    }

                    console.log('Split result:', { raw: rawText, columns });

                    return {
                        columns: columns,
                        originalLine: line,
                        raw: rawText
                    };
                });

                // Calculate max columns
                this.maxColumns = Math.max(...this.splitLines.map(l => l.columns.length));
                console.log('Max columns:', this.maxColumns);

                // Initialize default mappings
                if (Object.keys(this.columnMappings).length === 0) {
                    this.initializeDefaultMappings();
                }

                // Update detectedLines for backward compatibility
                this.detectedLines = this.splitLines.map(splitLine => ({
                    designation: splitLine.raw,
                    quantity: splitLine.originalLine.quantity || 1,
                    price: splitLine.originalLine.priceCandidates?.[0] || 0,
                    raw: splitLine.raw
                }));
            }

            this.snackBar.open(`✅ OCR réussi : ${this.detectedLines.length} ligne(s) détectée(s)`, 'OK', {
                duration: 3000
            });

        } catch (err: any) {
            console.error('OCR Failed', err);
            this.ocrError = err.message || 'Erreur lors de l\'analyse OCR';
            this.snackBar.open('❌ Erreur OCR : ' + this.ocrError, 'Fermer', {
                duration: 5000
            });
        } finally {
            this.ocrProcessing = false;
        }
    }

    removeLine(index: number) {
        this.splitLines.splice(index, 1);
        this.detectedLines.splice(index, 1);
    }

    clearDocument() {
        this.selectedFile = null;
        this.previewUrl = null;
        this.detectedLines = [];
        this.splitLines = [];
        this.columnMappings = {};
        this.maxColumns = 0;
        this.ocrError = null;
        this.analyzedText = '';
    }

    viewDocument() {
        if (this.selectedFile) {
            const url = URL.createObjectURL(this.selectedFile);
            window.open(url, '_blank');
        }
    }


    reSplit(strategy: 'spaces' | 'smart' | 'tabs') {
        if (!this.detectedLines || this.detectedLines.length === 0) return;

        console.log('Re-splitting with strategy:', strategy);

        this.splitLines = this.splitLines.map(line => {
            const rawText = line.raw; // Use stored raw text
            let columns: string[] = [];

            if (strategy === 'spaces') {
                // Force split by ANY whitespace including non-breaking spaces
                columns = rawText.trim().split(/[\s\u00A0]+/).filter((c: string) => c.trim().length > 0);
            }
            else if (strategy === 'tabs') {
                columns = rawText.split('\t').map((c: string) => c.trim()).filter((c: string) => c);
            }
            else { // Smart
                columns = rawText.split(/\s{3,}/).map((c: string) => c.trim()).filter((c: string) => c);
            }

            // CLEANUP: Remove common OCR noise artifacts from EACH column
            columns = columns.map(c => c.replace(/^[\]\)}|]+|[\]\)}|]+$/g, ''));

            if (columns.length === 0) columns = [rawText];

            return {
                ...line,
                columns: columns
            };
        });

        this.maxColumns = Math.max(...this.splitLines.map(l => l.columns.length));
        this.initializeDefaultMappings();

        this.snackBar.open(`Redécoupage effectué : ${strategy}`, 'OK', { duration: 2000 });
    }

    initializeDefaultMappings() {
        // Try to auto-detect column types for granular split
        // Typical structure: CODE TYPE BRAND REFERENCE PRICE ...
        if (this.maxColumns >= 5) {
            this.columnMappings[0] = 'code';
            this.columnMappings[1] = 'marque';
            this.columnMappings[2] = 'reference';

            // Guess last columns are numbers (Price/Qty)
            this.columnMappings[this.maxColumns - 1] = 'prixUnitaire';
            this.columnMappings[this.maxColumns - 2] = 'remise';
        } else {
            // Safer defaults for fewer columns
            this.columnMappings[0] = 'code';
            this.columnMappings[1] = 'designation';
            if (this.maxColumns > 2) {
                this.columnMappings[this.maxColumns - 1] = 'prixUnitaire';
            }
        }
    }

    getColumnArray(): number[] {
        return Array.from({ length: this.maxColumns }, (_, i) => i);
    }

    applyMappings() {
        // Rebuild detectedLines based on column mappings
        this.detectedLines = this.splitLines.map(splitLine => {
            const mapped: any = {
                raw: splitLine.raw,
                designation: '',
                categorie: '',
                quantity: 1,
                price: 0
            };

            splitLine.columns.forEach((col: string, index: number) => {
                const mapping = this.columnMappings[index];
                if (!mapping || mapping === 'ignore') return;

                switch (mapping) {
                    case 'code':
                        mapped.code = col;
                        break;
                    case 'marque':
                        mapped.marque = col;
                        break;
                    case 'categorie':
                        mapped.categorie = col;
                        break;
                    case 'reference':
                        mapped.reference = col;
                        break;
                    case 'designation':
                        mapped.designation = (mapped.designation ? mapped.designation + ' ' : '') + col;
                        break;
                    case 'quantity':
                        // Keep digits, dots, commas. Remove currency symbols, %, etc.
                        mapped.quantity = parseFloat(col.replace(/[^\d.,]/g, '').replace(',', '.')) || 1;
                        break;
                    case 'prixUnitaire':
                        // Aggressive cleanup: remove everything except digits, dots and commas
                        mapped.price = parseFloat(col.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
                        break;
                    case 'remise':
                        // User request: "% reste symbole remise" - preserve % symbol functionality
                        // Allow digits, dots, commas, AND % symbol
                        mapped.remise = parseFloat(col.replace(/[^\d.,%]/g, '').replace(',', '.')) || 0;
                        break;
                    case 'prixRemise':
                        mapped.prixRemise = parseFloat(col.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
                        break;
                }
            });

            // If no designation was mapped, use the full raw text
            if (!mapped.designation) {
                mapped.designation = splitLine.raw;
            }

            return mapped;
        });

        this.snackBar.open('✅ Mapping appliqué avec succès', 'OK', { duration: 2000 });
    }

    validateAndImport() {
        if (this.documentForm.invalid) {
            this.snackBar.open('⚠️ Veuillez remplir tous les champs obligatoires', 'Fermer', {
                duration: 3000
            });
            return;
        }

        if (this.detectedLines.length === 0) {
            this.snackBar.open('⚠️ Aucune ligne détectée. Veuillez ajouter des produits.', 'Fermer', {
                duration: 3000
            });
            return;
        }

        // Navigate to stock entry with pre-filled data
        const formData = this.documentForm.value;
        this.router.navigate(['/p/stock/entry-v2'], {
            state: {
                ocrData: {
                    ...formData,
                    lines: this.detectedLines
                }
            }
        });
    }

    trackByIndex(index: number, obj: any): any {
        return index;
    }
}
