# DTOs & MODÈLES DE DONNÉES - OptiSaas

## 🏗️ STRUCTURE DTOs (Data Transfer Objects)

### ===== FACTURES =====

```typescript
// CREATE-FACTURE.DTO
{
  clientId: string;                    // UUID client obligatoire
  ficheId?: string;                    // UUID fiche optionnelle
  centreId?: string;                   // Inféré du header Tenant
  type: 'DEVIS' | 'BON_COMMANDE' | 'FACTURE' | 'AVOIR' | 'FACTURE_PRESTATION';
  statut?: 'DEVIS_EN_COURS';          // Initial par défaut
  dateEcheance?: Date;                 // Optionnel
  lignes: {
    productId?: string;                // Produit du catalogue (optionnel)
    description: string;               // Libellé ligne
    quantite: number;                  // > 0
    prixUnitaireHT: number;
    tauxTVA: number;                   // Défaut 20%
    totalHT: number;                   // quantite * prixUnitaireHT
    totalTVA?: number;                 // Auto-calculé
    totalTTC?: number;                 // Auto-calculé
    motif?: string;                    // Pour retours
  }[];
  proprietes?: {
    conditions?: string;
    notes?: string;
    incoterms?: string;
  };
  vendeurId?: string;                  // UUID employee
  exportComptable?: boolean;           // Défaut true
  typeOperation?: 'COMPTABLE' | 'INTERNE';  // Défaut COMPTABLE
}

// UPDATE-FACTURE.DTO
{
  // Tous champs optionnels, merge avec existant
  statut?: string;
  lignes?: Array;
  dateEcheance?: Date;
  // ... autres champs
}

// RESPONSE-FACTURE
{
  id: string;
  numero: string;                      // Généré auto (DV-2026-001, etc)
  type: string;
  statut: string;
  dateEmission: Date;
  dateEcheance?: Date;
  clientId: string;
  ficheId?: string;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  resteAPayer: number;                 // totalTTC - somme paiements
  lignes: Array;
  client?: ClientSummary;
  fiche?: FicheSummary;
  paiements?: PaiementSummary[];
  commissions?: CommissionSummary[];
}
```

### ===== PAIEMENTS =====

```typescript
// CREATE-PAIEMENT.DTO
{
  factureId: string;                   // UUID obligatoire
  montant: number;                     // Positif=paiement, Négatif=remboursement
  mode: 'ESPECES' | 'CARTE' | 'CHEQUE' | 'VIREMENT' | 'LCN' | 'AUTRE';
  statut?: 'ENCAISSE' | 'EN_ATTENTE' | 'DECAISSEMENT';  // Auto-détecté
  reference?: string;                  // Numéro chèque/LCN/virement
  banque?: string;                     // Pour chèques
  tiersNom?: string;                   // Tiers chèque (si pas client)
  tiersCin?: string;                   // CIN tiers
  dateVersement?: Date;                // Effectif
  notes?: string;
}

// RESPONSE-PAIEMENT
{
  id: string;
  factureId: string;
  montant: number;
  date: Date;                          // Date enregistrement
  mode: string;
  reference?: string;
  statut: string;
  dateEncaissement?: Date;             // Banque confirmé
  facture?: FactureSummary;
  operationCaisse?: OperationCaisseSummary;
}
```

### ===== FICHES CLIENTS =====

```typescript
// CREATE-FICHE.DTO
{
  clientId: string;                    // UUID obligatoire
  type: 'MONTURE' | 'LENTILLES' | 'ACCESSOIRES' | 'MIXTE';
  statut?: 'BROUILLON';                // Initial
  content: {
    // ===== MONTURE =====
    monture?: {
      categorie: string;               // Lunettes/Solaires/etc
      genre: string;                   // H/F/Enfant
      forme: string;                   // Rond/Carré/Ovale
      marque: string;
      couleur: string;
      calibre: string;                 // S/M/L
      ponte: number;
      branche: number;
      typeCharniere: string;
      typeMonture: string;
      prix: number;
    };
    
    // ===== LENTILLES =====
    lentilles?: {
      type: string;                    // Contact/progressif/etc
      materiau: string;
      indiceRefraction: number;        // 1.5, 1.6, 1.67
      teinte: string;
      traitements: string[];           // ['anti-reflet', 'anti-UV']
      prix: number;
    };
    
    // ===== PRESCRIPTION =====
    prescription?: {
      od: {                            // Oeil droit
        sphere: number;                // -20 à +20
        cylindre: number;              // -10 à 0
        axe: number;                   // 0 à 180
        addition: number;              // 0 à 4
        rayon?: number;
        diametre?: number;
      };
      og: {                            // Oeil gauche
        sphere: number;
        cylindre: number;
        axe: number;
        addition: number;
        rayon?: number;
        diametre?: number;
      };
      dateOrdonnance?: Date;
      praticien?: string;
      validiteOrdonnance?: Date;
    };
    
    // ===== ADAPTATION =====
    adaptation?: {
      rayonCourbure: number;
      diametre: number;
      dateAdaptation: Date;
    };
    
    // ===== SUIVI COMMANDE =====
    suiviCommande?: {
      fournisseur: string;             // Nom fournisseur
      referenceCommande: string;       // BC interne
      dateCommandeSouhaitee?: Date;
      dateReceptionEstimee?: Date;
    };
  };
  dateLivraisonEstimee?: Date;
}

// UPDATE-FICHE.DTO
{
  statut?: string;                     // Changement d'état
  content?: any;                       // Merge complet
  montantTotal?: number;
  montantPaye?: number;
}

// RESPONSE-FICHE
{
  id: string;
  numero: number;
  type: string;
  statut: string;
  clientId: string;
  content: any;                        // JSON données optiques
  dateCreation: Date;
  dateLivraisonEstimee?: Date;
  montantTotal: number;
  montantPaye: number;
  client?: ClientSummary;
  facture?: FactureSummary;
  bonsLivraison?: BonLivraisonSummary[];
}
```

### ===== CLIENTS =====

```typescript
// CREATE-CLIENT.DTO
{
  typeClient: 'PARTICULIER' | 'PROFESSIONNEL' | 'ENTREPRISE';
  
  // ===== INFO PERSONNELLE =====
  nom: string;
  prenom: string;
  dateNaissance?: Date;
  civilite?: string;                   // M/Mme/Mlle
  
  // ===== CONTACT =====
  email?: string;                      // Unique (si fourni)
  telephone?: string;
  adresse?: string;
  ville?: string;
  codePostal?: string;
  
  // ===== DONNÉES ENTREPRISE (si B2B) =====
  raisonSociale?: string;
  identifiantFiscal?: string;          // IF
  ice?: string;
  registreCommerce?: string;
  patente?: string;
  tvaAssujetti?: boolean;
  
  // ===== RÉFÉRENCES =====
  centreId: string;                    // Affectation centre
  parrainId?: string;                  // UUID client parraineur
  conventionId?: string;               // UUID convention remise
  groupeId?: string;                   // UUID groupe famille
  
  // ===== DONNÉES OPTIONNELLES =====
  groupeFamille?: {
    parent1?: string;                  // UUID
    parent2?: string;
    conjoint?: string;
    enfants?: string[];
  };
  couvertureSociale?: {
    mutuelle: string;
    typeContrat: string;
    numero: string;
  };
  commentaires?: string;
  titre?: string;
}

// SEARCH-CLIENT.DTO
{
  typeClient?: string;
  statut?: string;
  nom?: string;
  prenom?: string;
  telephone?: string;
  cin?: string;
  groupeFamille?: string;
  fidelioEligible?: boolean;
  centreId?: string;                   // Obligatoire
}

// RESPONSE-CLIENT
{
  id: string;
  typeClient: string;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  pointsFidelite: number;
  statut: string;
  centre?: CentreSummary;
  parrain?: ClientSummary;
  convention?: ConventionSummary;
  factures?: FactureSummary[];
  fiches?: FicheSummary[];
}
```

### ===== STOCK MOUVEMENTS =====

```typescript
// CREATE-MOUVEMENT-STOCK.DTO
{
  type: 'ENTREE' | 'SORTIE' | 'TRANSFERT' | 'RETOUR' | 'CONFECTION' | 'AJUSTEMENT' | 'DECHET';
  produitId: string;
  quantite: number;                    // > 0
  motif: string;                       // Raison du mouvement
  
  // Source/destination
  entrepotSourceId?: string;           // Pour SORTIE, TRANSFERT
  entrepotDestinationId?: string;      // Pour ENTREE, TRANSFERT
  
  // Références
  factureId?: string;                  // Pour SORTIE vente
  bonLivraisonId?: string;             // Pour ENTREE réception
  factureFournisseurId?: string;
  
  // Prix unitaires
  prixAchatUnitaire?: number;
  prixVenteUnitaire?: number;
  
  // Lot tracking
  numeroLot?: string;
  datePeremption?: Date;
}

// RESPONSE-MOUVEMENT-STOCK
{
  id: string;
  type: string;
  quantite: number;
  dateMovement: Date;
  motif: string;
  produitId: string;
  entrepotSource?: EntrepotSummary;
  entrepotDestination?: EntrepotSummary;
  facture?: FactureSummary;
  produit?: ProductSummary;
}
```

### ===== PRODUITS =====

```typescript
// CREATE-PRODUCT.DTO
{
  codeInterne: string;                 // SKU unique/entrepot
  codeBarres: string;                  // EAN
  designation: string;
  marque?: string;
  modele?: string;
  couleur?: string;
  typeArticle: 'MONTURE' | 'VERRE' | 'LENTILLE' | 'ACCESSOIRE' | 'SERVICE';
  famille?: string;
  sousFamille?: string;
  
  // Stockage
  entrepotId: string;
  quantiteActuelle?: number;
  seuilAlerte?: number;
  
  // Tarification
  prixAchatHT: number;
  coefficient: number;                 // Markup
  prixVenteHT: number;
  tauxTVA: number;                     // Défaut 20%
  
  // Données optiques JSON
  specificData?: {
    // Monture
    categorie?: string;
    genre?: string;
    forme?: string;
    calibre?: string;
    ponte?: number;
    branche?: number;
    
    // Verre
    typeVerre?: string;
    indiceRefraction?: number;
    traitements?: string[];
    
    // Lentille
    typeLentille?: string;
    rayonCourbure?: number;
    diametre?: number;
  };
}

// RESPONSE-PRODUCT
{
  id: string;
  codeInterne: string;
  codeBarres: string;
  designation: string;
  typeArticle: string;
  quantiteActuelle: number;
  seuilAlerte: number;
  prixVenteHT: number;
  prixVenteTTC: number;
  tauxTVA: number;
  entrepot?: EntrepotSummary;
  specificData?: any;
}
```

### ===== CAISSE & PAIEMENTS =====

```typescript
// OUVRIR-CAISSE.DTO
{
  caisseId: string;
  centreId: string;
  caissier: string;                    // UUID user ou nom
  fondInitial: number;                 // Montant initial caisse
}

// CLOTURER-CAISSE.DTO
{
  soldeReel: number;                   // Comptage caissier (especes)
  montantTotalCarte: number;           // Total cartes reçues
  nbRecuCarte: number;                 // Nombre tickets cartes
  montantTotalCheque: number;          // Total chèques reçus
  nbRecuCheque: number;                // Nombre chèques
  justificationEcart?: string;         // Si écart > 0.01
}

// RESPONSE-JOURNEE-CAISSE
{
  id: string;
  dateOuverture: Date;
  dateCloture?: Date;
  fondInitial: number;
  soldeTheorique: number;              // Calculé
  soldeReel?: number;                  // Déclaré
  ecart?: number;                      // soldeReel - soldeTheorique
  statut: 'OUVERTE' | 'FERMEE';
  caissier: string;
  caisse?: CaisseSummary;
  operations?: OperationCaisseSummary[];
  totalVentesEspeces: number;
  totalVentesCarte: number;
  totalVentesCheque: number;
}
```

### ===== DÉPENSES & PAIE =====

```typescript
// CREATE-EXPENSE.DTO
{
  date: Date;
  montant: number;                     // > 0
  categorie: 'LOYER' | 'ELECTRICITE' | 'INTERNET' | 'SALAIRE' | 'ASSURANCE' | ...;
  modePaiement: 'CHEQUE' | 'VIREMENT' | 'ESPECES' | 'CARTE';
  description?: string;
  
  centreId: string;
  fournisseurId?: string;
  
  // Pour chèques/LCN post-datés
  reference?: string;
  dateEcheance?: Date;
  banque?: string;
  
  // Comptabilisation
  factureFournisseurId?: string;
  bonLivraisonId?: string;
}

// RESPONSE-PAYROLL
{
  id: string;
  employeeId: string;
  mois: string;                        // YYYY-MM
  salaireBase: number;
  commissions: number;
  heuresSup: number;
  primes: number;
  
  // Calculs
  grossSalary: number;
  socialSecurityDeduction: number;
  healthInsuranceDeduction: number;
  incomeTaxDeduction: number;
  professionalExpenses: number;
  
  netAPayer: number;
  statut: 'BROUILLON' | 'VALIDEE' | 'PAYEE';
  pdfUrl?: string;
}
```

### ===== CONVENTION & REMISES =====

```typescript
// CREATE-CONVENTION.DTO
{
  nom: string;                         // Unique
  remiseType: 'PERCENTAGE' | 'FLAT_AMOUNT';
  remiseValeur: number;                // % ou DH fixe
  
  // Forfait lunettes
  remiseForfaitaire?: boolean;
  montantForfaitaireMonture?: number;
  montantForfaitaireVerre?: number;
  
  description?: string;
  contact?: string;
}

// RESPONSE-CONVENTION
{
  id: string;
  nom: string;
  remiseType: string;
  remiseValeur: number;
  clients?: ClientSummary[];
}
```

### ===== COMMISSION & RÈGLES =====

```typescript
// CREATE-COMMISSION-RULE.DTO
{
  poste: 'OPTICIEN' | 'VENDEUR' | 'MANAGER' | 'CAISSIER' | 'ADMINISTRATIF';
  typeProduit: 'MONTURE' | 'VERRE' | 'LENTILLE' | 'ACCESSOIRE' | 'SERVICE' | 'GLOBAL';
  taux: number;                        // % commission
  centreId?: string;                   // Null = global
}

// RESPONSE-COMMISSION
{
  id: string;
  employeeId: string;
  factureId: string;
  type: string;                        // Type produit
  montant: number;                     // Montant commission DH
  mois: string;                        // YYYY-MM
  employee?: EmployeeSummary;
  facture?: FactureSummary;
}
```

### ===== LOYALTY CONFIG =====

```typescript
// UPDATE-LOYALTY-CONFIG.DTO
{
  pointsPerDH?: number;                // Défaut 0.1
  referrerBonus?: number;              // Défaut 50
  refereeBonus?: number;               // Défaut 20
  folderCreationBonus?: number;        // Défaut 30
  pointsToMADRatio?: number;           // Défaut 0.1
  rewardThreshold?: number;            // Défaut 500
}

// RESPONSE-LOYALTY-CONFIG
{
  id: string;
  pointsPerDH: number;
  referrerBonus: number;
  refereeBonus: number;
  folderCreationBonus: number;
  pointsToMADRatio: number;
  rewardThreshold: number;
}
```

---

## 📝 ENUMS & CONSTANTES

```typescript
// Statuts
export const FACTURE_STATUSES = {
  DEVIS_EN_COURS: 'DEVIS_EN_COURS',
  VALIDEE: 'VALIDEE',
  PAYEE: 'PAYEE',
  SOLDEE: 'SOLDEE',
  ANNULEE: 'ANNULEE',
  EN_RETOUR: 'EN_RETOUR',
  PARTIELLEMENT_PAYEE: 'PARTIELLEMENT_PAYEE'
};

export const PAIEMENT_MODES = {
  ESPECES: 'ESPECES',
  CARTE: 'CARTE',
  CHEQUE: 'CHEQUE',
  VIREMENT: 'VIREMENT',
  LCN: 'LCN'
};

export const MOUVEMENT_TYPES = {
  ENTREE: 'ENTREE',
  SORTIE: 'SORTIE',
  TRANSFERT: 'TRANSFERT',
  RETOUR: 'RETOUR',
  CONFECTION: 'CONFECTION',
  AJUSTEMENT: 'AJUSTEMENT',
  DECHET: 'DECHET'
};

export const POINTS_TYPES = {
  EARN: 'EARN',
  REDEEM: 'REDEEM',
  BONUS_PARRAINAGE: 'BONUS_PARRAINAGE',
  BONUS_DOSSIER: 'BONUS_DOSSIER',
  ADJUSTMENT: 'ADJUSTMENT'
};

// Validations numériques
export const VALIDATION = {
  SPHERE_MIN: -20,
  SPHERE_MAX: 20,
  CYLINDRE_MIN: -10,
  CYLINDRE_MAX: 0,
  AXE_MIN: 0,
  AXE_MAX: 180,
  ADDITION_MIN: 0,
  ADDITION_MAX: 4,
  TVA_MIN: 0,
  TVA_MAX: 20,
  LOYALTY_THRESHOLD: 500,
  STOCK_TOLERANCE: 0.01,
  CAISSE_TOLERANCE: 0.01
};

// Ratios
export const RATIOS = {
  POINTS_PER_DH: 0.1,        // 1 point par 10 DH
  POINTS_TO_MAD: 0.1,        // 1 point = 0.1 DH
  LOYALTY_REFERRER_BONUS: 50,
  LOYALTY_REFEREE_BONUS: 20,
  LOYALTY_FOLDER_BONUS: 30
};
```

---

**Référence DTOs v1.0 - OptiSaas**
Dernière mise à jour: Avril 2026
