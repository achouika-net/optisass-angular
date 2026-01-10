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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, shareReplay, switchMap, tap } from 'rxjs/operators';
import { Product, ProductType, ProductFilters, StockStats } from '../../../../shared/interfaces/product.interface';
import { Entrepot } from '../../../../shared/interfaces/warehouse.interface';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { StockAlimentationDialogComponent, AlimentationResult } from '../../components/stock-alimentation-dialog/stock-alimentation-dialog.component';
import { CameraCaptureDialogComponent } from '../../../../shared/components/camera-capture/camera-capture-dialog.component';
import { OcrService } from '../../../../core/services/ocr.service';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';
import { FinanceService } from '../../../finance/services/finance.service';
import { Supplier } from '../../../finance/models/finance.models';
import { ProductService } from '../../services/product.service';
import { WarehousesService } from '../../../warehouses/services/warehouses.service';
import { SelectionModel } from '@angular/cdk/collections';
import { BulkStockOutDialogComponent } from '../../dialogs/bulk-stock-out-dialog/bulk-stock-out-dialog.component';
import { BulkStockTransferDialogComponent } from '../../dialogs/bulk-stock-transfer-dialog/bulk-stock-transfer-dialog.component';

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

    // Pricing Mode
    modePrix: 'FIXE' | 'COEFF';
    coefficient?: number;
    margeFixe?: number;
    prixVente: number;

    // Existing Data Helper
    existingStock?: number;
    existingPrixAchat?: number;
    suggestedWAP?: number;
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
        MatDialogModule,
        MatDatepickerModule,
        MatNativeDateModule
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
    displayedColumns: string[] = ['codeBarre', 'reference', 'marque', 'nom', 'categorie', 'quantite', 'prixAchat', 'tva', 'modePrix', 'prixVente', 'actions'];

    // OCR State
    ocrProcessing = false;
    analyzedText = '';

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
    bulkDisplayedColumns: string[] = ['select', 'reference', 'marque', 'designation', 'entrepot', 'stock'];
    loadingBulk = false;
    skipPaymentPrompt = false;

    currentCentre = this.store.selectSignal(UserCurrentCentreSelector);
    ProductType = ProductType;

    entrepots$ = new BehaviorSubject<Entrepot[]>([]);
    stats$ = new BehaviorSubject<StockStats | null>(null);
    productTypes = Object.values(ProductType);

    constructor(
        private fb: FormBuilder,
        private ocrService: OcrService,
        private financeService: FinanceService,
        private productService: ProductService,
        private warehousesService: WarehousesService,
        private snackBar: MatSnackBar,
        private dialog: MatDialog,
        private store: Store,
        private route: ActivatedRoute
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
            prixVente: [0, Validators.required]
        });

        this.documentForm = this.fb.group({
            type: ['FACTURE', Validators.required], // FACTURE or BL
            fournisseurId: ['', Validators.required],
            numero: [''],
            date: [new Date(), Validators.required],
            file: [null],
            centreId: [null]
        });

        this.batchPricingForm = this.fb.group({
            modePrix: ['COEFF'],
            coefficient: [2.5],
            margeFixe: [0]
        });

        this.setupProductSearch();
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

        // Load warehouses for current centre
        const center = this.currentCentre();
        const centerId = center ? center.id : undefined;

        this.warehousesService.findAll(centerId).subscribe({
            next: (data) => {
                console.log('Warehouses loaded:', data);
                this.entrepots$.next(data);
            },
            error: (err) => console.error('Error loading warehouses:', err)
        });

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
        this.searchBulkProducts();

        // Initial patch for centreId
        const activeCenterId = this.currentCentre()?.id;
        if (activeCenterId) {
            this.documentForm.patchValue({ centreId: activeCenterId });
        }

        // Handle prefilled data from query params
        this.route.queryParams.subscribe(params => {
            if (params['prefillInvoice'] || params['prefillSupplier']) {
                this.documentForm.patchValue({
                    numero: params['prefillInvoice'] || '',
                    fournisseurId: params['prefillSupplier'] || '',
                    date: params['prefillDate'] ? new Date(params['prefillDate']) : new Date()
                });

                if (params['prefillInvoice']) {
                    this.skipPaymentPrompt = true;
                }

                this.snackBar.open('Données de la facture pré-remplies', 'OK', { duration: 3000 });
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
                this.snackBar.open(`Produit existant détecté : ${this.foundProduct.nom}`, 'OK', { duration: 2000 });
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
                this.productsSubject.next([]);
                this.documentForm.reset({ type: 'FACTURE', date: new Date() });
            }
        });
    }

    // --- Staging Logic ---

    addProduct() {
        if (this.entryForm.invalid) return;

        const val = this.entryForm.getRawValue();

        // Validation: Must have at least a reference OR a barcode
        if (!val.reference?.trim() && !val.codeBarre?.trim()) {
            this.snackBar.open('Veuillez saisir une référence ou un code-barres', 'OK', { duration: 3000 });
            return;
        }

        // Backend fallback: if no reference, use codeBarre as reference
        const finalRef = val.reference?.trim() || val.codeBarre?.trim() || '';

        const product: StagedProduct = {
            tempId: crypto.randomUUID(),
            id: this.foundProduct?.id, // Link if existing
            reference: finalRef,
            codeBarre: val.codeBarre,
            ...val
        };

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
            codeBarre: ''
        });

        this.foundProduct = null;
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

    private isValidProductLine(line: any): boolean {
        const raw = (line.raw || '').trim();
        const text = (line.designation || line.raw || '').toLowerCase();

        // 1. Force Allow if starts with a long numeric sequence (Barcode/Ref)
        // Optician invoices often start with EAN-13 or internal codes.
        const startsWithCode = /^\d{8,14}/.test(raw);
        if (startsWithCode) return true;

        // 2. Exclude headers/metadata/footers
        const keywordsToExclude = [
            'bl n°', 'bon de livraison', 'facture n°', 'date', 'page',
            'total ht', 'total ttc', 'montant tva', 'arrête la présente',
            'net à payer', 'téléphone', 'ice', 'siège', 'capital', 'r.c',
            'total à reporter', 'à reporter', 'montant ht', 'net a payer', 'total net',
            'service - sérieux - satisfaction'
        ];

        if (keywordsToExclude.some(k => text.includes(k))) {
            console.warn('[OCR] Filtering out metadata line:', line.raw);
            return false;
        }

        // 3. Contextual noise (Logo/Company info) - Only if not a product line
        if (text.includes('contrast') || text.includes('lens')) {
            if (text.includes('galerie') || text.includes('casablanca') || text.includes('maroc')) {
                return false;
            }
        }

        // 4. Short Junk Filter
        if (text.length < 5 && !line.reference && !line.qty) {
            console.warn('[OCR] Filtering out short junk line:', line.raw);
            return false;
        }

        return true;
    }

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
            this.detectedLines = (result.lines || []).filter((line: any) => this.isValidProductLine(line));
            this.showOcrData = true;

            if (!result.error) {
                this.snackBar.open('Analyse terminée. Vérifiez les données détectées.', 'OK', { duration: 3000 });
            }

            if (result.date) {
                const detected = new Date(result.date);
                const current = new Date();
                const isDifferentMonth = detected.getMonth() !== current.getMonth() || detected.getFullYear() !== current.getFullYear();

                this.documentForm.patchValue({ date: result.date });

                if (isDifferentMonth) {
                    this.snackBar.open(`⚠️ Date détectée: ${detected.toLocaleDateString()}. Vérifiez si elle est correcte !`, 'COMPRIS', { duration: 8000 });
                } else {
                    this.snackBar.open(`Date document mise à jour: ${detected.toLocaleDateString()}`, 'OK', { duration: 3000 });
                }
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
        // MAPPING UPDATE:
        // User requested:
        // 1. Code detected in invoice -> Code Barre (UI: "Code")
        // 2. Ref detected (shortened) -> Reference (UI: "Reference")
        // 3. Brand -> Marque
        // 4. Designation -> Nom (Full)

        let codeBarre = line.code || '';
        let reference = line.reference || '';
        let marque = line.brand || '';
        let nom = line.designation || line.raw || '';

        // Fallback: If no code detected, check if we can infer it
        const isBarcode = (str: string) => /^\d{8}$|^\d{12,14}$/.test(str?.trim());

        if (!codeBarre && isBarcode(line.raw)) {
            codeBarre = line.raw.trim();
        }

        // Auto-detect category
        const categorie = this.determineCategory(line.raw || '');

        this.entryForm.patchValue({
            reference: reference,
            codeBarre: codeBarre,
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

        console.log(`[OCR] Bulk adding ${this.detectedLines.length} lines.`, this.detectedLines);
        this.detectedLines.forEach((line, index) => {
            try {
                const prixAchat = line.computedPrice || (line.priceCandidates && line.priceCandidates[0]) || 0;

                // MAPPING UPDATE FOR BULK ADD:
                const codeBarre = line.code || '';
                const reference = line.reference || '';
                const marque = line.brand || '';
                const nom = line.designation || line.raw || ''; // Full designation as requested

                // Auto-detect category
                const categorie = this.determineCategory(line.raw || '');

                const product: StagedProduct = {
                    tempId: crypto.randomUUID(),
                    reference: reference || 'SANS-REF',
                    codeBarre: codeBarre,
                    nom: nom,
                    marque: marque || 'Sans Marque',
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


            } catch (err) {
                console.error(`[OCR] Fatal error processing line ${index}:`, err, line);
            }
        });

        this.stagedProducts = [...this.stagedProducts, ...newProducts];
        this.productsSubject.next(this.stagedProducts);
        this.snackBar.open(`${newProducts.length} articles ajoutés au panier`, 'OK', { duration: 3000 });

        // Clear results after successful bulk addition
        this.detectedLines = [];
        this.showOcrData = false;
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
            width: '900px',
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
            width: '900px',
            data: { products: this.bulkSelection.selected }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                this.bulkSelection.clear();
                this.searchBulkProducts();
            }
        });
    }

    formatTypeLabel(type: string | undefined): string {
        if (!type) return '';
        return type.split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
}
