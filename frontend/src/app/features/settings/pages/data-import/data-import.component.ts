import { Component, OnInit, ViewChild, ElementRef, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatStepperModule } from '@angular/material/stepper';
import { ImportService } from '../../../../core/services/import.service';
import { WarehousesService } from '../../../warehouses/services/warehouses.service';
import { Store } from '@ngrx/store';
import { UserCurrentCentreSelector } from '../../../../core/store/auth/auth.selectors';
import { lastValueFrom } from 'rxjs';

@Component({
    selector: 'app-data-import',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTableModule,
        MatSnackBarModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        MatStepperModule
    ],
    templateUrl: './data-import.component.html',
    styleUrls: ['./data-import.component.scss']
})
export class DataImportComponent implements OnInit {
    importForm!: FormGroup;
    mappingForm!: FormGroup;

    private store = inject(Store); // Inject Store
    private cdr = inject(ChangeDetectorRef);


    selectedFile: File | null = null;
    csvHeaders: string[] = [];
    previewData: any[] = [];
    fullData: any[] = []; // Store full dataset
    warehouses: any[] = [];

    isUploading = false;
    isImporting = false;
    importResult: any = null;
    importProgress = 0;
    importTotalRows = 0;
    currentBatchIndex = 0;
    totalBatches = 0;

    // Available database fields for mapping
    // Available database fields for mapping
    targetFields: any = {
        depenses: [
            { value: 'date', label: 'Date' },
            { value: 'montant', label: 'Montant' },
            { value: 'categorie', label: 'Catégorie' },
            { value: 'description', label: 'Description / Libellé' },
            { value: 'modePaiement', label: 'Mode de Paiement' },
            { value: 'statut', label: 'Statut (PAYEE/IMPAYEE)' },
            { value: 'fournisseur', label: 'Fournisseur (Nom)' },
            { value: 'numeroFacture', label: 'N° Facture (Exclure ligne si présent)' },
            { value: 'notes', label: 'Notes' }
        ],
        clients: [
            { value: 'codeClient', label: 'Code Client (Interne)' },
            { value: 'titre', label: 'Titre (Mr, Mme...)' },
            { value: 'nom', label: 'Nom' },
            { value: 'prenom', label: 'Prénom' },
            { value: 'dateNaissance', label: 'Date de Naissance' },
            { value: 'couvertureSociale', label: 'Couverture Sociale (Assurance)' },
            { value: 'numCouvertureSociale', label: 'N° Couverture Sociale' },
            { value: 'dateCreation', label: 'Date Saisie / Création' },
            { value: 'raisonSociale', label: 'Raison Sociale' },
            { value: 'telephone', label: 'Téléphone' },
            { value: 'email', label: 'Email' },
            { value: 'adresse', label: 'Adresse' },
            { value: 'ville', label: 'Ville' },
            { value: 'codePostal', label: 'Code Postal' },
            { value: 'cin', label: 'CIN' },
            { value: 'ice', label: 'ICE' },
            { value: 'identifiantFiscal', label: 'Identifiant Fiscal' },
            { value: 'registreCommerce', label: 'Registre Commerce' },
            { value: 'patente', label: 'Patente' },
            { value: 'numeroAutorisation', label: 'Numéro Autorisation' },
            { value: 'siteWeb', label: 'Site Web' },
            { value: 'commentaires', label: 'Commentaires' },
            { value: 'pointsFidelite', label: 'Points Fidélité' },
            { value: 'solde', label: 'Solde Initial' }
        ],
        products: [
            { value: 'codeInterne', label: 'Code Interne' },
            { value: 'codeBarres', label: 'Code Barre' },
            { value: 'referenceFournisseur', label: 'Référence Fournisseur' },
            { value: 'designation', label: 'Désignation' },
            { value: 'marque', label: 'Marque' },
            { value: 'modele', label: 'Modèle' },
            { value: 'couleur', label: 'Couleur' },
            { value: 'typeArticle', label: 'Type Article' },
            { value: 'famille', label: 'Famille' },
            { value: 'sousFamille', label: 'Sous-Famille' },
            { value: 'fournisseurPrincipal', label: 'Fournisseur Principal' },
            { value: 'montage', label: 'Montage (Type Cerclage)' },
            { value: 'prixAchatHT', label: 'Prix Achat HT' },
            { value: 'prixVenteHT', label: 'Prix Vente HT' },
            { value: 'prixVenteTTC', label: 'Prix Vente TTC' },
            { value: 'coefficient', label: 'Coefficient' },
            { value: 'tauxTVA', label: 'Taux TVA' },
            { value: 'quantiteActuelle', label: 'Quantité' },
            { value: 'seuilAlerte', label: 'Seuil Alerte' },
            { value: 'photo', label: 'URL Photo' }, // Added
            { value: 'statut', label: 'Statut' } // Added
        ],
        fiches: [
            // Identifiants Client
            { value: 'codeClient', label: 'Code Client (Reconnaissance)' },
            { value: 'nom', label: 'Nom Client (Si code absent)' },
            { value: 'telephone', label: 'Téléphone Client (Si code absent)' },

            // Infos Fiche
            { value: 'statut', label: 'Statut Dossier (Livre, Commande...)' },
            { value: 'dateCreation', label: 'Date de Création' },
            { value: 'dateLivraisonEstimee', label: 'Date Livraison Estimée' },
            { value: 'montantTotal', label: 'Montant Total' },
            { value: 'montantPaye', label: 'Acompte / Payé' },

            // Ordonnance - OD
            { value: 'od_sphere', label: 'Sphère OD' },
            { value: 'od_cylindre', label: 'Cylindre OD' },
            { value: 'od_axe', label: 'Axe OD' },
            { value: 'od_addition', label: 'Addition OD' },
            { value: 'ep_od', label: 'Écart Pupillaire OD' },

            // Ordonnance - OG
            { value: 'og_sphere', label: 'Sphère OG' },
            { value: 'og_cylindre', label: 'Cylindre OG' },
            { value: 'og_axe', label: 'Axe OG' },
            { value: 'og_addition', label: 'Addition OG' },
            { value: 'ep_og', label: 'Écart Pupillaire OG' },

            // Medecin / Date
            { value: 'date_ordonnance', label: 'Date Ordonnance' },
            { value: 'nom_medecin', label: 'Nom du Médecin' },

            // Monture
            { value: 'monture_marque', label: 'Monture: Marque' },
            { value: 'monture_modele', label: 'Monture: Modèle' },
            { value: 'monture_reference', label: 'Monture: Référence' },
            { value: 'monture_prix', label: 'Monture: Prix Vente' },

            // Verres
            { value: 'verres_type', label: 'Verres: Type (Progressif, etc.)' },
            { value: 'verres_indice', label: 'Verres: Indice' },
            { value: 'verres_matiere', label: 'Verres: Matière' },
            { value: 'verres_marque', label: 'Verres: Marque' },
            { value: 'verres_traitement', label: 'Verres: Traitement' },
            { value: 'verres_prix_od', label: 'Verres: Prix OD' },
            { value: 'verres_prix_og', label: 'Verres: Prix OG' },

            // Split Verres (Optionnel)
            { value: 'verres_marque_od', label: 'V OD: Marque' },
            { value: 'verres_matiere_od', label: 'V OD: Matière' },
            { value: 'verres_indice_od', label: 'V OD: Indice' },
            { value: 'verres_traitement_od', label: 'V OD: Traitement' },
            { value: 'verres_marque_og', label: 'V OG: Marque' },
            { value: 'verres_matiere_og', label: 'V OG: Matière' },
            { value: 'verres_indice_og', label: 'V OG: Indice' },
            { value: 'verres_traitement_og', label: 'V OG: Traitement' },

            { value: 'notes', label: 'Notes / Observations' },
            { value: 'fiche_type', label: 'Type Manuel (monture/lentilles)' }
        ],
        fiches_lentilles: [
            { value: 'codeClient', label: 'Code Client (Reconnaissance)' },
            { value: 'nom', label: 'Nom Client (Si code absent)' },
            { value: 'telephone', label: 'Téléphone Client (Si code absent)' },

            // Prescription Lentilles - OD
            { value: 'od_sphere', label: 'L1 OD: Sphère' },
            { value: 'od_cylindre', label: 'L1 OD: Cylindre' },
            { value: 'od_axe', label: 'L1 OD: Axe' },
            { value: 'od_addition', label: 'L1 OD: Addition' },
            { value: 'od_rayon', label: 'L1 OD: Rayon (BC)' },
            { value: 'od_diametre', label: 'L1 OD: Diamètre' },
            { value: 'od_k1', label: 'L1 OD: K1' },
            { value: 'od_k2', label: 'L1 OD: K2' },

            // Prescription Lentilles - OG
            { value: 'og_sphere', label: 'L1 OG: Sphère' },
            { value: 'og_cylindre', label: 'L1 OG: Cylindre' },
            { value: 'og_axe', label: 'L1 OG: Axe' },
            { value: 'og_addition', label: 'L1 OG: Addition' },
            { value: 'og_rayon', label: 'L1 OG: Rayon (BC)' },
            { value: 'og_diametre', label: 'L1 OG: Diamètre' },
            { value: 'og_k1', label: 'L1 OG: K1' },
            { value: 'og_k2', label: 'L1 OG: K2' },

            // Détails Lentilles
            { value: 'lentilles_marque', label: 'L1: Marque' },
            { value: 'lentilles_modele', label: 'L1: Modèle' },
            { value: 'lentilles_usage', label: 'L1: Usage' },

            // Infos Fiche
            { value: 'statut', label: 'Statut Dossier' },
            { value: 'dateCreation', label: 'Date de Création' },
            { value: 'dateLivraisonEstimee', label: 'Date Livraison Estimée' },
            { value: 'montantTotal', label: 'Montant Total' },
            { value: 'montantPaye', label: 'Acompte / Payé' },
            { value: 'notes', label: 'Notes / Observations' },
            { value: 'fiche_type', label: 'Type Manuel (monture/lentilles)' }
        ],
        fiches_produits: [
            { value: 'codeClient', label: 'Code Client (Reconnaissance)' },
            { value: 'nom', label: 'Nom Client (Si code absent)' },
            { value: 'telephone', label: 'Téléphone Client (Si code absent)' },

            // Produit vendu (Sera traité comme une ligne d'accessoire)
            { value: 'produit_ref', label: 'P1: Référence' },
            { value: 'produit_designation', label: 'P1: Désignation' },
            { value: 'produit_qte', label: 'P1: Quantité' },
            { value: 'produit_prix', label: 'P1: Prix Unitaire' },

            // Infos Fiche
            { value: 'statut', label: 'Statut Dossier' },
            { value: 'dateCreation', label: 'Date de Création' },
            { value: 'dateLivraisonEstimee', label: 'Date Livraison Estimée' },
            { value: 'montantTotal', label: 'Montant Total' },
            { value: 'montantPaye', label: 'Acompte / Payé' },
            { value: 'notes', label: 'Notes / Observations' }
        ],
        fiches_unifiees: [
            // IDENTIFICATION (CRUCIAL)
            { value: 'codeClient', label: 'Code Client (Reconnaissance)' },
            { value: 'nom', label: 'Nom Client (Si code absent)' },
            { value: 'telephone', label: 'Téléphone Client (Si code absent)' },
            { value: 'fiche_type', label: 'Type Manuel (monture/lentilles)' },
            { value: 'fiche_id', label: 'ID Fiche / Regroupement' },

            // PRESCRIPTION COMMUNE
            { value: 'od_sphere', label: 'OD: Sphère' },
            { value: 'od_cylindre', label: 'OD: Cylindre' },
            { value: 'od_axe', label: 'OD: Axe' },
            { value: 'od_addition', label: 'OD: Addition' },
            { value: 'og_sphere', label: 'OG: Sphère' },
            { value: 'og_cylindre', label: 'OG: Cylindre' },
            { value: 'og_axe', label: 'OG: Axe' },
            { value: 'og_addition', label: 'OG: Addition' },

            // PARAMÈTRES LENTILLES (L1)
            { value: 'od_rayon', label: 'L1 OD: Rayon (BC)' },
            { value: 'od_diametre', label: 'L1 OD: Diamètre' },
            { value: 'od_k1', label: 'L1 OD: K1' },
            { value: 'od_k2', label: 'L1 OD: K2' },
            { value: 'og_rayon', label: 'L1 OG: Rayon (BC)' },
            { value: 'og_diametre', label: 'L1 OG: Diamètre' },
            { value: 'og_k1', label: 'L1 OG: K1' },
            { value: 'og_k2', label: 'L1 OG: K2' },

            // Équipement 1: Monture
            { value: 'monture_marque', label: 'M1: Marque' },
            { value: 'monture_modele', label: 'M1: Modèle' },
            { value: 'monture_reference', label: 'M1: Référence' },
            { value: 'monture_prix', label: 'M1: Prix Vente' },

            // Équipement 1: Verres (Unifiés ou OD/OG)
            { value: 'verres_marque', label: 'V1: Marque' },
            { value: 'verres_type', label: 'V1: Type' },
            { value: 'verres_indice', label: 'V1: Indice' },
            { value: 'verres_matiere', label: 'V1: Matière' },
            { value: 'verres_traitement', label: 'V1: Traitement' },
            { value: 'verres_prix_od', label: 'V1: Prix OD' },
            { value: 'verres_prix_og', label: 'V1: Prix OG' },

            // Split Verres 1 (Optionnel: si colonnes distinctes OD/OG)
            { value: 'verres_marque_od', label: 'V1 OD: Marque' },
            { value: 'verres_matiere_od', label: 'V1 OD: Matière' },
            { value: 'verres_indice_od', label: 'V1 OD: Indice' },
            { value: 'verres_marque_og', label: 'V1 OG: Marque' },
            { value: 'verres_matiere_og', label: 'V1 OG: Matière' },
            { value: 'verres_indice_og', label: 'V1 OG: Indice' },
            { value: 'verres_traitement_od', label: 'V1 OD: Traitement' },
            { value: 'verres_traitement_og', label: 'V1 OG: Traitement' },

            { value: 'ep_od', label: 'Écart Pupillaire OD' },
            { value: 'ep_og', label: 'Écart Pupillaire OG' },

            // Équipement 2: Monture + Verres
            { value: 'monture2_marque', label: 'M2: Marque' },
            { value: 'monture2_modele', label: 'M2: Modèle' },
            { value: 'monture2_reference', label: 'M2: Référence' },
            { value: 'monture2_prix', label: 'M2: Prix Vente' },
            { value: 'verres2_marque', label: 'V2: Marque' },
            { value: 'verres2_matiere', label: 'V2: Matière' },
            { value: 'verres2_matiere_od', label: 'V2 OD: Matière' },
            { value: 'verres2_matiere_og', label: 'V2 OG: Matière' },
            { value: 'verres2_indice', label: 'V2: Indice' },
            { value: 'verres2_prix_od', label: 'V2: Prix OD' },
            { value: 'verres2_prix_og', label: 'V2: Prix OG' },

            // Lentilles 1 & 2
            { value: 'lentilles_marque', label: 'L1: Marque' },
            { value: 'lentilles_modele', label: 'L1: Modèle' },
            { value: 'lentilles_usage', label: 'L1: Usage' },
            { value: 'lentilles_prix', label: 'L1: Prix' },
            { value: 'lentille2_marque', label: 'L2: Marque' },
            { value: 'lentille2_modele', label: 'L2: Modèle' },
            { value: 'lentilles_prix2', label: 'L2: Prix' },

            // Produits / Accessoires 1 & 2
            { value: 'produit_ref', label: 'P1: Référence' },
            { value: 'produit_designation', label: 'P1: Désignation' },
            { value: 'produit_prix', label: 'P1: Prix' },
            { value: 'produit2_ref', label: 'P2: Référence' },
            { value: 'produit2_designation', label: 'P2: Désignation' },
            { value: 'produit2_prix', label: 'P2: Prix' },

            // Infos Communes
            { value: 'dateCreation', label: 'Date de Création' },
            { value: 'statut', label: 'Statut Dossier' },
            { value: 'montantTotal', label: 'Prix Total' },
            { value: 'montantPaye', label: 'Acompte / Payé' },
            { value: 'nom_medecin', label: 'Nom du Médecin' },
            { value: 'fournisseur', label: 'Fournisseur' },
            { value: 'dateLivraisonEstimee', label: 'Date Livraison (Est.)' },
            { value: 'notes', label: 'Notes / Observations' }
        ],
        fournisseurs: [
            { value: 'code', label: 'Code Fournisseur' },
            { value: 'nom', label: 'Nom / Raison Sociale' },
            { value: 'contact', label: 'Personne de Contact' },
            { value: 'telephone', label: 'Téléphone' },
            { value: 'email', label: 'Email' },
            { value: 'adresse', label: 'Adresse' },
            { value: 'ville', label: 'Ville' },
            { value: 'siteWeb', label: 'Site Web' },
            { value: 'ice', label: 'ICE (Identifiant Commun Entreprise)' },
            { value: 'rc', label: 'RC (Registre de Commerce)' },
            { value: 'identifiantFiscal', label: 'Identifiant Fiscal' },
            { value: 'patente', label: 'Patente' },
            { value: 'cnss', label: 'CNSS' },
            { value: 'rib', label: 'RIB' },
            { value: 'banque', label: 'Banque' },
            { value: 'conditionsPaiement', label: 'Conditions de Paiement' }
        ],
        factures_fournisseurs: [
            { value: 'numeroFacture', label: 'N° Facture' },
            { value: 'codeFournisseur', label: 'Code Fournisseur' },
            { value: 'nomFournisseur', label: 'Nom Fournisseur (si code absent)' },
            { value: 'dateEmission', label: 'Date Facture' },
            { value: 'dateEcheance', label: 'Date Échéance' },
            { value: 'montantHT', label: 'Montant HT' },
            { value: 'montantTVA', label: 'Montant TVA' },
            { value: 'montantTTC', label: 'Montant TTC' },
            { value: 'statut', label: 'Statut (A_PAYER/PAYEE/PARTIELLE)' },
            { value: 'type', label: 'Type (ACHAT_STOCK/AUTRE)' },
            { value: 'notes', label: 'Notes' }
        ],
        paiements_fournisseurs: [
            { value: 'numeroFacture', label: 'N° Facture Fournisseur' },
            { value: 'codeFournisseur', label: 'Code Fournisseur' },
            { value: 'datePaiement', label: 'Date Paiement' },
            { value: 'montant', label: 'Montant Payé' },
            { value: 'modePaiement', label: 'Mode Paiement (Espèces/Chèque/Virement)' },
            { value: 'reference', label: 'Référence (N° Chèque/Virement)' },
            { value: 'notes', label: 'Notes' }
        ],
        factures_ventes: [
            { value: 'numero', label: 'N° Facture' },
            { value: 'codeClient', label: 'Code Client' },
            { value: 'nomClient', label: 'Nom Client (si code absent)' },
            { value: 'type', label: 'Type (DEVIS/FACTURE/BON_COMMANDE)' },
            { value: 'dateEmission', label: 'Date Facture' },
            { value: 'dateEcheance', label: 'Date Échéance' },
            { value: 'totalHT', label: 'Total HT' },
            { value: 'totalTVA', label: 'Total TVA' },
            { value: 'totalTTC', label: 'Total TTC' },
            { value: 'statut', label: 'Statut (BROUILLON/VALIDEE/PAYEE/ANNULEE)' },
            { value: 'notes', label: 'Notes' }
        ],
        paiements_clients: [
            { value: 'numeroFacture', label: 'N° Facture' },
            { value: 'codeClient', label: 'Code Client' },
            { value: 'datePaiement', label: 'Date Paiement' },
            { value: 'montant', label: 'Montant Payé' },
            { value: 'modePaiement', label: 'Mode Paiement (Espèces/Chèque/Carte/Virement)' },
            { value: 'reference', label: 'Référence' },
            { value: 'notes', label: 'Notes' }
        ]
    };

    currentFields: any[] = [];

    constructor(
        private fb: FormBuilder,
        private importService: ImportService,
        private warehouseService: WarehousesService,
        private snackBar: MatSnackBar
    ) { }

    ngOnInit() {
        this.importForm = this.fb.group({
            type: ['clients', Validators.required],
            warehouseId: [null]
        });

        this.mappingForm = this.fb.group({});

        // Load available fields on type change
        this.importForm.get('type')?.valueChanges.subscribe(type => {
            this.currentFields = this.targetFields[type] || [];
            this.updateMappingControls();

            // Validation for product import
            const warehouseControl = this.importForm.get('warehouseId');
            if (type === 'products') {
                warehouseControl?.setValidators(Validators.required);
                this.loadWarehouses();
            } else {
                warehouseControl?.clearValidators();
            }
            warehouseControl?.updateValueAndValidity();
        });

        this.currentFields = this.targetFields['clients'];
        this.updateMappingControls();
    }

    loadWarehouses() {
        console.log('Loading warehouses...');
        this.warehouseService.findAll().subscribe({
            next: (data: any[]) => {
                console.log('Warehouses loaded:', data);
                this.warehouses = data;
                if (this.warehouses.length === 0) {
                    this.snackBar.open('Aucun entrepôt trouvé', 'Fermer', { duration: 3000 });
                }
            },
            error: (err) => {
                console.error('Error loading warehouses:', err);
                this.snackBar.open('Erreur lors du chargement des entrepôts', 'Fermer');
            }
        });
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.selectedFile = file;
        }
    }

    uploadAndParse(): Promise<void> {
        if (!this.selectedFile) return Promise.resolve();

        this.isUploading = true;
        console.log('🔵 Starting upload for file:', this.selectedFile.name);

        return new Promise((resolve, reject) => {
            this.importService.uploadFile(this.selectedFile!).subscribe({
                next: (res) => {
                    console.log('🟢 Upload response received:', res);
                    console.log('🔍 Response structure check:');
                    console.log('  - typeof res:', typeof res);
                    console.log('  - res.headers exists?', 'headers' in res);
                    console.log('  - res.headers value:', res.headers);
                    console.log('  - res.headers type:', typeof res.headers);
                    console.log('  - res.headers is array?', Array.isArray(res.headers));
                    console.log('  - res.headers length:', res.headers?.length);
                    console.log('  - res.preview exists?', 'preview' in res);
                    console.log('  - res.preview length:', res.preview?.length);

                    this.csvHeaders = res.headers || [];
                    this.previewData = res.preview || [];
                    this.fullData = res.data || []; // Capture full data

                    console.log('📊 After assignment:');
                    console.log('  - this.csvHeaders:', this.csvHeaders);
                    console.log('  - this.csvHeaders.length:', this.csvHeaders.length);
                    console.log('  - this.previewData.length:', this.previewData.length);
                    console.log('  - this.fullData.length:', this.fullData.length);

                    this.isUploading = false;
                    this.updateMappingControls();

                    if (this.csvHeaders.length === 0) {
                        console.error('❌ No headers detected!');
                        this.snackBar.open('Aucune colonne détectée dans le fichier', 'Fermer', { duration: 5000 });
                    } else {
                        console.log('✅ Headers detected successfully:', this.csvHeaders.length, 'columns');
                    }
                    resolve();
                },
                error: (err) => {
                    console.error('🔴 Upload error:', err);
                    this.snackBar.open('Erreur lors du chargement du fichier: ' + (err.error?.message || err.message), 'Fermer');
                    this.isUploading = false;
                    reject(err);
                }
            });
        });
    }

    updateMappingControls() {
        // AI-like Mapping Dictionary
        const synonyms: { [key: string]: string[] } = {
            // Clients
            'codeClient': ['code', 'ref', 'id', 'interne', 'client_id', 'matricule', 'reference', 'client', 'ref client', 'id client', 'code_client'],
            'titre': ['civ', 'civilite', 'genre', 'title', 'mr', 'mme', 'sexe', 'p_titre', 'civilite client'],
            'nom': ['lastname', 'name', 'nom_famille', 'nom_client'],
            'prenom': ['firstname', 'first_name', 'prenom', 'prenom client', 'prenom_client'],
            'dateNaissance': ['dn', 'naissance', 'born', 'date_naissance', 'birth_date', 'date de naissance'],
            'couvertureSociale': ['assurance', 'mutuelle', 'couverture', 'sociale', 'insurance', 'organisme'],
            'numCouvertureSociale': ['numero_assurance', 'n_assurance', 'num_mutuelle', 'insurance_number', 'policy_id', 'numero mutuelle'],
            'dateCreation': ['date', 'creation', 'saisie', 'ajout', 'date_creation', 'created_at', 'date dossier'],
            'raisonSociale': ['societe', 'company', 'entreprise', 'rs', 'raison', 'raison_sociale'],
            'email': ['mail', 'e-mail', 'courriel', 'adresse mail'],
            'telephone': ['tel', 'phone', 'mobile', 'gsm', 'fixe', 'contact'],
            'adresse': ['address', 'rue', 'voie', 'localisation', 'addr', 'adresse client'],
            'ville': ['city', 'commune', 'town', 'ville client'],
            'codePostal': ['cp', 'zip', 'zipcode', 'code_postal', 'cp client'],
            'cin': ['cin', 'cni', 'identite', 'id_card', 'cin client'],
            'ice': ['ice_id', 'identifiant_ice', 'ice'],
            'identifiantFiscal': ['if', 'fiscal', 'nif', 'id_fiscal', 'tax_id', 'if client'],
            'registreCommerce': ['rc', 'registre', 'commerce', 'cr', 'reg_commerce', 'rc client'],
            'patente': ['patente_id', 'taxe_pro', 'patente client'],
            'numeroAutorisation': ['autorisation', 'license', 'num_auth'],
            'siteWeb': ['web', 'website', 'url', 'site'],
            'commentaires': ['notes', 'comment', 'obs', 'observation', 'remarque', 'observations'],
            'pointsFidelite': ['points', 'fidelite', 'loyalty'],

            // Products
            'codeInterne': ['code', 'ref', 'reference', 'id', 'interne', 'article_id', 'code_article'],
            'codeBarres': ['ean', 'cip', 'barcode', 'code_barre', 'cb', 'ean13', 'upc'],
            'designation': ['libelle', 'nom', 'article', 'description', 'produit', 'name', 'libellé'],
            'marque': ['brand', 'marque', 'fabricant', 'brand_name'],
            'modele': ['model', 'modele', 'ref_modele', 'modèle'],
            'couleur': ['color', 'couleur', 'teinte', 'coloris'],
            'typeArticle': ['type', 'categorie', 'famille_article'],
            'famille': ['famille', 'family', 'cat', 'category'],
            'sousFamille': ['sous_famille', 'sub_category', 'sub'],
            'fournisseurPrincipal': ['fournisseur', 'supplier', 'prov', 'provider'],
            'montage': ['cerclage', 'type_monture', 'montage', 'systeme', 'type_m1'],
            'prixAchatHT': ['pa', 'achat', 'cout', 'cost', 'prix_achat', 'pmp'],
            'prixVenteHT': ['pv', 'vente_ht', 'prix_vente_ht', 'pvht'],
            'prixVenteTTC': ['pv_ttc', 'pvttc', 'prix_ttc', 'prix_vente', 'pvttc'],
            'coefficient': ['coeff', 'marge', 'markup'],
            'tauxTVA': ['tva', 'vat', 'taxe'],
            'quantiteActuelle': ['stock', 'qte', 'quantite', 'quantité', 'dispo'],

            // Fiches
            'fiche_id': ['id_fiche', 'fiche_id', 'numero_fiche', 'fiche_no', 'n_fiche', 'folder_id', 'dossier_id', 'client', 'ref client', 'n dossier', 'ndossier'],
            'fiche_type': ['type_fiche', 'type', 'fiche', 'categorie', 'cat', 'category', 'dossier_type', 'kind', 'typedossier', 'type dossier'],
            'od_sphere': ['od_sph', 'sph_od', 'sphere_od', 'od_sphere', 'od_sph1', 'od : sph', 'sph', 'sph_od', 'sphod', 'od_sph_1'],
            'od_cylindre': ['od_cyl', 'cyl_od', 'cylindre_od', 'od_cylindre', 'od_cyl1', 'od : cyl', 'cyl', 'cyl_od', 'cylod', 'od_cyl_1'],
            'od_axe': ['od_axe', 'axe_od', 'od_axis', 'od_axe1', 'od : axe', 'axe', 'axe_od', 'axeod', 'od_axe_1'],
            'od_addition': ['add_od', 'addition_od', 'od_add', 'od_add1', 'od : add', 'add', 'add_od', 'addod', 'od_add_1'],
            'og_sphere': ['og_sph', 'sph_og', 'sphere_og', 'og_sphere', 'og_sph1', 'og : sph', 'sph', 'sph_og', 'sphog', 'og_sph_1'],
            'og_cylindre': ['og_cyl', 'cyl_og', 'cylindre_og', 'og_cylindre', 'og_cyl1', 'og : cyl', 'cyl', 'cyl_og', 'cylog', 'og_cyl_1'],
            'og_axe': ['og_axe', 'axe_og', 'og_axis', 'og_axe1', 'og : axe', 'axe', 'axe_og', 'axeog', 'og_axe_1'],
            'og_addition': ['add_og', 'addition_og', 'og_add', 'og_add1', 'og : add', 'add', 'add_og', 'addog', 'og_add_1'],
            'ep_od': ['ecart_od', 'ep_od', 'od_ep', 'od_pd', 'pd_od', 'od_loin', 'ecart pu', 'ecpup', 'pupillaire', 'pup', 'ep_d', 'pd_d', 'ecart_d'],
            'ep_og': ['ecart_og', 'ep_og', 'og_ep', 'og_pd', 'pd_og', 'od_loin', 'ecart pu', 'ecpup', 'pupillaire', 'pup', 'ep_g', 'pd_g', 'ecart_g'],
            'monture_marque': ['marque_monture', 'monture', 'frame_brand', 'monture1', 'marque_m1', 'm_marque', 'frame1'],
            'monture_modele': ['modele_monture', 'modèle', 'frame_model', 'modele_m1', 'm_modele', 'frame1_model'],
            'monture_reference': ['ref_monture', 'reference_monture', 'frame_ref', 'ref_m1', 'm_ref', 'frame1_ref'],
            'monture_prix': ['prix_monture', 'prix_monture1', 'monture_pv', 'price_frame', 'prixm1', 'prix mt', 'prix_m1', 'm_prix'],
            'monture2_marque': ['monture2', 'marque_monture2', 'second_frame_brand', 'monture (2)', 'marque_m2', 'm2_marque', 'frame2'],
            'monture2_modele': ['modele2', 'modele_monture2', 'frame_model2', 'modele_m2', 'm2_modele', 'frame2_model'],
            'monture2_reference': ['ref2', 'reference_monture2', 'frame_ref2', 'ref_m2', 'm2_ref', 'frame2_ref'],
            'monture2_prix': ['prix_monture2', 'monture2_pv', 'price_frame2', 'prixm2', 'prix mt', 'prix_m2', 'm2_prix'],

            'verres_type': ['type_verre', 'verre_type', 'lens_type', 'type_v1', 'v_type', 'v1_type'],
            'verres_indice': ['indice_verre', 'lens_index', 'indice', 'index', 'indice_v1', 'v_indice', 'v1_indice'],
            'verres_marque': ['marque_verre', 'lens_brand', 'marqu_v1', 'v_marque'],
            'verres_matiere': ['matiere', 'material', 'matiere_verre', 'nature', 'matier_v1', 'v_matiere', 'v1_matiere'],
            'verres_traitement': ['traitement', 'coating', 'traitement_verre', 'traitement_v1', 'v_traitement', 'v1_traitement'],
            'verres_prix_od': ['prix_verre_od', 'od_lens_price', 'pd_od', 'prix v.o', 'prix_v1', 'v_prix_od', 'prix verre od'],
            'verres_prix_og': ['prix_verre_og', 'og_lens_price', 'pd_og', 'prix v.o', 'prix_v1', 'v_prix_og', 'prix verre og', 'prixv1g'],

            'verres_marque_od': ['marque_od1', 'od1_marque', 'od_marque', 'od_v_marque', 'marqu_v1', 'v1_marque_od', 'marque_v1_od'],
            'verres_matiere_od': ['matiere_od1', 'od1_matiere', 'od_matiere', 'nature_od', 'matiere_od', 'matière_od', 'matiere', 'matier_v1', 'v1_matiere_od', 'verre1d'],
            'verres_indice_od': ['indice_od1', 'od1_indice', 'od_indice', 'index_od', 'indice_od', 'indice', 'indice_v1', 'v1_indice_od'],
            'verres_marque_og': ['marque_og1', 'og1_marque', 'og_marque', 'og_v_marque', 'marqu_v1', 'v1_marque_og', 'marque_v1_og'],
            'verres_matiere_og': ['matiere_og1', 'og1_matiere', 'og_matiere', 'nature_og', 'matiere_og', 'matière_og', 'matiere', 'matier_v1', 'v1_matiere_og', 'verre 1g'],
            'verres_indice_og': ['indice_og1', 'og1_indice', 'og_indice', 'index_og', 'indice_og', 'indice', 'indice_v1', 'v1_indice_og'],
            'verres_traitement_od': ['traitement_od1', 'od1_traitement', 'od_traitement', 'traitement_od', 'traitement_v1', 'v1_traitement_od'],
            'verres_traitement_og': ['traitement_og1', 'og1_traitement', 'og_traitement', 'traitement_og', 'traitement_v1', 'v1_traitement_og'],

            // Lentilles Specific
            'od_rayon': ['rayon_od', 'bc_od', 'rayon_bc_od', 'rayon', 'bc', 'od_base1', 'base_od', 'rayon_d', 'bc_d'],
            'od_diametre': ['diametre_od', 'dia_od', 'diamètre_od', 'diametre', 'dia', 'od_base1', 'dia_od', 'diam_od', 'diam_d'],
            'og_rayon': ['rayon_og', 'bc_og', 'rayon_bc_og', 'rayon', 'bc', 'og_base1', 'base_og', 'rayon_g', 'bc_g'],
            'og_diametre': ['diametre_og', 'dia_og', 'diamètre_og', 'diametre', 'dia', 'og_base1', 'dia_og', 'diam_og', 'diam_g'],
            'od_k1': ['od_k1', 'keratoh', 'k1_od', 'k1_d'],
            'od_k2': ['od_k2', 'keratov', 'k2_od', 'k2_d'],
            'og_k1': ['og_k1', 'keratoh2', 'k1_og', 'k1_g'],
            'og_k2': ['og_k2', 'keratov2', 'k2_og', 'k2_g'],
            'lentilles_marque': ['marque_lentille', 'lens_brand', 'lentille1', 'l_marque', 'l1_marque'],
            'lentilles_modele': ['modele_lentille', 'lens_model', 'modele_lentille1', 'lentille1', 'l_modele', 'l1_modele'],
            'lentilles_usage': ['usage', 'type_frequence', 'freq1', 'frequence', 'usage_l1'],
            'lentilles_prix': ['prix_lentilles', 'prix_lentille', 'lens_price', 'prix_lentille1', 'prixl1', 'l_prix', 'l1_prix'],
            'lentilles_qte': ['qte_lentilles', 'qte_lentille', 'lens_qty', 'qte_lentille1', 'qtel1', 'l_qte', 'l1_qte'],
            'lentille2_marque': ['lentille2', 'marque_lentille2', 'lentille2', 'l2_marque', 'marque_l2'],
            'lentille2_modele': ['modele_lentille2', 'lentille2_mod', 'lentille2', 'l2_modele', 'modele_l2'],
            'lentilles_prix2': ['prix_lentille2', 'lentille2_prix', 'prixl2', 'l2_prix'],
            'lentilles_qte2': ['qte_lentille2', 'lentille2_qte', 'qtel2', 'l2_qte'],

            'verres2_marque': ['marque_verre2', 'verre2_marque', 'marque_od2', 'v2_marque'],
            'verres2_matiere': ['matiere_verre2', 'verre2_matiere', 'matiere_od2', 'v2_matiere'],
            'verres2_matiere_od': ['verre2d', 'v2_matiere_od'],
            'verres2_matiere_og': ['verre2g', 'v2_matiere_og'],
            'verres2_indice': ['indice_verre2', 'verre2_indice', 'indice_od2', 'v2_indice'],
            'verres2_prix_od': ['prix_verre2', 'verre2_prix', 'prixv2d', 'v2_prix_od'],
            'verres2_prix_og': ['prixv2g', 'v2_prix_og'],

            // Produits / Accessoires
            'produit_ref': ['ref_produit', 'reference_produit', 'code_produit', 'produit1', 'p1_ref', 'acc_ref'],
            'produit_designation': ['designation_produit', 'nom_produit', 'label', 'designation_produit1', 'acc1', 'p1_nom'],
            'produit_qte': ['quantite_vendue', 'qte_vendue', 'nb', 'qte_produit1', 'p1_qte'],
            'produit_prix': ['prix_u', 'pu', 'unitaire', 'prix_produit1', 'prixa1', 'p1_prix'],
            'produit2_ref': ['produit2', 'ref_produit2', 'p2_ref'],
            'produit2_designation': ['designation_produit2', 'nom_produit2', 'acc2', 'p2_nom'],
            'produit2_qte': ['qte_produit2', 'nb_produit2', 'p2_qte'],
            'produit2_prix': ['prix_produit2', 'pu_produit2', 'prixa2', 'p2_prix'],

            'date_ordonnance': ['date_ord', 'ord_date', 'date_prescription', 'date ordonnance'],
            'nom_medecin': ['medecin', 'docteur', 'doctor_name', 'nom medecin', 'ophtalmo'],
            'statut': ['status', 'etat_dossier', 'valide', 'statut dossier', 'etat'],
            'dateLivraisonEstimee': ['date_livraison', 'livraison_estimee', 'livraison', 'date livraison', 'dateliv'],
            'montantTotal': ['total', 'montant_ttc', 'total_ttc', 'prix total', 'ttc total'],
            'montantPaye': ['paye', 'acompte', 'paid_amount', 'montant paye', 'deja paye'],
            'notes': ['note', 'observation', 'remarques', 'observations', 'commentaire'],
            'fournisseur': ['supplier', 'vendor', 'provider', 'fournisseur_nom', 'fournisseur_id'],
            'facture_fournisseur': ['facture', 'invoice', 'num_facture', 'n_facture', 'invoice_number', 'facture_f'],

            // Fournisseurs (code and siteWeb conflict with existing keys, removed)
            'contact': ['personne_contact', 'contact_person', 'nom_contact', 'contact_fournisseur'],
            'rc': ['registre_commerce', 'commerce', 'reg_commerce', 'rc_fournisseur'],
            'cnss': ['cnss_id', 'securite_sociale', 'cnss_fournisseur'],
            'rib': ['rib_fournisseur', 'bank_account', 'compte_bancaire', 'rib_f'],
            'banque': ['bank', 'nom_banque', 'etablissement', 'banque_f'],
            'conditionsPaiement': ['conditions', 'paiement', 'payment_terms', 'delai_paiement', 'conditions_f'],

            // Factures Fournisseurs
            'numeroFacture': ['numero', 'n_facture', 'num_facture', 'facture_num', 'invoice_number', 'invoice_no', 'numero facture'],
            'codeFournisseur': ['code_fournisseur', 'fournisseur_code', 'supplier_code', 'ref_fournisseur', 'code fournisseur'],
            'nomFournisseur': ['nom_fournisseur', 'fournisseur', 'supplier_name', 'nom fournisseur'],
            'dateEmission': ['date_facture', 'date_emission', 'invoice_date', 'emission', 'date emission'],
            'dateEcheance': ['echeance', 'due_date', 'date_due', 'date_limite', 'date echeance'],
            'montantHT': ['ht', 'montant_ht', 'total_ht', 'amount_ht', 'total ht'],
            'montantTVA': ['tva', 'montant_tva', 'tax', 'vat', 'total tva'],
            'montantTTC': ['ttc', 'montant_ttc', 'total_ttc', 'total', 'amount', 'total ttc'],

            // Paiements Fournisseurs
            'datePaiement': ['date_paiement', 'payment_date', 'date_pay', 'paiement', 'date paiement'],
            'montant': ['montant_paye', 'amount', 'paiement', 'paid_amount', 'montant payé'],
            'modePaiement': ['mode', 'payment_method', 'methode_paiement', 'mode_pay', 'mode paiement'],
            'reference': ['ref', 'ref_paiement', 'numero_cheque', 'num_virement', 'payment_ref', 'reference paiement'],

            // Factures Ventes (codeClient conflicts with existing key, removed)
            'nomClient': ['nom_client', 'client', 'customer_name', 'nom client'],
            'totalHT': ['total_ht', 'ht', 'montant_ht', 'amount_ht', 'total ht'],
            'totalTVA': ['total_tva', 'tva', 'tax', 'vat', 'total tva'],
            'totalTTC': ['total_ttc', 'ttc', 'total', 'amount', 'montant_total', 'total ttc'],

            // Paiements Clients
            // (uses same synonyms as paiements fournisseurs)

            'seuilAlerte': ['seuil', 'alerte', 'min', 'alert', 'min_stock'],
        };

        this.currentFields.forEach(field => {
            const bestMatch = this.findBestMatch(field.value, field.label, this.csvHeaders, synonyms[field.value] || []);

            if (!this.mappingForm.contains(field.value)) {
                this.mappingForm.addControl(field.value, this.fb.control(bestMatch || ''));
            } else {
                this.mappingForm.get(field.value)?.setValue(bestMatch || '');
            }
        });

        if (Object.values(this.mappingForm.value).some(v => !!v)) {
            this.snackBar.open('⚡ Mapping automatique intelligent appliqué !', 'Super', { duration: 4000 });
        }
    }

    // "AI" Matching Algorithm
    findBestMatch(fieldKey: string, fieldLabel: string, headers: string[], fieldSynonyms: string[]): string | null {
        const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

        const targetKeywords = [fieldKey, fieldLabel, ...fieldSynonyms].map(k => normalize(k));

        let bestHeader: string | null = null;
        let bestScore = 0;

        for (const header of headers) {
            const normHeader = normalize(header);
            let score = 0;

            // 1. Exact Synonym Match (High Priority)
            if (targetKeywords.includes(normHeader)) {
                score += 100;
            }

            // 2. Partial Match (Medium Priority)
            if (targetKeywords.some(k => normHeader.includes(k) || k.includes(normHeader))) {
                score += 50;
            }

            // 3. Levenshtein Distance (Fuzzy Match for Typos)
            const distances = targetKeywords.map(k => this.levenshteinDistance(normHeader, k));
            const minDistance = Math.min(...distances);

            // Allow up to 2 typos for short words, 3 for long
            const allowedErrors = normHeader.length > 5 ? 3 : 1;
            if (minDistance <= allowedErrors) {
                score += (30 - minDistance * 5); // Closer = Higher score
            }

            if (score > bestScore && score > 20) { // Threshold to avoid garbage matches
                bestScore = score;
                bestHeader = header;
            }
        }

        return bestHeader;
    }

    // Utility: Levenshtein Distance for fuzzy string matching
    levenshteinDistance(a: string, b: string): number {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = [];

        // increment along the first column of each row
        var i;
        for (i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        // increment each column in the first row
        var j;
        for (j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        // Fill in the rest of the matrix
        for (i = 1; i <= b.length; i++) {
            for (j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) == a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                        Math.min(matrix[i][j - 1] + 1, // insertion
                            matrix[i - 1][j] + 1)); // deletion
                }
            }
        }

        return matrix[b.length][a.length];
    }

    async onUploadAndNext(stepper: any) {
        try {
            await this.uploadAndParse();
            stepper.next();
        } catch (error) {
            // Error already handled in uploadAndParse
            console.error('Upload failed, not advancing stepper');
        }
    }

    async executeImport(stepper?: any) {
        if (this.isImporting) return; // Re-entry guard

        if (this.importForm.invalid || this.mappingForm.invalid) return;

        const type = this.importForm.get('type')?.value;
        const warehouseId = this.importForm.get('warehouseId')?.value;

        // Retrieve centreId via NgRx Store (Reliable Source)
        const currentCenter = this.store.selectSignal(UserCurrentCentreSelector)();
        const centreId: string | undefined = currentCenter?.id;

        this.isImporting = true;
        this.importProgress = 0;
        this.currentBatchIndex = 0;
        this.importResult = { success: 0, skipped: 0, failed: 0, errors: [] };

        // Move to step 3 (Result/Progress)
        if (stepper) stepper.next();

        const mapping = this.mappingForm.value;
        const dataToImport = this.fullData.length > 0 ? this.fullData : this.previewData; // Use fullData if available, else previewData
        this.importTotalRows = dataToImport.length;

        const batchSize = 500;
        const batches = [];
        for (let i = 0; i < dataToImport.length; i += batchSize) {
            batches.push(dataToImport.slice(i, i + batchSize));
        }

        this.totalBatches = batches.length;
        console.log(`Starting import of ${dataToImport.length} rows in ${batches.length} batches...`);

        try {
            for (let i = 0; i < batches.length; i++) {
                this.currentBatchIndex = i + 1;
                // Update progress at start of batch (e.g. 0%, 11%, etc.)
                this.importProgress = Math.round((i / batches.length) * 100);
                this.cdr.detectChanges();

                console.log(`Sending batch ${this.currentBatchIndex}/${this.totalBatches}...`);
                const res = await lastValueFrom(
                    this.importService.executeImport(type, batches[i], mapping, warehouseId, centreId)
                );

                // Aggregate results
                this.importResult.success += res.success || 0;
                this.importResult.skipped += res.skipped || 0;
                this.importResult.failed += res.failed || 0;
                if (res.errors && Array.isArray(res.errors)) {
                    this.importResult.errors.push(...res.errors.map((e: string) => `Lot ${this.currentBatchIndex}: ${e}`));
                }

                // Update progress after batch completion
                this.importProgress = Math.round(((i + 1) / batches.length) * 100);
                this.cdr.detectChanges();

                // If too many errors, cap them
                if (this.importResult.errors.length > 500) {
                    this.importResult.errors = this.importResult.errors.slice(0, 500);
                    this.importResult.errors.push('... Trop d\'erreurs (limite de 500 affichées)');
                }
            }
            this.importProgress = 100;
            this.cdr.detectChanges();
            this.snackBar.open(`Import terminé avec succès : ${this.importResult.success} fiches créées`, 'OK', { duration: 5000 });
        } catch (err: any) {
            console.error('Import Error Trace:', err);

            // Extract detailed backend message if available
            let backendMsg = '';
            if (err.error && err.error.message) {
                backendMsg = Array.isArray(err.error.message) ? err.error.message.join(', ') : err.error.message;
            }

            const msg = err.status === 413 ? 'Partie du fichier trop volumineuse (413)' :
                err.status === 504 ? 'Délai d\'attente dépassé (504)' :
                    `Erreur (Batch ${this.currentBatchIndex}) : ${backendMsg || err.status || 'Connexion interrompue'}`;

            this.snackBar.open(msg, 'Fermer', { duration: 10000 });
        } finally {
            this.isImporting = false;
            this.cdr.detectChanges();
        }
    }

    @ViewChild('fileInput') fileInput!: ElementRef;

    reset() {
        this.selectedFile = null;
        this.csvHeaders = [];
        this.previewData = [];
        this.fullData = []; // Clear full data
        this.importResult = null;
        this.importForm.reset({ type: 'clients' });

        // Clear file input to allow re-selecting the same file
        if (this.fileInput) {
            this.fileInput.nativeElement.value = '';
        }
    }
}
