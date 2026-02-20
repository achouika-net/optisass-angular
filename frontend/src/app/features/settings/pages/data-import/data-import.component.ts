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
            { value: 'numero', label: 'N° Fiche / Dossier' },
            { value: 'valide', label: 'Validé (Oui/Non)' },
            { value: 'facture', label: 'Facturé (Oui/Non)' },
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
            { value: 'numero', label: 'N° Fiche / Dossier' },
            { value: 'valide', label: 'Validé (Oui/Non)' },
            { value: 'facture', label: 'Facturé (Oui/Non)' },
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
            { value: 'numero', label: 'Numéro Dossier' },

            // Infos Fiche
            { value: 'statut', label: 'Statut Dossier' },
            { value: 'dateCreation', label: 'Date de Création' },
            { value: 'dateLivraisonEstimee', label: 'Date Livraison Estimée' },
            { value: 'valide', label: 'Validé (Oui/Non)' },
            { value: 'facture', label: 'Facturé (Oui/Non)' },
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
            { value: 'numero', label: 'Numéro Dossier' },
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
            { value: 'valide', label: 'Validé (Oui/Non)' },
            { value: 'facture', label: 'Facturé (Oui/Non)' },
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
            { value: 'referenceInterne', label: 'Référence Interne / nPiece' },
            { value: 'codeFournisseur', label: 'Code Fournisseur' },
            { value: 'nomFournisseur', label: 'Nom Fournisseur (si code absent)' },
            { value: 'dateEmission', label: 'Date Facture' },
            { value: 'dateEcheance', label: 'Date Échéance' },
            { value: 'montantHT', label: 'Montant HT' },
            { value: 'montantTVA', label: 'Montant TVA' },
            { value: 'montantTTC', label: 'Montant TTC' },
            { value: 'statut', label: 'Statut (A_PAYER/PAYEE/PARTIELLE)' },
            { value: 'type', label: 'Type (ACHAT_STOCK/AUTRE)' },
            { value: 'modePaiement', label: 'Mode de Règlement (Pour échéance auto)' },
            { value: 'notes', label: 'Notes' }
        ],
        paiements_fournisseurs: [
            { value: 'numeroFacture', label: 'N° Facture Fournisseur' },
            { value: 'referenceInterne', label: 'Référence Interne / nPiece' },
            { value: 'codeFournisseur', label: 'Code Fournisseur' },
            { value: 'datePaiement', label: 'Date Paiement' },
            { value: 'montant', label: 'Montant Payé' },
            { value: 'modePaiement', label: 'Mode Paiement (Espèces/Chèque/Virement)' },
            { value: 'reference', label: 'Référence (N° Chèque/Virement)' },
            { value: 'dateEcheance', label: 'Date Échéance (Chèque/LCN)' },
            { value: 'notes', label: 'Notes' }
        ],
        factures_ventes: [
            { value: 'numero', label: 'N° Facture' },
            { value: 'fiche', label: 'N° Fiche / Dossier' },
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
            { value: 'fiche', label: 'N° Fiche / Dossier' },
            { value: 'codeClient', label: 'Code Client' },
            { value: 'datePaiement', label: 'Date Paiement' },
            { value: 'montant', label: 'Montant Payé' },
            { value: 'modePaiement', label: 'Mode Paiement (Espèces/Chèque/Carte/Virement)' },
            { value: 'reference', label: 'Référence' },
            { value: 'notes', label: 'Notes' }
        ]
    };

    currentFields: any[] = [];
    showIgnoredFields = false;

    /** Fields that have a mapped value (non-empty). Used to hide "Ignorer" rows. */
    get visibleFields(): any[] {
        if (this.showIgnoredFields) return this.currentFields;
        return this.currentFields.filter(f => !!this.mappingForm.get(f.value)?.value);
    }

    /** LocalStorage key for saving default mappings per import type */
    private defaultMappingKey(type: string): string {
        return `import_default_mapping_${type}`;
    }

    /** Save the current mapping as default for the current import type */
    saveDefaultMapping() {
        const type = this.importForm.get('type')?.value;
        if (!type) return;
        const currentMapping = this.mappingForm.value;
        // Only save non-empty values
        const toSave: { [key: string]: string } = {};
        Object.entries(currentMapping).forEach(([k, v]) => {
            if (v) toSave[k] = v as string;
        });
        localStorage.setItem(this.defaultMappingKey(type), JSON.stringify(toSave));
        this.snackBar.open(
            `✅ Mapping sauvegardé comme défaut pour "${type}"`,
            'Fermer',
            { duration: 3000 }
        );
    }

    /** Load saved default mapping from localStorage for the given type */
    private loadSavedMapping(type: string): { [key: string]: string } {
        try {
            const raw = localStorage.getItem(this.defaultMappingKey(type));
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    toggleIgnoredFields() {
        this.showIgnoredFields = !this.showIgnoredFields;
    }


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
        // 1. Identify valid keys for the current import type
        const newFieldKeys = this.currentFields.map(f => f.value);
        const type = this.importForm.get('type')?.value || 'clients';

        // 2. Remove controls that are NOT relevant to the new type
        Object.keys(this.mappingForm.controls).forEach(key => {
            if (!newFieldKeys.includes(key)) {
                this.mappingForm.removeControl(key);
            }
        });

        // 3. Load saved default mapping for this type
        const savedMapping = this.loadSavedMapping(type);

        // AI-like Mapping Dictionary — French & English synonyms for every field
        const synonyms: { [key: string]: string[] } = {
            // ─── CLIENT ───────────────────────────────────────────────────────
            codeClient: ['code', 'codeclient', 'id client', 'identifiant', 'ref client', 'numero client', 'client id', 'client code', 'no client'],
            titre: ['titre', 'civilite', 'civility', 'salutation', 'mr', 'mme', 'title'],
            nom: ['nom', 'name', 'last name', 'lastname', 'surname', 'family name', 'nom client', 'client name'],
            prenom: ['prenom', 'first name', 'firstname', 'given name', 'givenname', 'prénom'],
            dateNaissance: ['date naissance', 'naissance', 'birthday', 'birth date', 'dob', 'date de naissance', 'né le'],
            couvertureSociale: ['couverture', 'assurance', 'mutuelle', 'cnam', 'cnss', 'securite sociale', 'insurance', 'coverage'],
            numCouvertureSociale: ['num couverture', 'numero assurance', 'num assurance', 'insurance number', 'num mutuelle'],
            dateCreation: ['date creation', 'date saisie', 'created at', 'created date', 'date ajout', 'date entree', 'date inscription', 'date ouverture'],
            raisonSociale: ['raison sociale', 'company', 'societe', 'entreprise', 'business name', 'company name'],
            telephone: ['tel', 'phone', 'mobile', 'gsm', 'portable', 'telephone', 'num tel', 'contact'],
            email: ['email', 'mail', 'e-mail', 'courriel', 'adresse mail'],
            adresse: ['adresse', 'address', 'rue', 'street', 'domicile'],
            ville: ['ville', 'city', 'town', 'localite'],
            codePostal: ['code postal', 'cp', 'zip', 'postal code', 'zipcode'],
            cin: ['cin', 'carte identite', 'id card', 'cni', 'piece identite'],
            ice: ['ice', 'identifiant commun', 'common identifier'],
            identifiantFiscal: ['if', 'identifiant fiscal', 'tax id', 'fiscal id', 'num fiscal'],
            registreCommerce: ['rc', 'registre commerce', 'trade register', 'commerce register'],
            patente: ['patente', 'patent'],
            numeroAutorisation: ['num autorisation', 'autorisation', 'authorization number'],
            siteWeb: ['site', 'web', 'website', 'url', 'site web'],
            commentaires: ['commentaire', 'comment', 'remarque', 'note', 'observation'],
            pointsFidelite: ['points', 'fidelite', 'loyalty', 'points fidelite'],
            solde: ['solde', 'balance', 'solde initial', 'initial balance'],

            // ─── FICHE ────────────────────────────────────────────────────────
            fiche_id: ['fiche', 'dossier', 'num fiche', 'numero fiche', 'id fiche', 'fiche id', 'no fiche', 'n fiche', 'n° fiche'],
            fiche_type: ['type fiche', 'type dossier', 'categorie fiche', 'fiche type'],
            numero: ['numero', 'num', 'n°', 'no', 'numero fiche', 'num fiche', 'n° fiche', 'dossier', 'id fiche', 'numero facture', 'invoice number'],
            valide: ['valide', 'valid', 'validated', 'confirme', 'oui non', 'checkbox', 'coche'],
            facture: ['facture', 'facturation', 'facturee', 'invoiced', 'invoice', 'facture oui non', 'n° fiche', 'num fiche'],
            statut: ['statut', 'status', 'etat', 'state', 'situation'],
            dateLivraisonEstimee: ['livraison', 'date livraison', 'delivery date', 'date remise', 'remise', 'date retrait'],
            montantTotal: ['montant total', 'total', 'prix total', 'total ttc', 'montant ttc', 'price', 'prix', 'amount'],
            montantPaye: ['acompte', 'paye', 'verse', 'montant paye', 'paid', 'deposit', 'avance', 'reglement', 'paiement'],
            notes: ['notes', 'note', 'observations', 'remarques', 'commentaires', 'info', 'details'],

            // ─── PRESCRIPTION ─────────────────────────────────────────────────
            od_sphere: ['sph od', 'sphere od', 'od sph', 'od sphere', 'sph d', 'sphere d', 'od', 'sph droit', 'sphere droit'],
            og_sphere: ['sph og', 'sphere og', 'og sph', 'og sphere', 'sph g', 'sphere g', 'og', 'sph gauche', 'sphere gauche'],
            od_cylindre: ['cyl od', 'cylindre od', 'od cyl', 'cyl d', 'cylindre d', 'cyl droit'],
            og_cylindre: ['cyl og', 'cylindre og', 'og cyl', 'cyl g', 'cylindre g', 'cyl gauche'],
            od_axe: ['axe od', 'od axe', 'axe d', 'axis od', 'ax od'],
            og_axe: ['axe og', 'og axe', 'axe g', 'axis og', 'ax og'],
            od_addition: ['add od', 'addition od', 'od add', 'add d', 'addition d'],
            og_addition: ['add og', 'addition og', 'og add', 'add g', 'addition g'],
            ep_od: ['ep od', 'ecart pupillaire od', 'pd od', 'pupillary distance od', 'ep d'],
            ep_og: ['ep og', 'ecart pupillaire og', 'pd og', 'pupillary distance og', 'ep g'],
            date_ordonnance: ['date ordonnance', 'ordonnance', 'prescription date', 'date prescription'],
            nom_medecin: ['medecin', 'docteur', 'dr', 'doctor', 'ophtalmologue', 'ophtalmo', 'prescripteur'],

            // ─── LENTILLES ────────────────────────────────────────────────────
            od_rayon: ['rayon od', 'bc od', 'base curve od', 'rc od', 'rayon d'],
            og_rayon: ['rayon og', 'bc og', 'base curve og', 'rc og', 'rayon g'],
            od_diametre: ['diametre od', 'diam od', 'diameter od', 'dia od'],
            og_diametre: ['diametre og', 'diam og', 'diameter og', 'dia og'],
            od_k1: ['k1 od', 'od k1', 'keratometrie 1 od'],
            og_k1: ['k1 og', 'og k1', 'keratometrie 1 og'],
            od_k2: ['k2 od', 'od k2', 'keratometrie 2 od'],
            og_k2: ['k2 og', 'og k2', 'keratometrie 2 og'],
            lentilles_marque: ['marque lentille', 'lentille marque', 'lens brand', 'marque l1', 'l1 marque'],
            lentilles_modele: ['modele lentille', 'lentille modele', 'lens model', 'modele l1', 'l1 modele'],
            lentilles_usage: ['usage lentille', 'lentille usage', 'lens usage', 'usage l1', 'frequence'],
            lentilles_prix: ['prix lentille', 'lentille prix', 'lens price', 'prix l1', 'l1 prix'],

            // ─── MONTURE ──────────────────────────────────────────────────────
            monture_marque: ['marque monture', 'monture marque', 'frame brand', 'marque m1', 'm1 marque', 'marque'],
            monture_modele: ['modele monture', 'monture modele', 'frame model', 'modele m1', 'm1 modele', 'modele'],
            monture_reference: ['ref monture', 'monture ref', 'frame ref', 'reference monture', 'ref m1', 'm1 ref'],
            monture_prix: ['prix monture', 'monture prix', 'frame price', 'prix m1', 'm1 prix'],

            // ─── VERRES ───────────────────────────────────────────────────────
            verres_type: ['type verre', 'verre type', 'lens type', 'type v1', 'progressif', 'unifocal', 'bifocal'],
            verres_indice: ['indice verre', 'verre indice', 'lens index', 'indice v1', 'indice'],
            verres_matiere: ['matiere verre', 'verre matiere', 'lens material', 'matiere v1', 'materiau'],
            verres_marque: ['marque verre', 'verre marque', 'lens brand', 'marque v1', 'v1 marque'],
            verres_traitement: ['traitement verre', 'verre traitement', 'lens treatment', 'traitement v1', 'ar', 'antireflet', 'anti reflet'],
            verres_prix_od: ['prix verre od', 'verre od prix', 'prix od', 'v1 od prix', 'prix verre droit'],
            verres_prix_og: ['prix verre og', 'verre og prix', 'prix og', 'v1 og prix', 'prix verre gauche'],

            // ─── PRODUITS ─────────────────────────────────────────────────────
            codeInterne: ['code interne', 'code article', 'article code', 'internal code', 'sku', 'reference interne'],
            codeBarres: ['code barre', 'barcode', 'ean', 'upc', 'gtin', 'code barre'],
            referenceFournisseur: ['ref fournisseur', 'reference fournisseur', 'supplier ref', 'fournisseur ref'],
            designation: ['designation', 'libelle', 'description', 'nom article', 'article', 'product name', 'nom produit'],
            marque: ['marque', 'brand', 'fabricant', 'manufacturer'],
            modele: ['modele', 'model', 'reference'],
            couleur: ['couleur', 'color', 'colour'],
            typeArticle: ['type article', 'type produit', 'article type', 'product type', 'categorie'],
            famille: ['famille', 'family', 'category', 'categorie'],
            sousFamille: ['sous famille', 'sous-famille', 'sub family', 'subcategory'],
            fournisseurPrincipal: ['fournisseur', 'supplier', 'vendor', 'fournisseur principal'],
            montage: ['montage', 'cerclage', 'frame type', 'type cerclage'],
            prixAchatHT: ['prix achat', 'achat ht', 'purchase price', 'cost', 'cout', 'pa ht'],
            prixVenteHT: ['prix vente ht', 'vente ht', 'pv ht', 'selling price ht'],
            prixVenteTTC: ['prix vente ttc', 'vente ttc', 'pv ttc', 'prix ttc', 'selling price', 'prix public'],
            coefficient: ['coefficient', 'coeff', 'markup', 'marge'],
            tauxTVA: ['tva', 'tax rate', 'vat', 'taux tva'],
            quantiteActuelle: ['quantite', 'qty', 'stock', 'qte', 'quantity', 'stock actuel'],
            seuilAlerte: ['seuil', 'alerte', 'alert', 'minimum stock', 'stock min', 'reorder point'],

            // ─── FOURNISSEURS ─────────────────────────────────────────────────
            code: ['code', 'code fournisseur', 'supplier code', 'vendor code', 'ref fournisseur'],
            contact: ['contact', 'personne contact', 'contact person', 'interlocuteur'],
            rib: ['rib', 'iban', 'bank account', 'compte bancaire'],
            banque: ['banque', 'bank', 'etablissement bancaire'],
            conditionsPaiement: ['conditions paiement', 'payment terms', 'delai paiement', 'modalites paiement'],
            cnss: ['cnss', 'social security', 'securite sociale'],
            rc: ['rc', 'registre commerce', 'trade register'],

            // ─── FACTURES ─────────────────────────────────────────────────────
            // Note: 'numero' and 'facture' keys are defined above in FICHE section (merged)
            numeroFacture: ['numero facture', 'num facture', 'n° facture', 'invoice no', 'invoice number', 'facture', 'ref facture'],
            fiche: ['fiche', 'dossier', 'num fiche', 'numero fiche', 'n° fiche', 'no fiche'],
            nomClient: ['nom client', 'client', 'client name', 'customer', 'customer name'],
            type: ['type', 'type facture', 'invoice type', 'document type'],
            dateEmission: ['date facture', 'date emission', 'invoice date', 'date', 'date document', 'date creation'],
            dateEcheance: ['echeance', 'date echeance', 'due date', 'date limite', 'date paiement'],
            totalHT: ['total ht', 'ht', 'montant ht', 'hors taxe', 'subtotal'],
            totalTVA: ['total tva', 'tva', 'montant tva', 'taxe', 'tax amount'],
            totalTTC: ['total ttc', 'ttc', 'montant ttc', 'total general', 'total amount', 'montant total'],
            montantHT: ['montant ht', 'ht', 'total ht', 'hors taxe'],
            montantTVA: ['montant tva', 'tva', 'total tva'],
            montantTTC: ['montant ttc', 'ttc', 'total ttc', 'total'],
            codeFournisseur: ['code fournisseur', 'fournisseur code', 'supplier code'],
            nomFournisseur: ['nom fournisseur', 'fournisseur', 'supplier name', 'vendor name'],

            // ─── PAIEMENTS ────────────────────────────────────────────────────
            datePaiement: ['date paiement', 'date reglement', 'payment date', 'date versement', 'date', 'date encaissement'],
            montant: ['montant', 'amount', 'montant paye', 'paid amount', 'reglement', 'versement', 'paiement'],
            modePaiement: ['mode paiement', 'mode reglement', 'payment method', 'moyen paiement', 'mode', 'type paiement', 'especes', 'cheque', 'virement'],
            reference: ['reference', 'ref', 'num cheque', 'numero cheque', 'num virement', 'transaction id', 'ref paiement'],

            // ─── DEPENSES ─────────────────────────────────────────────────────
            date: ['date', 'date depense', 'expense date', 'date operation'],
            categorie: ['categorie', 'category', 'type depense', 'nature', 'rubrique'],
            description: ['description', 'libelle', 'designation', 'motif', 'objet', 'detail'],
            fournisseur: ['fournisseur', 'supplier', 'vendor', 'prestataire', 'beneficiaire'],
        };

        // 3. For each field in the current type, keep existing mapping or find a new one
        this.currentFields.forEach(field => {
            const currentControl = this.mappingForm.get(field.value);
            const existingValue = currentControl?.value;

            // Priority: existing value > saved default > auto-detected match
            if (!existingValue) {
                // Try saved default first
                const savedValue = savedMapping[field.value] || '';
                // If saved value is valid (still exists in current CSV headers), use it
                const resolvedSaved = savedValue && (this.csvHeaders.includes(savedValue) || savedValue === '') ? savedValue : '';
                const bestMatch = resolvedSaved || this.findBestMatch(field.value, field.label, this.csvHeaders, synonyms[field.value] || []);

                if (!this.mappingForm.contains(field.value)) {
                    this.mappingForm.addControl(field.value, this.fb.control(bestMatch || ''));
                } else {
                    this.mappingForm.get(field.value)?.setValue(bestMatch || '');
                }
            }
            // Else: we keep the existing value (Persistence)
        });

        if (Object.values(this.mappingForm.value).some(v => !!v)) {
            // Only snackbar if we actually found something or kept something
            console.log('Mapping updated/preserved.');
        }
    }

    /** Force a full re-run of intelligent mapping, resetting all current values first */
    autoMap() {
        // Reset all controls to empty so updateMappingControls will re-detect everything
        this.currentFields.forEach(field => {
            this.mappingForm.get(field.value)?.setValue('');
        });
        this.updateMappingControls();

        const matched = Object.values(this.mappingForm.value).filter(v => !!v).length;
        const total = this.currentFields.length;
        this.snackBar.open(
            `✅ Mapping automatique : ${matched} / ${total} champs détectés`,
            'Fermer',
            { duration: 4000 }
        );
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

        // Consolidate batches for entity-based imports to avoid cross-batch duplication.
        // Backend's deduplication logic (lookup existing by code/name) only works
        // within the scope of a single request. 
        const singleBatchTypes = [
            'fiches', 'fiches_lentilles', 'fiches_produits',
            'clients', 'fournisseurs', 'factures_fournisseurs',
            'factures_ventes', 'paiements_clients', 'paiements_fournisseurs'
        ];
        const isSingleBatch = singleBatchTypes.includes(type);
        const batchSize = isSingleBatch ? dataToImport.length : 500;
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
