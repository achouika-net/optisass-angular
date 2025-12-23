import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
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
import { FactureFormComponent } from '../../factures/facture-form/facture-form.component';
import { PaymentListComponent } from '../../payments/payment-list/payment-list.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { StockSearchDialogComponent } from '../../../stock-management/components/stock-search-dialog/stock-search-dialog.component';

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
        MatDialogModule
    ],
    templateUrl: './lentilles-form.component.html',
    styleUrls: ['./lentilles-form.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LentillesFormComponent implements OnInit {
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
    linkedFacture: any = null;

    constructor(
        private fb: FormBuilder,
        private route: ActivatedRoute,
        private router: Router,
        private ficheService: FicheService,
        private clientService: ClientManagementService,
        private factureService: FactureService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef
    ) {
        this.ficheForm = this.initForm();
    }

    ngOnInit(): void {
        this.clientId = this.route.snapshot.paramMap.get('clientId');
        this.ficheId = this.route.snapshot.paramMap.get('id');

        if (this.clientId) {
            this.loadClient();
        }

        if (this.ficheId && this.ficheId !== 'new') {
            this.isEditMode = false;
            this.ficheForm.disable();
            this.loadFiche();
            this.loadLinkedInvoice();
        } else {
            this.isEditMode = true;
            this.ficheForm.enable();
            // Default dates
            this.ficheForm.patchValue({
                ordonnance: { datePrescription: new Date() },
                adaptation: { dateEssai: new Date() }
            });
        }
    }

    toggleEditMode(): void {
        this.isEditMode = !this.isEditMode;
        if (this.isEditMode) {
            this.ficheForm.enable();
            // Ensure derived/calculated fields are disabled if necessary
        } else {
            this.ficheForm.disable();
        }
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
                    k2: ['']
                }),
                og: this.fb.group({
                    sphere: [''],
                    cylindre: [''],
                    axe: [''],
                    addition: [''],
                    k1: [''],
                    k2: ['']
                })
            }),

            // Sélection Lentilles
            lentilles: this.fb.group({
                type: [ContactLensType.MENSUELLE, Validators.required],
                usage: [ContactLensUsage.MYOPIE, Validators.required],
                diffLentilles: [false],
                od: this.fb.group({
                    axe: [''],
                    addition: [''],
                    prix: [0],
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
                hvid: [''], pupilPhot: [''], pupilMes: [''], but: [''], k1: [''], k2: [''],
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
                this.cdr.markForCheck();
            },
            error: (err) => console.error('Error loading fiche:', err)
        });
    }

    loadLinkedInvoice() {
        if (!this.ficheId) return;
        // Mock logic: find first invoice for this fiche
        // Ideally backend provides this or we search invoices by ficheId
        this.factureService.findAll().subscribe(factures => {
            this.linkedFacture = factures.find(f => f.ficheId === this.ficheId) || { id: 'new' };
            this.cdr.markForCheck();
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
        // Optionally update fiche status or total
        this.cdr.markForCheck();
    }

    // --- Navigation ---
    setActiveTab(index: number): void { this.activeTab = index; }
    nextTab(): void { if (this.activeTab < 5) this.activeTab++; } // Increased max tab
    prevTab(): void { if (this.activeTab > 0) this.activeTab--; }
    goBack(): void {
        this.router.navigate(['/p/clients', this.clientId]);
    }

    // --- Stock Search ---
    openStockSearch(target: 'od' | 'og') {
        const dialogRef = this.dialog.open(StockSearchDialogComponent, {
            width: '1000px',
            maxWidth: '100vw',
            data: {
                type: 'LENTILLE',
                hidePrices: false,
                context: 'sales'
            }
        });

        dialogRef.afterClosed().subscribe(product => {
            if (product) {
                this.fillProductDetails(product, target);
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

    async onPaymentAdded() {
        console.log('💰 [EVENT] Payment Added - Checking for archiving decision...');

        // 1. Detect if we have any valid products with stock
        const invoiceLines = this.initialInvoiceLines;
        const productsWithStock = invoiceLines.filter(l => l.productId && l.entrepotId);

        if (productsWithStock.length === 0) {
            console.log('ℹ️ No products with stock detected. No special alert needed.');
            return;
        }

        const warehouses = [...new Set(productsWithStock.map(p => p.entrepotNom || p.entrepotType))].join(' / ');
        const message = `Vente effectuée depuis l'entrepôt : ${warehouses}.\n\nSouhaitez-vous VALIDER la vente ou la LAISSER EN INSTANCE ?`;

        const choice = confirm(`${message}\n\nOK = Valider\nAnnuler = En Instance`);

        if (choice) {
            try {
                this.loading = true;
                const factures = await firstValueFrom(this.factureService.findAll({ clientId: this.clientId || '' }));
                const currentFacture = factures.find(f => f.ficheId === this.ficheId);

                if (currentFacture) {
                    console.log('📄 Converting Devis to official Facture:', currentFacture.numero);
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
                            validatedAt: new Date()
                        }
                    };

                    this.factureService.update(currentFacture.id, updateData).subscribe({
                        next: (res) => {
                            this.loading = false;
                            this.snackBar.open('Vente validée et facture générée avec succès', 'Fermer', { duration: 5000 });
                            this.onInvoiceSaved(res);
                        },
                        error: (err) => {
                            this.loading = false;
                            console.error('❌ Error validating sale:', err);
                            alert("Erreur lors de la validation: " + (err.message || 'Erreur inconnue'));
                        }
                    });
                } else {
                    console.warn('⚠️ No associated quote found to validate.');
                    this.loading = false;
                }
            } catch (e) {
                console.error('Error fetching invoices for validation:', e);
                this.loading = false;
            }
        } else {
            // User might want to archive later or manually. 
            // In MontureForm we call archiveFicheFacture(currentFacture) if they say "Archive"
            // But here the confirm is "Validate" or "Stay as Devis".
            // If they want to archive, they usually do it via a separate button or naturally.
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
    onSubmit(): void {
        if (this.ficheForm.invalid) {
            alert('Veuillez remplir tous les champs obligatoires.');
            return;
        }

        this.loading = true;
        const formValue = this.ficheForm.value;

        // Calculate total
        const prixOD = parseFloat(formValue.lentilles.od.prix) || 0;
        const prixOG = parseFloat(formValue.lentilles.diffLentilles ? formValue.lentilles.og.prix : formValue.lentilles.od.prix) || 0;
        const total = prixOD + prixOG; // Simplified

        const payload: any = {
            clientId: this.clientId,
            type: 'DEVIS', // Always starts as DEVIS
            statut: 'DEVIS_EN_COURS', // Always starts as DEVIS_EN_COURS
            montantTotal: total,
            montantPaye: 0,
            prescription: formValue.ordonnance,
            lentilles: formValue.lentilles,
            adaptation: formValue.adaptation,
            suiviCommande: formValue.suiviCommande
        };

        const request = (this.ficheId && this.ficheId !== 'new')
            ? this.ficheService.updateFiche(this.ficheId, payload)
            : this.ficheService.createFicheLentilles(payload);

        request.subscribe({
            next: (fiche) => {
                this.loading = false;
                this.ficheId = fiche.id; // Update ID if creating
                this.isEditMode = false;
                this.ficheForm.disable(); // Return to view mode
                this.loadFiche(); // Reload to be sure
                alert('Fiche enregistrée avec succès');
            },
            error: (err) => {
                console.error(err);
                this.loading = false;
                alert('Erreur lors de l\'enregistrement');
            }
        });
    }

    onSuggestionGenerated(suggestion: any): void {
        // Suggestion handled by child, potentially trigger re-calc of visual aid
    }
}
