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
import { ClientService } from '../../services/client.service';
import { FactureService } from '../../services/facture.service';
import { FicheLentillesCreate, TypeFiche, StatutFiche } from '../../models/fiche-client.model';
import { Client, ClientParticulier, ClientProfessionnel, isClientParticulier, isClientProfessionnel } from '../../models/client.model';
import { ContactLensType, ContactLensUsage } from '../../../../shared/interfaces/product.interface';
import { FactureFormComponent } from '../../factures/facture-form/facture-form.component';
import { PaymentListComponent } from '../../payments/payment-list/payment-list.component';

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
        PaymentListComponent
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
        private clientService: ClientService,
        private factureService: FactureService,
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
                    marque: ['', Validators.required],
                    modele: [''],
                    rayon: ['', Validators.required],
                    diametre: ['', Validators.required],
                    sphere: [''],
                    cylindre: [''],
                    axe: [''],
                    addition: [''],
                    prix: [0]
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
                    prix: [0]
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
                qte: 1, // Or pack size default
                prixUnitaireTTC: lentilles.od.prix || 0,
                remise: 0,
                totalTTC: lentilles.od.prix || 0
            });
        }

        // OG
        if (this.diffLentilles && lentilles.og && lentilles.og.marque) {
            lines.push({
                description: `Lentille OG: ${lentilles.og.marque} ${lentilles.og.modele || ''} - ${lentilles.type}`,
                qte: 1,
                prixUnitaireTTC: lentilles.og.prix || 0,
                remise: 0,
                totalTTC: lentilles.og.prix || 0
            });
        } else if (!this.diffLentilles && lentilles.od && lentilles.od.marque) {
            // Same lens twice or pack of 2? Usually sell boxes.
            // Assuming 1 box per eye for now or 2 boxes identical
            lines.push({
                description: `Lentille OG: ${lentilles.od.marque} ${lentilles.od.modele || ''} - ${lentilles.type}`,
                qte: 1,
                prixUnitaireTTC: lentilles.od.prix || 0,
                remise: 0,
                totalTTC: lentilles.od.prix || 0
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
            type: TypeFiche.LENTILLES,
            statut: formValue.suiviCommande.statut === 'LIVRE_CLIENT' ? StatutFiche.LIVRE :
                formValue.suiviCommande.statut === 'COMMANDE' ? StatutFiche.COMMANDE : StatutFiche.EN_COURS,
            montantTotal: total,
            montantPaye: 0, // Should be calculated linked
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
