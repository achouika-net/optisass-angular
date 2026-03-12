import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, FormControl } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FicheService } from '../../services/fiche.service';
import { ClientManagementService } from '../../services/client.service';
import { Client } from '../../models/client.model';
import { FicheProduit, ProduitVendu, TypeFiche, StatutFiche, FicheProduitCreate } from '../../models/fiche-client.model';
import { ProductService } from '../../../stock-management/services/product.service';

import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { StockSearchDialogComponent } from '../../../stock-management/dialogs/stock-search-dialog/stock-search-dialog.component';
import { FactureService, Facture } from '../../services/facture.service';
import { FactureFormComponent } from '../facture-form/facture-form.component';
import { PaymentListComponent } from '../../components/payment-list/payment-list.component';
import { BehaviorSubject, Subject, firstValueFrom, Observable } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { UserSelector } from '../../../../core/store/auth/auth.selectors';

@Component({
    selector: 'app-fiche-produit-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatDividerModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatTooltipModule,
        MatDialogModule,
        MatTabsModule,
        FactureFormComponent,
        PaymentListComponent
    ],
    providers: [
        FactureService
    ],
    templateUrl: './fiche-produit-form.component.html',
    styleUrls: ['./fiche-produit-form.component.scss']
})
export class FicheProduitFormComponent implements OnInit, AfterViewInit {
    @ViewChild(FactureFormComponent) factureComponent?: FactureFormComponent;
    @ViewChild('scanInput') scanInputRef!: ElementRef;

    ficheForm: FormGroup;
    scanControl = new FormControl('');
    scanning = false;
    loading = false;
    saving = false;
    clientId: string | null = null;
    ficheId: string | null = null;
    client: Client | null = null;
    activeTab: number = 0;
    nomenclatureString: string | null = null;
    isEditMode = true;

    public linkedFactureSubject = new BehaviorSubject<Facture | null>(null);
    linkedFacture$ = this.linkedFactureSubject.asObservable();
    initialLines: any[] = [];
    currentFiche: FicheProduit | null = null;
    currentUser$: Observable<any> = this.store.select(UserSelector);
    private destroy$ = new Subject<void>();

    get clientDisplayName(): string {
        if (!this.client) return '';
        if ((this.client as any).nom) {
            return `${(this.client as any).nom} ${(this.client as any).prenom || ''}`.trim();
        }
        if ((this.client as any).raisonSociale) {
            return (this.client as any).raisonSociale;
        }
        return '';
    }

    constructor(
        private fb: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private ficheService: FicheService,
        private clientService: ClientManagementService,
        private productService: ProductService,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef,
        private dialog: MatDialog,
        private factureService: FactureService,
        private store: Store
    ) {
        this.ficheForm = this.fb.group({
            dateLivraisonEstimee: [new Date(), Validators.required],
            notes: [''],
            orderItems: this.fb.array([])
        });
    }

    setActiveTab(index: number): void {
        this.activeTab = index;
    }

    isTabAccessible(index: number): boolean {
        return true; // All tabs accessible in Fiche Produit for now
    }

    ngOnInit(): void {
        this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
            this.clientId = params.get('clientId');
            this.ficheId = params.get('ficheId');

            if (this.clientId) {
                this.loadClient(this.clientId);
            }

            if (this.ficheId && this.ficheId !== 'new') {
                this.isEditMode = false;
                this.ficheForm.disable();
                this.loadFiche(this.ficheId);
            } else {
                // Si on était sur une fiche et qu'on passe à 'new', reset complet
                if (this.ficheId !== 'new') {
                    this.ficheId = 'new';
                    this.isEditMode = true;
                    this.ficheForm.enable();
                    this.ficheForm.reset({
                        dateLivraisonEstimee: new Date(),
                        notes: '',
                        orderItems: []
                    });
                    this.orderItems.clear();
                    this.addProduct();
                    this.linkedFactureSubject.next(null);
                }
                this.cdr.markForCheck();
            }
        });
    }

    ngAfterViewInit(): void {
        setTimeout(() => {
            if (this.scanInputRef && this.scanInputRef.nativeElement) {
                this.scanInputRef.nativeElement.focus();
            }
        }, 300);
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    // ─── Form Helpers ─────────────────────────────────────────────────────────

    get orderItems(): FormArray {
        return this.ficheForm.get('orderItems') as FormArray;
    }

    createProductFormGroup(product?: any): FormGroup {
        return this.fb.group({
            produitId: [product?.produitId || ''],
            designation: [product?.designation || '', Validators.required],
            reference: [product?.reference || '', Validators.required],
            prixUnitaire: [product?.prixUnitaire || 0, [Validators.required, Validators.min(0)]],
            quantite: [product?.quantite || 1, [Validators.required, Validators.min(1)]]
        });
    }

    addProduct(): void {
        this.orderItems.push(this.createProductFormGroup());
    }

    removeProduct(index: number): void {
        this.orderItems.removeAt(index);
        if (this.orderItems.length === 0) {
            this.addProduct();
        }
    }

    // ─── Scan / Stock Search ──────────────────────────────────────────────────

    onScanProduct(event?: Event): void {
        if (event) event.preventDefault();
        const code = this.scanControl.value?.trim();
        if (!code) return;

        this.scanning = true;
        this.cdr.markForCheck();

        this.productService.findAll({ codeBarres: code }).subscribe({
            next: (products) => {
                this.scanning = false;
                if (products && products.length > 0) {
                    const product = products[0];
                    this.addProductFromScan(product);
                    this.scanControl.setValue('');
                    this.snackBar.open(`Produit scanné : ${product.designation}`, 'Fermer', { duration: 2000, panelClass: ['success-snackbar'] });
                    this.focusScanInput();
                } else {
                    this.productService.findAll({ reference: code }).subscribe({
                        next: (productsRef) => {
                            if (productsRef && productsRef.length > 0) {
                                const product = productsRef[0];
                                this.addProductFromScan(product);
                                this.scanControl.setValue('');
                                this.snackBar.open(`Produit trouvé (réf) : ${product.designation}`, 'Fermer', { duration: 2000, panelClass: ['success-snackbar'] });
                                this.focusScanInput();
                            } else {
                                this.snackBar.open('Aucun produit trouvé pour ce code', 'Fermer', { duration: 3000, panelClass: ['error-snackbar'] });
                                this.scanControl.setValue('');
                                this.focusScanInput();
                            }
                        },
                        error: () => {
                            this.snackBar.open('Erreur lors de la recherche', 'Fermer', { duration: 3000, panelClass: ['error-snackbar'] });
                            this.focusScanInput();
                        }
                    });
                }
            },
            error: (err) => {
                this.scanning = false;
                console.error('Error scanning product:', err);
                this.snackBar.open('Erreur système lors du scan', 'Fermer', { duration: 3000, panelClass: ['error-snackbar'] });
                this.cdr.markForCheck();
                this.focusScanInput();
            }
        });
    }

    openStockSearch(): void {
        const dialogRef = this.dialog.open(StockSearchDialogComponent, {
            width: '95vw',
            maxWidth: '1600px',
            height: '85vh',
            data: { 
                context: 'sales',
                initialTypeFilter: 'acc' 
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result) {
                if (result.action === 'SELECT_MULTIPLE' && result.products) {
                    result.products.forEach((p: any) => this.addProductFromScan(p));
                    this.snackBar.open(`${result.products.length} produits ajoutés !`, 'Fermer', {
                        duration: 3000,
                        panelClass: ['success-snackbar']
                    });
                } else if (result.action === 'SELECT' && result.product) {
                    this.addProductFromScan(result.product);
                } else if (!result.action && result.id) {
                    this.addProductFromScan(result);
                }
                this.cdr.detectChanges();
            }
            this.focusScanInput();
        });
    }

    focusScanInput(): void {
        if (this.scanInputRef && this.scanInputRef.nativeElement) {
            this.scanInputRef.nativeElement.focus();
        }
        this.cdr.markForCheck();
    }

    addProductFromScan(product: any): void {
        const items = this.orderItems.value;
        const refProd = product.codeBarres || product.codeInterne || '';

        const index = items.findIndex((item: any) =>
            (item.produitId && item.produitId === product.id) ||
            (item.reference && refProd && item.reference === refProd)
        );

        if (index > -1) {
            const currentQty = this.orderItems.at(index).get('quantite')?.value || 0;
            this.orderItems.at(index).get('quantite')?.setValue(currentQty + 1);
        } else {
            if (this.orderItems.length === 1 && !this.orderItems.at(0).get('designation')?.value && !this.orderItems.at(0).get('reference')?.value) {
                this.orderItems.removeAt(0);
            }
            const prix = product.prixVenteTTC || product.prixVenteHT || product.prixVente || 0;
            this.orderItems.push(this.fb.group({
                produitId: [product.id],
                designation: [product.designation, Validators.required],
                reference: [refProd, Validators.required],
                prixUnitaire: [prix, [Validators.required, Validators.min(0)]],
                quantite: [1, [Validators.required, Validators.min(1)]]
            }));
        }
        this.cdr.detectChanges();
    }

    // ─── Data Loading ─────────────────────────────────────────────────────────

    loadClient(id: string): void {
        this.clientService.getClient(id).subscribe({
            next: (client: Client | undefined) => {
                if (client) {
                    this.client = client;
                    this.cdr.markForCheck();
                }
            },
            error: (err: any) => {
                console.error('Error loading client:', err);
                this.snackBar.open('Erreur lors du chargement du client', 'Fermer', { duration: 3000 });
            }
        });
    }

    loadFiche(id: string): void {
        this.loading = true;
        this.ficheService.getFicheById(id).subscribe({
            next: (fiche: any) => {
                if (fiche && fiche.type === TypeFiche.PRODUIT) {
                    const ficheProduit = fiche as FicheProduit;
                    this.currentFiche = ficheProduit;
                    this.ficheForm.patchValue({
                        dateLivraisonEstimee: ficheProduit.dateLivraisonEstimee ? new Date(ficheProduit.dateLivraisonEstimee) : new Date(),
                        notes: ficheProduit.notes || ''
                    });

                    this.orderItems.clear();
                    if (ficheProduit.produits && ficheProduit.produits.length > 0) {
                        ficheProduit.produits.forEach(p => {
                            this.orderItems.push(this.fb.group({
                                produitId: [p.produitId],
                                designation: [p.designation, Validators.required],
                                reference: [p.reference, Validators.required],
                                prixUnitaire: [p.prixUnitaire, [Validators.required, Validators.min(0)]],
                                quantite: [p.quantite, [Validators.required, Validators.min(1)]]
                            }));
                        });
                    } else {
                        this.addProduct();
                    }

                    if (ficheProduit.clientId && !this.client) {
                        this.loadClient(ficheProduit.clientId);
                    }

                    this.loadLinkedFacture();
                    this.updateNomenclature();
                    this.initialLines = this.getInvoiceLines();
                    this.cdr.markForCheck();
                }
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: (err: any) => {
                console.error('Error loading fiche:', err);
                this.snackBar.open('Erreur lors du chargement de la fiche', 'Fermer', { duration: 3000 });
                this.loading = false;
                this.cdr.markForCheck();
            }
        });
    }

    loadLinkedFacture(): void {
        if (!this.ficheId || this.ficheId === 'new') {
            this.linkedFactureSubject.next(null);
            return;
        }

        this.factureService.findAll({ ficheId: this.ficheId }).subscribe({
            next: (factures: Facture[]) => {
                const found = factures.find(f => f.ficheId === this.ficheId);
                if (found) {
                    console.log('🔗 [FicheProduit] Linked Facture found:', found.numero, '| Status:', found.statut);
                    this.linkedFactureSubject.next(found);
                } else {
                    this.linkedFactureSubject.next(null);
                }
                this.cdr.markForCheck();
            },
            error: (err: any) => {
                console.error('Error loading linked facture:', err);
                this.linkedFactureSubject.next(null);
                this.cdr.markForCheck();
            }
        });
    }

    // ─── Sales Logic: DEVIS → BC → Facture ────────────────────────────────────

    validerVente(): void {
        const currentFacture = this.linkedFactureSubject.value;
        if (!currentFacture || currentFacture.type !== 'DEVIS') {
            console.warn('⚠️ [FicheProduit] Impossible de valider : Facture non trouvée ou type incorrect', currentFacture?.type);
            return;
        }

        this.loading = true;
        const lines = this.getInvoiceLines();
        const total = lines.reduce((acc: number, l: any) => acc + l.totalTTC, 0);
        const paid = (currentFacture.paiements as any[])?.reduce((acc, p) => acc + (p.montant || 0), 0) || 0;

        const updateData: any = {
            numero: null, // [FIX] Force backend to generate a NEW sequential number (ex: BC-2026-003)
            type: 'BON_COMM',
            statut: 'VALIDE',
            lignes: lines,
            totalTTC: total,
            totalHT: total, // Simplified HT calculation
            totalTVA: 0,
            resteAPayer: total - paid,
            proprietes: {
                ...(currentFacture.proprietes || {}),
                nomenclature: this.nomenclatureString || '',
                validatedAt: new Date()
            }
        };

        this.factureService.update(currentFacture.id, updateData).subscribe({
            next: (res) => {
                this.loading = false;
                this.snackBar.open('Vente validée : Devis transformé en Bon de Commande', 'Fermer', { duration: 5000 });
                this.onInvoiceSaved(res);
            },
            error: (err) => {
                this.loading = false;
                console.error('❌ Error validating sale:', err);
                this.snackBar.open('Erreur lors de la validation', 'Fermer', { duration: 3000 });
            }
        });
    }

    transformerEnFacture(): void {
        const currentFacture = this.linkedFactureSubject.value;
        if (!currentFacture || (currentFacture.type !== 'BON_COMM' && currentFacture.type !== 'BON_COMMANDE')) {
            console.warn('⚠️ [FicheProduit] Impossible de transformer : Type incorrect', currentFacture?.type);
            return;
        }

        this.loading = true;
        const updateData: any = {
            numero: null, // [FIX] Force backend to generate a NEW sequential number (ex: Fact-2026-005)
            type: 'FACTURE',
            statut: 'VALIDE',
            proprietes: {
                ...(currentFacture.proprietes || {}),
                facturedAt: new Date()
            }
        };

        this.factureService.update(currentFacture.id, updateData).subscribe({
            next: (res) => {
                this.loading = false;
                this.snackBar.open('Facture générée avec succès', 'Fermer', { duration: 5000 });
                this.onInvoiceSaved(res);
            },
            error: (err) => {
                this.loading = false;
                console.error('❌ Error generating invoice:', err);
                this.snackBar.open('Erreur lors de la génération de la facture', 'Fermer', { duration: 3000 });
            }
        });
    }

    onPaymentAdded(): void {
        const currentFacture = this.linkedFactureSubject.value;
        if (currentFacture && currentFacture.type === 'DEVIS') {
            console.log('💰 Payment added to Devis, auto-validating to BC...');
            this.validerVente();
        } else {
            this.loadLinkedFacture();
            this.snackBar.open('Paiement ajouté avec succès', 'Fermer', { duration: 3000 });
        }
    }

    onInvoiceSaved(facture: any): void {
        this.linkedFactureSubject.next(facture);
        this.snackBar.open('Facture enregistrée avec succès', 'Fermer', { duration: 3000 });
        this.cdr.markForCheck();
    }

    // ─── Invoice Line Helpers ─────────────────────────────────────────────────

    getInvoiceLines(): any[] {
        const items = this.orderItems.value;
        return items.filter((p: any) => p.designation && p.quantite > 0).map((p: any) => ({
            description: p.designation,
            qte: p.quantite,
            prixUnitaireTTC: p.prixUnitaire,
            remise: 0,
            totalTTC: p.prixUnitaire * p.quantite,
            productId: p.produitId || null
        }));
    }

    syncInvoiceLines(): void {
        if (this.factureComponent) {
            const lines = this.getInvoiceLines();
            this.updateNomenclature();

            const props = this.factureComponent.form.get('proprietes')?.value || {};
            this.factureComponent.form.get('proprietes')?.patchValue({
                ...props,
                nomenclature: this.nomenclatureString
            }, { emitEvent: false });

            const fa = this.factureComponent.lignes;
            fa.clear();
            lines.forEach((l: any) => {
                const group = this.factureComponent!.createLigne();
                group.patchValue(l);
                fa.push(group);
            });

            this.factureComponent.calculateTotals();
            this.cdr.detectChanges();
        }
    }

    updateNomenclature(): void {
        // No nomenclature for product fiches (avoids duplication in client detail table)
        this.nomenclatureString = null;
    }

    // ─── Edit Mode ────────────────────────────────────────────────────────────

    toggleEditMode(): void {
        this.isEditMode = !this.isEditMode;
        if (this.isEditMode) {
            this.ficheForm.enable();
        } else {
            this.ficheForm.disable();
            if (this.ficheId && this.ficheId !== 'new') {
                this.loadFiche(this.ficheId);
            }
        }
    }

    onTabChange(index: number): void {
        this.activeTab = index;
        if (index === 2) {
            this.syncInvoiceLines();
        } else if (index === 1) {
            this.updateNomenclature();
        }
        this.cdr.markForCheck();
    }

    // ─── Création manuelle du DEVIS (pour les fiches existantes sans DEVIS) ───

    async creerDevisManuellement(): Promise<void> {
        if (!this.ficheId || this.ficheId === 'new' || !this.clientId) return;

        this.loading = true;
        const produits = this.orderItems.value;
        const montantTotal = produits.reduce((sum: number, p: any) => sum + (p.prixUnitaire * p.quantite), 0);

        const invoiceLines = produits
            .filter((p: any) => p.designation && p.quantite > 0)
            .map((p: any) => ({
                description: p.designation,
                qte: p.quantite,
                prixUnitaireTTC: p.prixUnitaire,
                remise: 0,
                totalTTC: p.prixUnitaire * p.quantite
            }));

        try {
            const devis: any = await firstValueFrom(this.factureService.create({
                type: 'DEVIS',
                statut: 'BROUILLON',
                dateEmission: new Date(),
                clientId: this.clientId,
                ficheId: this.ficheId,
                lignes: invoiceLines as any,
                totalHT: montantTotal,
                totalTVA: 0,
                totalTTC: montantTotal,
                resteAPayer: montantTotal
            }));
            console.log('✅ [FicheProduit] DEVIS créé manuellement:', devis?.numero);
            this.linkedFactureSubject.next(devis);
            this.snackBar.open(`DEVIS ${devis?.numero} créé avec succès`, 'OK', { duration: 4000 });
        } catch (err: any) {
            console.error('❌ [FicheProduit] Erreur création DEVIS:', err);
            this.snackBar.open('Erreur lors de la création du DEVIS', 'Fermer', { duration: 4000 });
        } finally {
            this.loading = false;
            this.cdr.markForCheck();
        }
    }

    // ─── Save / Submit ────────────────────────────────────────────────────────

    async onSubmit() {
        if (this.ficheForm.invalid || !this.clientId || this.loading) {
            this.snackBar.open('Veuillez remplir correctement le formulaire', 'Fermer', { duration: 3000 });
            return;
        }

        this.saving = true;
        this.loading = true;
        const formValue = this.ficheForm.getRawValue();

        const produits: ProduitVendu[] = formValue.orderItems.map((item: any) => ({
            produitId: item.produitId || '',
            designation: item.designation,
            reference: item.reference,
            prixUnitaire: item.prixUnitaire,
            quantite: item.quantite,
            prixTotal: item.prixUnitaire * item.quantite
        }));

        const montantTotal = produits.reduce((sum, p) => sum + p.prixTotal, 0);

        const payload: FicheProduitCreate = {
            clientId: this.clientId,
            type: TypeFiche.PRODUIT,
            statut: this.currentFiche?.statut || StatutFiche.EN_COURS,
            dateLivraisonEstimee: formValue.dateLivraisonEstimee,
            notes: formValue.notes,
            produits,
            montantTotal,
            montantPaye: this.currentFiche?.montantPaye || 0
        };

        const isCreatingNew = !this.ficheId || this.ficheId === 'new';
        const operation = isCreatingNew
            ? this.ficheService.createFicheProduit(payload)
            : this.ficheService.updateFiche(this.ficheId!, payload).pipe(map(() => ({ ...this.currentFiche, ...payload, id: this.ficheId } as FicheProduit)));

        try {
            const savedFiche = await firstValueFrom(operation);
            const ficheId = savedFiche.id!;
            
            // Log local progress
            console.log(`💾 [FicheProduit] Fiche ${isCreatingNew ? 'created' : 'updated'}. ID:`, ficheId);

            if (isCreatingNew) {
                // ─── AUTO-CREATE DEVIS ────────────────────────────────────
                const invoiceLines = produits.map(p => ({
                    description: p.designation,
                    qte: p.quantite,
                    prixUnitaireTTC: p.prixUnitaire,
                    remise: 0,
                    totalTTC: p.prixTotal,
                    productId: p.produitId
                }));

                try {
                    const devisCreated = await firstValueFrom(this.factureService.create({
                        type: 'DEVIS',
                        statut: 'DEVIS_EN_COURS',
                        dateEmission: new Date(),
                        clientId: this.clientId!,
                        ficheId: ficheId,
                        lignes: invoiceLines as any,
                        totalHT: montantTotal,
                        totalTVA: 0,
                        totalTTC: montantTotal,
                        resteAPayer: montantTotal,
                        proprietes: {
                            autoCreated: true
                        }
                    }));
                    console.log('✅ [FicheProduit] DEVIS créé automatiquement:', devisCreated?.numero);
                    this.linkedFactureSubject.next(devisCreated);
                } catch (invoiceErr: any) {
                    console.warn('⚠️ [FicheProduit] Impossible de créer le DEVIS:', invoiceErr?.message);
                }

                // ── Mettre à jour l'URL sans détruire le composant (replaceUrl) ──
                await this.router.navigate(
                    ['/p/clients', this.clientId, 'fiche-produit', ficheId],
                    { replaceUrl: true }
                );

                this.ficheId = ficheId;
            } else {
                // For updates, we might want to sync current invoice lines if it's still a DEVIS
                const currentFacture = this.linkedFactureSubject.value;
                if (currentFacture && (currentFacture.type === 'DEVIS' || currentFacture.statut === 'BROUILLON')) {
                    console.log('🔄 Syncing existing DEVIS with new fiche products...');
                    const lines = this.getInvoiceLines();
                    const paid = (currentFacture.paiements as any[])?.reduce((acc, p) => acc + (p.montant || 0), 0) || 0;
                    this.factureService.update(currentFacture.id, {
                        lignes: lines,
                        totalTTC: montantTotal,
                        totalHT: montantTotal, 
                        totalTVA: 0,
                        resteAPayer: montantTotal - paid
                    }).subscribe(updated => this.linkedFactureSubject.next(updated));
                }
            }

            this.currentFiche = savedFiche as FicheProduit;
            this.isEditMode = false;
            this.ficheForm.disable();
            this.saving = false;
            this.loading = false;
            this.snackBar.open('Fiche enregistrée avec succès', 'OK', { duration: 3000 });
            this.cdr.detectChanges();

        } catch (err: any) {
            console.error('❌ [FicheProduit] Error saving fiche:', err);
            const msg = err?.error?.message || 'Erreur lors de l\'enregistrement';
            this.snackBar.open(msg, 'Fermer', { duration: 5000 });
            this.saving = false;
            this.loading = false;
            this.cdr.markForCheck();
        }
    }

    refreshFacture(): void {
        this.loadLinkedFacture();
    }

    fullname(user: any): string {
        if (!user) return 'Vendeur';
        if (user.fullName) return user.fullName;
        if (user.employee) return `${user.employee.nom} ${user.employee.prenom}`;
        return user.username || 'Vendeur';
    }

    goBack(): void {
        if (this.clientId) {
            this.router.navigate(['/p/clients', this.clientId]);
        } else {
            window.history.back();
        }
    }

    onCancel(): void {
        if (this.clientId) {
            this.router.navigate(['/p/clients', this.clientId]);
        } else {
            this.router.navigate(['/p/clients']);
        }
    }
}
