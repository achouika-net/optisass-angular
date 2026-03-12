import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CameraCaptureDialogComponent } from '../../../../shared/components/camera-capture/camera-capture-dialog.component';
import { CommonModule } from '@angular/common';
import { AdaptationModerneComponent } from './components/adaptation-moderne/adaptation-moderne.component';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { FicheService } from '../../services/fiche.service';
import { ClientManagementService } from '../../services/client.service';
import { FactureService } from '../../services/facture.service';
import { FicheLentillesCreate, TypeFiche, StatutFiche } from '../../models/fiche-client.model';
import { Client, ClientParticulier, ClientProfessionnel, isClientParticulier, isClientProfessionnel } from '../../models/client.model';
import { ContactLensType, ContactLensUsage } from '../../../../shared/interfaces/product.interface';
import { FactureFormComponent } from '../facture-form/facture-form.component';
import { PaymentListComponent } from '../../components/payment-list/payment-list.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { StockSearchDialogComponent } from '../../../stock-management/dialogs/stock-search-dialog/stock-search-dialog.component';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ProductService } from '../../../stock-management/services/product.service';
import { Product, ProductStatus } from '../../../../shared/interfaces/product.interface';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';
import { BehaviorSubject, forkJoin, Observable, of, Subject, timer } from 'rxjs';
import { catchError, map, take, takeUntil, tap, switchMap } from 'rxjs/operators';

interface PrescriptionFile {
    name: string;
    type: string;
    size: number;
    preview: string | SafeResourceUrl;
    file: File;
    uploadDate: Date;
}

@Component({
    selector: 'app-lentilles-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        MatTabsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatCheckboxModule,
        MatDividerModule,
        MatButtonToggleModule,
        RouterModule,
        AdaptationModerneComponent,
        FactureFormComponent,
        PaymentListComponent,
        MatDialogModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './lentilles-form.component.html',
    styleUrls: ['./lentilles-form.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [ProductService]
})
export class LentillesFormComponent implements OnInit, OnDestroy {
    ficheForm: FormGroup;
    clientId: string | null = null;
    client: Client | null = null;
    activeTab = 0;
    loading = false;
    isEditMode = false;
    ficheId: string | null = null;

    // Enums for dropdowns
    lensTypes = Object.values(ContactLensType);
    lensUsages = Object.values(ContactLensUsage);

    // Linked Invoice
    private linkedFactureSubject = new BehaviorSubject<any>(null);
    linkedFacture$ = this.linkedFactureSubject.asObservable();
    linkedFacture: any = null;

    // Transfer tracking
    receptionComplete = false;
    isReserved = false;
    isTransit = false;
    currentFiche: any = null;
    initialProductStatus: string | null = null;
    private destroy$ = new Subject<void>();

    // File Upload & OCR
    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
    @ViewChild(FactureFormComponent) factureComponent?: FactureFormComponent;

    prescriptionFiles: PrescriptionFile[] = [];
    isProcessingOcr = false;
    viewingFile: PrescriptionFile | null = null;
    initialLines: any[] = []; // To track changes for dirty check

    constructor(
        private fb: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private ficheService: FicheService,
        private clientService: ClientManagementService,
        private factureService: FactureService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef,
        private sanitizer: DomSanitizer,
        private productService: ProductService,
        private store: Store,
        private ngZone: NgZone
    ) {
        this.ficheForm = this.initForm();
    }

    ngOnInit(): void {
        this.route.paramMap.subscribe(params => {
            this.clientId = params.get('clientId');
            this.ficheId = params.get('ficheId');

            if (this.clientId) {
                this.loadClient();
            }

            if (this.ficheId && this.ficheId !== 'new') {
                this.isEditMode = false;
                this.ficheForm.disable();
                this.loadFiche();
                this.loadLinkedInvoice();
            } else {
                // Initial state for new fiche
                this.ficheId = 'new';
                this.isEditMode = true;
                this.ficheForm.enable();
                this.ficheForm.reset(this.initForm().getRawValue());
                // Default dates
                this.ficheForm.patchValue({
                    ordonnance: { datePrescription: new Date() },
                    adaptation: { dateEssai: new Date() }
                });
                this.linkedFactureSubject.next(null);
                this.cdr.markForCheck();
            }
        });

        // REACTIVE RECEPTION CHECK: Trigger whenever the invoice status changes
        this.linkedFacture$.subscribe(facture => {
            if (facture?.statut === 'VENTE_EN_INSTANCE' && this.currentFiche) {
                console.log('🔄 [RECEPTION] Reactive trigger (Invoice changed or loaded)');
                this.checkReceptionForInstance(this.currentFiche);
            }
        });

        // POLLING: Check reception status every 30 seconds if waiting
        this.ngZone.runOutsideAngular(() => {
            timer(30000, 30000).pipe(
                takeUntil(this.destroy$)
            ).subscribe(() => {
                if ((this.isReserved || this.isTransit) && !this.receptionComplete && this.currentFiche) {
                    console.log('🔄 [POLLING] Checking reception status...');
                    this.checkReceptionForInstance(this.currentFiche);
                }
            });
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    initForm(): FormGroup {
        return this.fb.group({
            // Ordonnance
            ordonnance: this.fb.group({
                datePrescription: [new Date()],
                prescripteur: [''],
                dateControle: [''],
                od: this.fb.group({
                    sphere: [''],
                    cylindre: [''],
                    axe: [''],
                    addition: [''],
                    k1: [''],
                    k2: [''],
                    acuiteVisuelle: ['']
                }),
                og: this.fb.group({
                    sphere: [''],
                    cylindre: [''],
                    axe: [''],
                    addition: [''],
                    k1: [''],
                    k2: [''],
                    acuiteVisuelle: ['']
                })
            }),

            // Sélection Lentilles
            lentilles: this.fb.group({
                type: [ContactLensType.MENSUELLE, Validators.required],
                usage: [ContactLensUsage.MYOPIE, Validators.required],
                diffLentilles: [false],
                od: this.fb.group({
                    marque: ['', Validators.required],
                    modele: [''],
                    rayon: ['', Validators.required],
                    diametre: ['', Validators.required],
                    sphere: [''],
                    cylindre: [''],
                    axe: [''],
                    addition: [''],
                    prix: [0],
                    acuiteVisuelle: [''],
                    mouvement: [''],
                    centrage: [''],
                    keratoH: [''],
                    keratoV: [''],
                    keratoAxe: [''],
                    keratoMoy: [''],
                    productId: [null],
                    entrepotId: [null],
                    entrepotType: [null],
                    entrepotNom: [null]
                }),
                og: this.fb.group({
                    marque: ['', Validators.required],
                    modele: [''],
                    rayon: ['', Validators.required],
                    diametre: ['', Validators.required],
                    sphere: [''],
                    cylindre: [''],
                    axe: [''],
                    addition: [''],
                    prix: [0],
                    acuiteVisuelle: [''],
                    mouvement: [''],
                    centrage: [''],
                    keratoH: [''],
                    keratoV: [''],
                    keratoAxe: [''],
                    keratoMoy: [''],
                    productId: [null],
                    entrepotId: [null],
                    entrepotType: [null],
                    entrepotNom: [null]
                })
            }),

            // Adaptation
            adaptation: this.fb.group({
                dateEssai: [new Date()],
                dateControle: [''],
                docteur: [''],
                // Automatic Measures
                hvid: [''], pupilPhot: [''], pupilMes: [''], but: [''], k1: [''], k2: [''], schirmer: [''],
                // Clinical Params (Global for Modern Adaptation)
                blinkFreq: [''], blinkAmp: [''], tonus: [''],
                // Suggestions
                suggestedType: [''], suggestedDiameter: [''], suggestedBC: [''], suggestedMaterial: [''],
                // OD
                od: this.fb.group({
                    frequenceCillement: ['normal'], amplitudeCillement: ['complet'], tonusPalpebral: ['normal'],
                    reactionPupillaire: ['normale'], secretionLacrimale: [''], but: [''], etatPaupieres: ['']
                }),
                // OG
                og: this.fb.group({
                    frequenceCillement: ['normal'], amplitudeCillement: ['complet'], tonusPalpebral: ['normal'],
                    reactionPupillaire: ['normale'], secretionLacrimale: [''], but: [''], etatPaupieres: ['']
                }),
                remarques: ['']
            }),

            // Suivi Commande
            suiviCommande: this.fb.group({
                statut: ['A_COMMANDER'], // A_COMMANDER, COMMANDE, RECU, LIVRE_CLIENT
                dateCommande: [null],
                dateReception: [null],
                dateLivraison: [null],
                fournisseur: [''],
                referenceCommande: [''],
                commentaire: ['']
            })
        });
    }

    loadClient(): void {
        if (!this.clientId) return;
        this.clientService.getClient(this.clientId).subscribe(client => {
            this.client = client || null;
            this.cdr.markForCheck();
        });
    }

    loadFiche(): void {
        if (!this.ficheId) return;

        this.ficheService.getFicheById(this.ficheId).subscribe({
            next: (fiche: any) => {
                // Determine 'prescription' vs 'ordonnance' mapping
                // Backend model uses 'prescription' but form uses 'ordonnance'
                const formPatch = {
                    ...fiche,
                    ordonnance: fiche.prescription || fiche.ordonnance,
                    // If backend stores content flattened or nested, FicheService handles mapBackendToFrontend
                    // which spreads content. So 'lentilles', 'adaptation', 'suiviCommande' should be at top level.
                };

                this.ficheForm.patchValue(formPatch);
                this.currentFiche = fiche;
                this.initialLines = this.initialInvoiceLines; // Capture initial state

                // Trigger check if invoice is already available
                if (this.linkedFacture?.statut === 'VENTE_EN_INSTANCE') {
                    this.checkReceptionForInstance(fiche);
                }

                this.cdr.markForCheck();
            },
            error: (err) => console.error('Error loading fiche:', err)
        });
    }

    loadLinkedInvoice() {
        // Don't load invoice for new fiches
        if (!this.ficheId || this.ficheId === 'new') {
            this.linkedFactureSubject.next(null);
            return;
        }

        // Only load invoices for this client to avoid loading entire database
        if (!this.clientId) return;

        this.factureService.findAll({ ficheId: this.ficheId }).subscribe(factures => {
            const found = factures.find(f => f.ficheId === this.ficheId);
            this.linkedFacture = found || null;
            if (found) {
                console.log('🔗 [Lentille] Linked Facture found:', found.numero, '| Status:', found.statut);
                this.linkedFactureSubject.next(found);
                if (this.currentFiche) {
                    this.checkReceptionForInstance(this.currentFiche);
                }
            } else {
                this.linkedFactureSubject.next(null);
            }
            this.cdr.markForCheck();
        });
    }

    validerVente(): void {
        const currentFacture = this.linkedFactureSubject.value;
        if (!currentFacture || currentFacture.type !== 'DEVIS') return;

        this.loading = true;
        const lines = this.initialInvoiceLines;
        const total = lines.reduce((acc, l) => acc + l.totalTTC, 0);

        const updateData: any = {
            type: 'BON_COMM',
            statut: 'VALIDE',
            lignes: lines,
            totalTTC: total,
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
                this.snackBar.open('Erreur lors de la validation', 'Fermer', { duration: 3000 });
            }
        });
    }

    transformerEnFacture(): void {
        const currentFacture = this.linkedFactureSubject.value;
        if (!currentFacture || currentFacture.type !== 'BON_COMM') return;

        this.loading = true;
        const updateData: any = {
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
                this.snackBar.open('Erreur lors de la génération de la facture', 'Fermer', { duration: 3000 });
            }
        });
    }

    // --- Getters ---
    get ordonnanceGroup(): FormGroup { return this.ficheForm.get('ordonnance') as FormGroup; }
    get lentillesGroup(): FormGroup { return this.ficheForm.get('lentilles') as FormGroup; }
    get adaptationGroup(): FormGroup { return this.ficheForm.get('adaptation') as FormGroup; }
    get suiviCommandeGroup(): FormGroup { return this.ficheForm.get('suiviCommande') as FormGroup; }
    get diffLentilles(): boolean { return this.lentillesGroup.get('diffLentilles')?.value; }

    get clientDisplayName(): string {
        if (!this.client) return '';
        if (isClientProfessionnel(this.client)) return this.client.raisonSociale.toUpperCase();
        if (isClientParticulier(this.client)) return `${this.client.nom?.toUpperCase()} ${this.client.prenom}`;
        return 'Client';
    }

    get clientCinValue(): string {
        if (!this.client) return '';
        if (isClientProfessionnel(this.client)) return this.client.identifiantFiscal || '';
        if (isClientParticulier(this.client)) return this.client.numeroPieceIdentite || this.client.cinParent || '';
        return '';
    }

    // --- Order Tracking Logic ---
    get suiviStatut(): string {
        return this.suiviCommandeGroup.get('statut')?.value;
    }

    setOrderStatus(statut: string) {
        this.suiviCommandeGroup.patchValue({ statut });
        const now = new Date();

        if (statut === 'COMMANDE') {
            this.suiviCommandeGroup.patchValue({ dateCommande: now });
        } else if (statut === 'RECU') {
            this.suiviCommandeGroup.patchValue({ dateReception: now });
        } else if (statut === 'LIVRE_CLIENT') {
            this.suiviCommandeGroup.patchValue({ dateLivraison: now });
        }
        this.ficheForm.markAsDirty();
    }

    getStepState(stepStatus: string): 'pending' | 'active' | 'completed' {
        const currentStatus = this.suiviStatut;
        const statusOrder = ['A_COMMANDER', 'COMMANDE', 'RECU', 'LIVRE_CLIENT'];
        const currentIndex = statusOrder.indexOf(currentStatus);
        const stepIndex = statusOrder.indexOf(stepStatus);

        if (stepIndex < currentIndex) return 'completed';
        if (stepIndex === currentIndex) return 'active';
        return 'pending';
    }

    // --- Invoice Generation ---
    get initialInvoiceLines(): any[] {
        const lentilles = this.lentillesGroup.value;
        const lines = [];

        // OD
        if (lentilles.od && lentilles.od.marque) {
            lines.push({
                description: `Lentille OD: ${lentilles.od.marque} ${lentilles.od.modele || ''} - ${lentilles.type}`,
                qte: 1,
                prixUnitaireTTC: lentilles.od.prix || 0,
                remise: 0,
                totalTTC: lentilles.od.prix || 0,
                productId: lentilles.od.productId || null,
                entrepotId: lentilles.od.entrepotId || null,
                entrepotType: lentilles.od.entrepotType || null,
                entrepotNom: lentilles.od.entrepotNom || null
            });
        }

        // OG
        if (this.diffLentilles && lentilles.og && lentilles.og.marque) {
            lines.push({
                description: `Lentille OG: ${lentilles.og.marque} ${lentilles.og.modele || ''} - ${lentilles.type}`,
                qte: 1,
                prixUnitaireTTC: lentilles.og.prix || 0,
                remise: 0,
                totalTTC: lentilles.og.prix || 0,
                productId: lentilles.og.productId || null,
                entrepotId: lentilles.og.entrepotId || null,
                entrepotType: lentilles.og.entrepotType || null,
                entrepotNom: lentilles.og.entrepotNom || null
            });
        } else if (!this.diffLentilles && lentilles.od && lentilles.od.marque) {
            lines.push({
                description: `Lentille OG: ${lentilles.od.marque} ${lentilles.od.modele || ''} - ${lentilles.type}`,
                qte: 1,
                prixUnitaireTTC: lentilles.od.prix || 0,
                remise: 0,
                totalTTC: lentilles.od.prix || 0,
                productId: lentilles.od.productId || null,
                entrepotId: lentilles.od.entrepotId || null,
                entrepotType: lentilles.od.entrepotType || null,
                entrepotNom: lentilles.od.entrepotNom || null
            });
        }

        return lines;
    }

    get nomenclatureString(): string {
        // Build a string like "Lentilles MENSUELLE [Marque]"
        const l = this.lentillesGroup.value;
        return `Lentilles ${l.type} - ${l.od?.marque || ''}`;
    }

    onInvoiceSaved(facture: any) {
        this.linkedFacture = facture;
        this.linkedFactureSubject.next(facture);

        // Reload fiche to trigger checkReceptionForInstance and update UI
        if (this.ficheId && this.ficheId !== 'new') {
            this.loadFiche();
        }

        this.cdr.markForCheck();
    }

    // --- Navigation ---
    setActiveTab(index: number): void { this.activeTab = index; }
    nextTab(): void { if (this.activeTab < 5) this.activeTab++; } // Increased max tab
    prevTab(): void { if (this.activeTab > 0) this.activeTab--; }
    goBack(): void {
        if (this.clientId) {
            this.router.navigate(['/p/clients', this.clientId]);
        } else {
            this.router.navigate(['/p/clients']);
        }
    }

    toggleEditMode(): void {
        this.isEditMode = !this.isEditMode;
        if (this.isEditMode) {
            this.ficheForm.enable();
        } else {
            this.ficheForm.disable();
            if (this.ficheId && this.ficheId !== 'new') {
                this.loadFiche();
            }
        }
    }

    // --- Stock Search ---
    openStockSearch(target: 'od' | 'og') {
        const dialogRef = this.dialog.open(StockSearchDialogComponent, {
            width: '95vw',
            maxWidth: '1600px',
            height: '85vh',
            data: {
                context: 'sales',
                initialTypeFilter: 'len'
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (result && (result.action === 'SELECT' || result.action === 'ORDER_AND_SELL') && result.product) {
                this.fillProductDetails(result.product, target);
            } else if (result && !result.action && result.id) {
                this.fillProductDetails(result, target);
            }
        });
    }

    fillProductDetails(product: any, target: 'od' | 'og') {
        const group = this.lentillesGroup.get(target) as FormGroup;
        if (!group) return;

        // Map product specificData to form
        const spec = product.specificData || {};

        group.patchValue({
            marque: product.marque || '',
            modele: product.modele || (product.modeleCommercial || ''),
            rayon: spec.rayonCourbure || '',
            diametre: spec.diametre || '',
            sphere: spec.puissanceSph || '',
            cylindre: spec.puissanceCyl || '',
            axe: spec.axe || '',
            addition: spec.addition || '',
            prix: product.prixVenteTTC || 0,
            productId: product.id,
            entrepotId: product.entrepotId,
            entrepotType: product.entrepot?.type || null,
            entrepotNom: product.entrepot?.nom || null
        });

        this.ficheForm.markAsDirty();
        this.cdr.markForCheck();
    }

    onPaymentAdded(): void {
        const currentFacture = this.linkedFactureSubject.value;
        
        // Auto-transform DEVIS to BON_COMM on first payment
        if (currentFacture && currentFacture.type === 'DEVIS') {
            console.log('💰 Payment added to Devis, auto-validating to BC...');
            this.validerVente();
        } else {
            this.loadLinkedInvoice();
            this.snackBar.open('Paiement ajouté avec succès', 'Fermer', { duration: 3000 });
        }
    }

    archiveFicheFacture(facture: any) {
        console.log('📦 Archiving Devis and Decrementing Stock for:', facture.numero);
        this.loading = true;

        const lines = this.initialInvoiceLines;
        const total = lines.reduce((acc, l) => acc + l.totalTTC, 0);
        const tvaRate = 0.20;
        const totalHT = total / (1 + tvaRate);
        const tva = total - totalHT;

        const updateData: any = {
            statut: 'ARCHIVE',
            lignes: lines,
            totalTTC: total,
            totalHT: totalHT,
            totalTVA: tva,
            proprietes: {
                ...(facture.proprietes || {}),
                nomenclature: this.nomenclatureString || '',
                forceStockDecrement: true,
                instancedAt: new Date()
            }
        };

        this.factureService.update(facture.id, updateData as any).subscribe({
            next: (res) => {
                this.loading = false;
                this.snackBar.open('Vente mise en instance et stock décrémenté', 'Fermer', { duration: 5000 });
                this.onInvoiceSaved(res);
            },
            error: (err) => {
                this.loading = false;
                console.error('Error archiving quote:', err);
                alert("Erreur lors de l'archivage: " + (err.message || 'Erreur inconnue'));
            }
        });
    }

    // --- Submit ---
    async onSubmit() {
        console.log('🚀 [DIAGNOSTIC] onSubmit starting for Lentilles...');
        if (this.ficheForm.invalid || !this.clientId || this.loading) {
            console.log('⚠️ [DIAGNOSTIC] Form Invalid, No Client ID, or Loading', {
                invalid: this.ficheForm.invalid,
                clientId: this.clientId,
                loading: this.loading
            });
            return;
        }
        this.loading = true;
        const formValue = this.ficheForm.getRawValue();

        // 1. Calculate Total
        const prixOD = parseFloat(formValue.lentilles.od.prix) || 0;
        const prixOG = parseFloat(formValue.lentilles.diffLentilles ? formValue.lentilles.og.prix : formValue.lentilles.od.prix) || 0;
        const montantTotal = prixOD + prixOG;

        // 2. Prepare Fiche Data
        const payload: any = {
            clientId: this.clientId,
            type: TypeFiche.LENTILLES,
            statut: this.currentFiche?.statut || StatutFiche.EN_COURS,
            montantTotal,
            montantPaye: this.currentFiche?.montantPaye || 0,
            ordonnance: formValue.ordonnance, // Standardize name to match Monture if possible, though backend might expect prescription
            prescription: formValue.ordonnance, // Fallback for backward compatibility
            lentilles: formValue.lentilles,
            adaptation: formValue.adaptation,
            suiviCommande: formValue.suiviCommande
        };

        console.log('📤 Submitting lentilles data:', payload);

        const operation = (this.ficheId && this.ficheId !== 'new')
            ? this.ficheService.updateFiche(this.ficheId, payload)
            : this.ficheService.createFicheLentilles(payload);

        // 3. ASYNC Payment Check (Same as Monture)
        let hasPayment = false;
        if (this.ficheId && this.ficheId !== 'new' && this.clientId) {
            try {
                const allF = await firstValueFrom(this.factureService.findAll({ clientId: this.clientId }));
                const currentF = allF.find(f => f.ficheId === this.ficheId);
                if (currentF) {
                    const paid = (currentF.paiements as any[])?.reduce((acc, p) => acc + (p.montant || 0), 0) || 0;
                    hasPayment = paid > 0 || currentF.statut === 'PARTIEL' || currentF.statut === 'PAYEE';
                    console.log('✅ [DIAGNOSTIC] Async Payment Check Success:', { paid, status: currentF.statut, hasPayment });
                }
            } catch (e) {
                console.error('❌ [DIAGNOSTIC] Async Payment Check Failed:', e);
            }
        }

        let userForcedStatut: string | null = null;
        let userForcedType: string | null = null;

        // 4. Protection of existing official invoices
        const existingInvoice = this.linkedFactureSubject.value;
        const hasExistingOfficialInvoice = existingInvoice &&
            (existingInvoice.type === 'FACTURE' ||
                existingInvoice.statut === 'VALIDE' ||
                existingInvoice.statut === 'PAYEE' ||
                existingInvoice.statut === 'PARTIEL');

        if (hasExistingOfficialInvoice) {
            console.log('🛡️ [INVOICE PROTECTION] Existing official invoice detected. Skipping status override.');
        } else if (hasPayment) {
            console.log('💰 Payment detected -> Upgrading to BON_COMM');
            userForcedType = 'BON_COMM';
            userForcedStatut = 'VENTE_EN_INSTANCE';
            this.snackBar.open('Acpte détecté : Vente passée en "Bon de Commande".', 'OK', { duration: 4000 });
        }

        operation.pipe(
            switchMap(fiche => {
                const isNew = !this.ficheId || this.ficheId === 'new';
                this.ficheId = fiche.id;
                this.isEditMode = false;
                this.ficheForm.disable();

                // 5. Sync with FactureComponent if it exists
                if (this.factureComponent) {
                    this.factureComponent.ficheIdInput = fiche.id;
                    
                    const freshLines = this.initialInvoiceLines;
                    const freshNomenclature = this.nomenclatureString;

                    if (freshNomenclature) {
                        this.factureComponent.form.patchValue({ proprietes: { nomenclature: freshNomenclature } });
                    }

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

                    if (userForcedStatut) {
                        this.factureComponent.form.patchValue({ statut: userForcedStatut }, { emitEvent: false });
                    }
                    if (userForcedType) {
                        this.factureComponent.form.patchValue({ type: userForcedType }, { emitEvent: false });
                    }

                    // Dirty check for invoice
                    const currentLines = this.initialInvoiceLines;
                    const linesChanged = JSON.stringify(currentLines) !== JSON.stringify(this.initialLines);
                    const isNewInvoice = !this.factureComponent.id || this.factureComponent.id === 'new';

                    if (!linesChanged && !isNewInvoice && !userForcedStatut && !userForcedType) {
                        console.log('📋 [INVOICE SKIP] No changes to invoice lines or status.');
                        return of({ fiche, isNew });
                    }

                    return this.factureComponent.saveAsObservable(true).pipe(
                        map(() => ({ fiche, isNew })),
                        catchError(err => {
                            if (err.status === 409) return of({ fiche, isNew });
                            throw err;
                        })
                    );
                }
                return of({ fiche, isNew });
            })
        ).subscribe({
            next: ({ fiche, isNew }) => {
                this.loading = false;
                this.isEditMode = false;
                this.ficheForm.disable();
                this.snackBar.open('Fiche enregistrée avec succès', 'OK', { duration: 3000 });
                if (isNew) {
                    this.router.navigate(['/p/clients', this.clientId, 'fiche-lentilles', fiche.id]);
                } else {
                    this.loadFiche();
                    this.loadLinkedInvoice();
                }
            },
            error: (err) => {
                console.error(err);
                this.loading = false;
                this.snackBar.open('Erreur lors de l\'enregistrement', 'Erreur', { duration: 3000 });
            }
        });
    }

    // --- Transfer & Reception Logic ---

    /**
     * Checks if products in an INSTANCE sale are now received
     */
    checkReceptionForInstance(fiche: any): void {
        console.log('🔍 [RECEPTION] Checking reception status for lentilles...');
        const isInstance = (this.linkedFactureSubject.value?.statut === 'VENTE_EN_INSTANCE');

        if (!isInstance) return;

        // Reset flags before fresh check
        this.receptionComplete = false;
        this.isReserved = false;
        this.isTransit = false;

        const mappings: { path: string, originalId: string }[] = [];

        if (fiche.lentilles?.od?.productId) {
            mappings.push({ path: 'lentilles.od', originalId: fiche.lentilles.od.productId });
        }

        if (fiche.lentilles?.og?.productId && fiche.lentilles?.diffLentilles) {
            mappings.push({ path: 'lentilles.og', originalId: fiche.lentilles.og.productId });
        }

        if (mappings.length === 0) {
            console.log('⚠️ [RECEPTION] No products found in fiche.');
            this.receptionComplete = true;
            this.cdr.markForCheck();
            return;
        }

        this.store.select(UserCurrentCentreSelector).pipe(take(1)).subscribe(currentCentre => {
            const currentCentreId = currentCentre?.id;

            const checks = mappings.map(m => this.productService.findOne(m.originalId).pipe(
                map(p => ({ ...p, mappingPath: m.path })),
                catchError(err => {
                    console.error(`❌ [RECEPTION] Error fetching product ${m.originalId}:`, err);
                    return of(null);
                })
            ));

            forkJoin(checks).subscribe((productsWithMetadata: any[]) => {
                const products = productsWithMetadata.filter(p => !!p);

                if (!this.initialProductStatus && products.length > 0) {
                    this.initialProductStatus = products[0].quantiteActuelle <= 0 ? 'RUPTURE' : 'DISPONIBLE';
                }

                const allReceivedLocally = products.every(p =>
                    p.statut === ProductStatus.DISPONIBLE &&
                    !p.specificData?.pendingIncoming &&
                    p.quantiteActuelle > 0 &&
                    p.entrepot?.centreId === currentCentreId
                );

                if (allReceivedLocally) {
                    if (!this.receptionComplete) {
                        this.snackBar.open('📦 Les lentilles sont arrivées ! Vous pouvez maintenant valider la vente.', 'VOIR', { duration: 8000 });
                    }
                    this.receptionComplete = true;
                    this.isReserved = false;
                    this.isTransit = false;

                    const localMappingChecks = products.map(p => {
                        const reference = p.modele || p.referenceFournisseur || p.designation;
                        return this.productService.findAll({ search: reference }).pipe(
                            map(results => {
                                const localMatch = results.find(r =>
                                    r.entrepot?.centreId === currentCentreId &&
                                    r.entrepot?.type === 'PRINCIPAL' &&
                                    (r.modele === reference || r.referenceFournisseur === reference || r.designation === reference)
                                ) || p;
                                return { ...p, localProduct: localMatch };
                            }),
                            catchError(err => of({ ...p, localProduct: p }))
                        );
                    });

                    forkJoin(localMappingChecks).subscribe((mappedResults: any[]) => {
                        let changed = false;
                        const formValue = this.ficheForm.getRawValue();

                        mappedResults.forEach(res => {
                            const localP = res.localProduct;
                            const path = res.mappingPath;

                            if (path === 'lentilles.od') {
                                if (formValue.lentilles?.od?.productId !== localP.id) {
                                    this.ficheForm.get('lentilles.od')?.patchValue({
                                        productId: localP.id,
                                        entrepotType: 'PRINCIPAL'
                                    });
                                    changed = true;
                                }
                            } else if (path === 'lentilles.og') {
                                if (formValue.lentilles?.og?.productId !== localP.id) {
                                    this.ficheForm.get('lentilles.og')?.patchValue({
                                        productId: localP.id,
                                        entrepotType: 'PRINCIPAL'
                                    });
                                    changed = true;
                                }
                            }
                        });

                        if (changed) {
                            this.saveFicheSilently();
                        }
                        this.cdr.markForCheck();
                    });
                } else {
                    this.isTransit = products.some(p => p.specificData?.pendingIncoming?.status === 'SHIPPED');
                    this.isReserved = products.some(p =>
                        p.specificData?.pendingIncoming?.status === 'RESERVED' ||
                        (p.entrepot?.centreId !== currentCentreId && !p.specificData?.pendingIncoming)
                    );
                    this.receptionComplete = false;
                    this.cdr.markForCheck();
                }
            });
        });
    }

    /**
     * Silently updates the fiche in the backend
     */
    saveFicheSilently(reload: boolean = true): void {
        if (!this.ficheId || this.ficheId === 'new' || !this.clientId) return;
        const formValue = this.ficheForm.getRawValue();

        const payload: any = {
            clientId: this.clientId,
            type: 'DEVIS',
            statut: this.currentFiche?.statut || 'DEVIS_EN_COURS',
            montantTotal: (parseFloat(formValue.lentilles.od.prix) || 0) + (parseFloat(formValue.lentilles.diffLentilles ? formValue.lentilles.og.prix : formValue.lentilles.od.prix) || 0),
            montantPaye: this.currentFiche?.montantPaye || 0,
            prescription: formValue.ordonnance,
            lentilles: formValue.lentilles,
            adaptation: formValue.adaptation,
            suiviCommande: formValue.suiviCommande
        };

        this.ficheService.updateFiche(this.ficheId, payload).subscribe({
            next: (res) => {
                if (reload) {
                    this.loadFiche();
                } else {
                    this.currentFiche = { ...this.currentFiche, ...payload };
                }
            }
        });
    }

    /**
     * Final validation for an instanced sale
     */
    async validateInstancedSale() {
        if (!this.linkedFactureSubject.value) return;
        const currentFacture = this.linkedFactureSubject.value;

        if (this.isReserved || this.isTransit) {
            this.snackBar.open('⚠️ Impossible de valider la vente : le produit n\'a pas encore été réceptionné.', 'OK', { duration: 5000 });
            return;
        }

        const confirmValidation = confirm("Voulez-vous valider définitivement cette vente ?\nLe produit est maintenant en stock local.");
        if (!confirmValidation) return;

        try {
            this.loading = true;
            const lines = this.initialInvoiceLines;
            const total = lines.reduce((acc, l) => acc + l.totalTTC, 0);
            const tvaRate = 0.20;
            const totalHT = total / (1 + tvaRate);
            const tva = total - totalHT;

            const updateData: any = {
                type: 'FACTURE',
                statut: 'VALIDE',
                lignes: lines,
                totalTTC: total,
                totalHT: totalHT,
                totalTVA: tva,
                resteAPayer: Math.max(0, total - (currentFacture.totalTTC - currentFacture.resteAPayer)),
                proprietes: {
                    ...(currentFacture.proprietes || {}),
                    nomenclature: this.nomenclatureString || '',
                    validatedAt: new Date(),
                    isTransferFulfilled: true,
                    forceStockDecrement: true
                }
            };

            this.factureService.update(currentFacture.id, updateData).subscribe({
                next: (res) => {
                    this.loading = false;
                    this.snackBar.open('Vente validée et facture générée avec succès', 'Fermer', { duration: 5000 });
                    this.receptionComplete = false;
                    this.onInvoiceSaved(res);
                },
                error: (err) => {
                    this.loading = false;
                    console.error('❌ Error validating sale:', err);
                    alert("Erreur lors de la validation: " + (err.error?.message || err.message || 'Erreur inconnue'));
                }
            });
        } catch (e) {
            this.loading = false;
        }
    }

    onSuggestionGenerated(suggestion: any): void {
        // Suggestion handled by child, potentially trigger re-calc of visual aid
    }

    // --- File Upload & OCR Logic ---

    openFileUpload(): void {
        this.fileInput.nativeElement.click();
    }

    onFilesSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

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

                // Auto-trigger OCR for images
                if (file.type.startsWith('image/')) {
                    this.extractData(prescriptionFile);
                }

                this.cdr.markForCheck();
            };
            reader.readAsDataURL(file);
        });
        input.value = '';
    }

    async extractData(file: PrescriptionFile): Promise<void> {
        if (!file.type.startsWith('image/')) return;

        this.isProcessingOcr = true;
        this.cdr.markForCheck();

        try {
            // Import OCR functions dynamically
            const { extractTextFromImage } = await import('../../utils/ocr-extractor');
            const { parsePrescription } = await import('../../utils/prescription-parser');

            const text = await extractTextFromImage(file.file);
            console.log('Texte extrait (OCR):', text);

            const parsed = parsePrescription(text);
            console.log('Données parsées (OCR):', parsed);

            // Update Form - Ordonnance Section
            const ordGroup: any = {
                od: {
                    sphere: parsed.OD.sph !== 0 ? (parsed.OD.sph > 0 ? '+' : '') + parsed.OD.sph.toFixed(2) : '',
                    cylindre: parsed.OD.cyl !== 0 ? (parsed.OD.cyl > 0 ? '+' : '') + parsed.OD.cyl.toFixed(2) : '',
                    axe: parsed.OD.axis ? parsed.OD.axis + '°' : '',
                    addition: parsed.OD.add !== undefined ? (parsed.OD.add > 0 ? '+' : '') + parsed.OD.add.toFixed(2) : ''
                },
                og: {
                    sphere: parsed.OG.sph !== 0 ? (parsed.OG.sph > 0 ? '+' : '') + parsed.OG.sph.toFixed(2) : '',
                    cylindre: parsed.OG.cyl !== 0 ? (parsed.OG.cyl > 0 ? '+' : '') + parsed.OG.cyl.toFixed(2) : '',
                    axe: parsed.OG.axis ? parsed.OG.axis + '°' : '',
                    addition: parsed.OG.add !== undefined ? (parsed.OG.add > 0 ? '+' : '') + parsed.OG.add.toFixed(2) : ''
                }
            };

            // Handle Metadata (Date, Prescripteur)
            if (parsed.date) {
                const parts = parsed.date.split('/');
                if (parts.length === 3) {
                    const dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                    if (!isNaN(dateObj.getTime())) {
                        ordGroup.datePrescription = dateObj;
                    }
                }
            }
            if (parsed.prescripteur) {
                ordGroup.prescripteur = parsed.prescripteur;
            }

            // Patch Ordonnance group
            this.ficheForm.get('ordonnance')?.patchValue(ordGroup);

            // Also patch Lentilles section (Mapping corresponding spheres/cyls)
            this.ficheForm.get('lentilles')?.patchValue({
                od: {
                    sphere: ordGroup.od.sphere,
                    cylindre: ordGroup.od.cylindre,
                    axe: ordGroup.od.axe,
                    addition: ordGroup.od.addition
                },
                og: {
                    sphere: ordGroup.og.sphere,
                    cylindre: ordGroup.og.cylindre,
                    axe: ordGroup.og.axe,
                    addition: ordGroup.og.addition
                }
            });

            this.snackBar.open('Ordonnance analysée avec succès', 'OK', { duration: 3000 });
        } catch (error) {
            console.error('Erreur OCR:', error);
            this.snackBar.open('Impossible de lire l\'ordonnance', 'Erreur', { duration: 3000 });
        } finally {
            this.isProcessingOcr = false;
            this.cdr.markForCheck();
        }
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

    formatFileSize(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // --- Camera Methods ---
    async openCamera(): Promise<void> {
        const dialogRef = this.dialog.open(CameraCaptureDialogComponent, {
            width: '800px',
            disableClose: true
        });

        dialogRef.afterClosed().subscribe(dataUrl => {
            if (dataUrl) {
                this.handleCapturedPhoto(dataUrl);
            }
        });
    }

    private handleCapturedPhoto(dataUrl: string): void {
        const file = this.dataURLtoFile(dataUrl, `photo_${Date.now()}.jpg`);
        const prescriptionFile: PrescriptionFile = {
            name: file.name,
            type: file.type,
            size: file.size,
            preview: dataUrl,
            file,
            uploadDate: new Date()
        };
        this.prescriptionFiles.push(prescriptionFile);
        this.extractData(prescriptionFile); // Auto OCR on capture
        this.cdr.markForCheck();
    }

    private dataURLtoFile(dataurl: string, filename: string): File {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)![1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    }


}
