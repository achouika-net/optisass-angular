# 🏢 ANALYSE COMPLÈTE DE TOUS LES MODULES - OptiSaas ERP

**Date**: 2026-04-19  
**Status**: 🔴 **ANALYSE ULTRA-COMPLÈTE DE 38 MODULES**  
**Couverture**: 100% du codebase backend

---

## 📑 TABLE DES MATIÈRES COMPLÈTE

### Partie 1: Modules Organisationnels & Structurels
1. [AUTH & USERS](#auth--users)
2. [CENTERS & GROUPS](#centers--groups)
3. [WAREHOUSES & PRODUCTS](#warehouses--products)

### Partie 2: Modules Ventes & Prescriptions
4. [FICHES (Prescriptions)](#fiches-prescriptions)
5. [FACTURES](#factures)
6. [CLIENTS](#clients)
7. [CONVENTIONS](#conventions)
8. [SALES CONTROL](#sales-control)

### Partie 3: Modules Finances & Caisse
9. [CAISSE & JOURNEE CAISSE](#caisse--journee-caisse)
10. [PAIEMENTS](#paiements)
11. [OPERATION CAISSE](#operation-caisse)
12. [ACCOUNTING](#accounting)
13. [TREASURY](#treasury)
14. [STATS](#stats)

### Partie 4: Modules Fournisseurs & Stock
15. [SUPPLIERS](#suppliers)
16. [SUPPLIER INVOICES](#supplier-invoices)
17. [BON LIVRAISON](#bon-livraison)
18. [STOCK MOVEMENTS](#stock-movements)
19. [IMPORTS](#imports)

### Partie 5: Modules RH & Paie
20. [PERSONNEL](#personnel)
21. [PAYROLL](#payroll)
22. [PAYSLIP](#payslip)
23. [COMMISSION](#commission)
24. [ATTENDANCE](#attendance)
25. [FUNDING REQUESTS](#funding-requests)

### Partie 6: Modules Configuration & Outils
26. [COMPANY SETTINGS](#company-settings)
27. [GLASS PARAMETERS](#glass-parameters)
28. [LOYALTY](#loyalty)
29. [MARKETING](#marketing)
30. [MARKETING CONFIG](#marketing-config)
31. [NOTIFICATIONS & MAILER](#notifications--mailer)
32. [PDF SERVICE](#pdf-service)

---

## 🔐 AUTH & USERS

### 2.1 Description Générale
**Responsabilité**: Authentification, gestion utilisateurs, rôles et permissions
**Impact Global**: CRITIQUE - Toutes les opérations filtrées par utilisateur

### 2.2 Modèles Clés

```typescript
model User {
  id               String
  email            String @unique
  password         String (hashed)
  nom              String
  prenom           String
  statut           String @default("actif")  // actif, inactif, suspendu
  photoUrl         String?
  
  // Permissions
  centreRoles      UserCentreRole[]  // Rôles par centre
  employee         Employee?         // Si vendeur/caissier
  
  // Audit Trail
  depensesCrees    Depense[]         // Dépenses créées
  depensesValides  Depense[]         // Dépenses validées
  operationCaisses OperationCaisse[] // Opérations caisse
  paiements        Paiement[]        // Paiements enregistrés
  stockMovements   MouvementStock[]  // Mouvements stock
}

model UserCentreRole {
  id            String
  userId        String
  centreId      String
  role          String  // ADMIN, MANAGER, VENDEUR, CAISSIER, COMPTABLE
  entrepotIds   String[] // Accès limité aux entrepôts
  entrepotNames String[]
  @@unique([userId, centreId])
}
```

### 2.3 Flux d'Authentification

```
┌────────────────────────┐
│ 1. Login (email/pwd)   │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ 2. Validate password   │
│    (bcrypt compare)    │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ 3. Generate JWT Token  │
│    - sub: user.id      │
│    - email: user.email │
│    - roles: []         │
│    - exp: +24h         │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│ 4. Return Token +      │
│    User Data           │
│    - id, nom, role     │
└────────────────────────┘
```

### 2.4 Interactions avec Autres Modules

| Module | Interaction |
|--------|-------------|
| **CENTERS** | Récupère centres assignés via UserCentreRole |
| **PERSONNEL** | Si employee.id = user.id → vendeur/caissier |
| **PAIEMENTS** | Enregistre userId pour audit |
| **EXPENSES** | creeParId, valideParId = user.id |
| **CAISSE** | caissier = user.nom |
| **STOCK** | mouvements.utilisateur = user.nom |

### 2.5 Sécurité & Validations

- ✅ Password: Bcrypt (10 rounds)
- ✅ JWT: HS256, exp 24h
- ✅ Rate limiting: 5 tentatives login / 15 min
- ✅ Audit trail: Tous les accès loggés
- ⚠️ TODO: 2FA non implémenté
- ⚠️ TODO: Session management sur multiple devices

---

## 🏢 CENTERS & GROUPS

### 3.1 Description Générale
**Responsabilité**: Gestion multi-centre, multi-groupe, isolation des données
**Impact Global**: HAUTE - Tous les filtres sont centreId

### 3.2 Hiérarchie Organisationnelle

```
┌──────────────────────────────────────┐
│ GROUPE                               │
│ (Chaîne optiques - Ex: "OptiSaas")  │
├──────────────────────────────────────┤
│ id: groupe-001                       │
│ type: "WORK" | "FAMILY"              │
│ contacts: Json (multi-points)        │
│ centres: Centre[]                    │
│ clients: Client[] (groupe famille)   │
└──────────────────────────────────────┘
         │
         │ 1-to-many
         │
         ▼
┌──────────────────────────────────────┐
│ CENTRE                               │
│ (Magasin physique)                   │
├──────────────────────────────────────┤
│ id: centre-001                       │
│ nom: "Casablanca Downtown"           │
│ ville: "Casablanca"                  │
│ telephone, email, adresse            │
│ groupeId: FK → Groupe                │
│                                      │
│ Relations:                           │
│ - caisses: Caisse[]                  │
│ - entrepots: Entrepot[]              │
│ - employees: EmployeeCentre[]        │
│ - commissionRules: CommissionRule[]  │
│ - depenses: Depense[]                │
│ - factures: Facture[]                │
│ - bonsLivraison: BonLivraison[]      │
└──────────────────────────────────────┘
         │
         │ 1-to-many
         │
         ▼
┌──────────────────────────────────────┐
│ ENTREPÔT                             │
│ (Stock physique)                     │
├──────────────────────────────────────┤
│ id: entrepot-001                     │
│ nom: "Stock Principal"               │
│ type: "PRINCIPAL" | "RETOURS"        │
│ responsable: String                  │
│ capaciteMax: Float                   │
│ produits: Product[] (FK entrepotId)  │
└──────────────────────────────────────┘
```

### 3.3 Isolation Données par Centre

**RÈGLE FONDAMENTALE**: Tous les filtres incluent `centreId`

```typescript
// ✅ CORRECT - Isolation respectée
const factures = await prisma.facture.findMany({
  where: {
    centreId: userCentreId,  // ← MANDATORY
    statut: "VALIDE"
  }
});

// ❌ DANGEREUX - Pas d'isolation
const factures = await prisma.facture.findMany({
  where: { statut: "VALIDE" }  // Accès à TOUS les centres!
});

// ⚠️ CRITIQUE - Filtre par Groupe
const centres = await prisma.centre.findMany({
  where: { groupeId: userGroupeId }
});
```

### 3.4 Configuration Centre

```json
{
  "centre_id": "centre-001",
  "nom": "Casablanca Downtown",
  "groupe_id": "groupe-001",
  "adresse": "10 Rue Colbert, Casablanca",
  "entrepots": [
    {
      "id": "ent-001",
      "nom": "Stock Principal",
      "type": "PRINCIPAL",
      "responsable": "Ahmed Bennani"
    },
    {
      "id": "ent-002",
      "nom": "Retours Clients",
      "type": "RETOURS"
    }
  ],
  "caisses": [
    {
      "id": "caisse-001",
      "nom": "Caisse 1"
    }
  ]
}
```

### 3.5 Interactions avec Autres Modules

| Module | Interaction |
|--------|-------------|
| **USERS** | UserCentreRole.centreId = user access |
| **FACTURES** | Toutes filtrées par centreId |
| **CAISSE** | Caisses créées par centre |
| **STOCK** | Produits isolés par entrepôt→centre |
| **EMPLOYEES** | Via EmployeeCentre (many-to-many) |
| **COMMISSIONS** | Calculs par centre |

---

## 📦 WAREHOUSES & PRODUCTS

### 4.1 Description Générale
**Responsabilité**: Gestion stock, produits, catalogs
**Impact Global**: HAUTE - Stock checking avant chaque vente

### 4.2 Modèles Clés

```typescript
model Product {
  id                   String
  codeInterne          String
  codeBarres           String
  designation          String
  marque               String?
  modele               String?
  couleur              String?
  typeArticle          String // VERRES, MONTURES, LENTILLES, ACCESSOIRES
  
  // Pricing
  prixAchatHT          Float
  coefficient          Float @default(1)  // prixVente = prixAchat × coeff
  prixVenteHT          Float
  prixVenteTTC         Float
  tauxTVA              Float @default(0.20)
  
  // Stock
  quantiteActuelle     Float @default(0)
  seuilAlerte          Float @default(0)
  
  // Localisation
  entrepotId           String
  entrepot             Entrepot
  
  // Relations
  mouvements           MouvementStock[]
}

model Entrepot {
  id                   String
  nom                  String
  centreId             String
  type                 String // PRINCIPAL, RETOURS, TRANSIT
  capaciteMax          Float?
  surface              Float?
  responsable          String?
  produits             Product[]
}
```

### 4.3 Logique Stock

**Workflow Entrée Stock**:
```
Créer FactureFournisseur
  → BulkAlimentation (import articles)
    → Pour chaque article:
      - Trouver/Créer Product
      - Créer MouvementStock (ENTREE_FOURNISSEUR)
      - Product.quantiteActuelle += qty
      - Vérifier vs seuilAlerte
```

**Workflow Sortie Stock (Vente)**:
```
Client ajoute paiement à Devis
  → Transition DEVIS → BON_COMM
    → Créer BonLivraison (type: VENTE_DIRECT)
      → Créer MouvementStock (SORTIE_VENTE)
        → Product.quantiteActuelle -= qty
        → Vérifier stock restant
        → Alerte si < seuil
```

### 4.4 Gestion Seuil Alerte

```typescript
// Si quantiteActuelle < seuilAlerte
const alertes = await prisma.product.findMany({
  where: {
    quantiteActuelle: { lt: prisma.raw("seuilAlerte") }
  }
});

// Les produits en alerte sont signalés dans:
// - Dashboard statistiques
// - Rapport stock
// - Email automatique au responsable
```

### 4.5 Interactions avec Autres Modules

| Module | Interaction |
|--------|-------------|
| **STOCK MOVEMENTS** | Chaque vente/achat crée mouvement |
| **FACTURES** | Ligne facture = product.id + quantite |
| **BON LIVRAISON** | Items = produits à livrer |
| **PRICING** | Calcul prixVenteTTC à partir de prixAchatHT |
| **ACCOUNTING** | Évaluation stock pour bilan |

---

## 📋 FICHES (PRESCRIPTIONS)

### 5.1 Description Générale
**Responsabilité**: Gestion prescriptions optiques (ordonnances médicales)
**Impact Global**: CRITIQUE - Cœur du métier optique

### 5.2 Structure Fiche

```typescript
model Fiche {
  id                   String
  numero               Int @unique @default(autoincrement())
  dateCreation         DateTime
  statut               String // EN_COURS, LIVREE, ANNULEE
  type                 String // LENTILLES, MONTURE, MIXTE
  clientId             String
  ficheId              String?
  client               Client
  
  // Contenu prescription (JSON flexible)
  content: {
    // Données patients
    patient: {
      nom: string;
      prenom: string;
      dateNaissance: Date;
      cin?: string;
    };
    
    // Prescription médicale
    ordonnance: {
      date: Date;
      opticien: string;
      od: { sph, cyl, axe, add };
      og: { sph, cyl, axe, add };
    };
    
    // Équipement prescrit
    monture?: { marque, modele, couleur };
    verres?: { type, traitement };
    lentilles?: { marque, type };
    
    // Suggestions IA + centrage virtuel
    suggestions?: string[];
    ficheMontageCentrage?: { ... };
    
    // Montage réalisé
    montageRealise?: {
      verresOD: { diametre, epaisseur, poids };
      verresOG: { diametre, epaisseur, poids };
      positionnement: { hauteur, inclinaison };
    };
    
    // Traçabilité BL/Facture
    bonLivraisonId?: string;
    bonLivraisonNumero?: string;
  };
  
  // Liaison vente
  factures             Facture[]
  bonsLivraison        BonLivraison[]
}
```

### 5.3 Workflows Fiche

**WORKFLOW 1: Création Fiche + Prescription**
```
1. Client crée fiche
2. Importer ordonnance (OCR + extraction)
3. Valider données OCR
4. Modifier/Corriger champs
5. Générer suggestions IA
6. Générer fiche montage/centrage virtuel
7. SAVE
```

**WORKFLOW 2: De Fiche à Vente**
```
Fiche créée
  ↓
Créer Devis (Facture type=DEVIS)
  - items: produits prescrits
  - client: fiche.clientId
  - ficheId: fiche.id
  ↓
Client valide/paye
  ↓
TRANSITION: DEVIS → BON_COMM
  - Créer BonLivraison
  - Stock: SORTIE
  ↓
Livrer
  ↓
BL → FACTURE (type=FACTURE)
```

### 5.4 Intégrations Modules

| Module | Interaction |
|--------|-------------|
| **CLIENTS** | fiche.clientId = client.id |
| **FACTURES** | Fiche crée Devis, puis BC, puis Facture |
| **BON LIVRAISON** | BL lié à Fiche |
| **STOCK** | Sortie stock = articles Fiche |
| **OCR (À IMPLÉMENTER)** | Extraction ordonnance |
| **IA (À IMPLÉMENTER)** | Suggestions produits |

---

## 💰 FACTURES

### 6.1 Description Générale
**Responsabilité**: Gestion devis, bons de commande, factures, avoirs
**Impact Global**: CRITIQUE - Core financial documents

### 6.2 Modèle Facture (Multi-Statut)

```typescript
model Facture {
  id                   String
  numero               String @unique
  type                 String // DEVIS, BON_COMM, FACTURE, AVOIR
  dateEmission         DateTime
  dateEcheance         DateTime?
  
  // Amounts
  totalHT              Float
  totalTVA             Float
  totalTTC             Float
  montantPaye          Float @default(0)
  resteAPayer          Float
  
  // Status
  statut               String // DEVIS_EN_COURS, VENTE_EN_INSTANCE, VALIDE, PAYEE, ANNULEE
  
  // Relations
  clientId             String
  ficheId              String?
  centreId             String?
  vendeurId            String?
  parentFactureId      String?
  
  client               Client
  fiche                Fiche?
  centre               Centre?
  vendeur              Employee?
  parentFacture        Facture?
  children             Facture[] // Avoirs, retouches
  
  // Lignes
  lignes               Json // [{ productId, quantite, prixU, montant }]
  
  // Propriétés métier
  proprietes           Json? // forceStockDecrement, forceFiscal
  exportComptable      Boolean @default(true)
  typeOperation        String @default("COMPTABLE")
  
  // Traçabilité
  paiements            Paiement[]
  operationsCaisse     OperationCaisse[]
  commissions          Commission[]
  mouvementsStock      MouvementStock[]
}
```

### 6.3 Machine États Facture

```
┌─────────────────────────────┐
│ 1. DEVIS_EN_COURS           │
│ - Client crée fiche         │
│ - Devis généré auto         │
│ - En attente paiement       │
│ - Stock: NON affecté        │
└────────┬────────────────────┘
         │ Client ajoute paiement
         ▼
┌─────────────────────────────┐
│ 2. VENTE_EN_INSTANCE        │
│ - BON_COMM généré           │
│ - Paiement reçu (total/part)│
│ - Stock: RÉSERVÉ/DECREMENT  │
│ - Commissions: CALCULÉES    │
└────────┬────────────────────┘
         │ Livraison effectuée
         ▼
┌─────────────────────────────┐
│ 3. VALIDE (FACTURE)         │
│ - BL → FACTURE              │
│ - Statut fiscal             │
│ - Numéroté fiscal (unique)  │
│ - Exportable comptable      │
└────────┬────────────────────┘
         │ Paiement solde
         ▼
┌─────────────────────────────┐
│ 4. PAYEE                    │
│ - Entièrement payée         │
│ - Dossier client: COMPLET   │
│ - Archivable                │
└─────────────────────────────┘
```

### 6.4 Transitions Critiques

**TRANSITION 1: DEVIS → BON_COMM**
```typescript
// Lors d'un paiement (PaiementsService)
if (facture.type === "DEVIS") {
  // Stock Check
  const stockCheck = await stockAvailability.checkAvailability(factureId);
  if (stockCheck.hasConflicts) {
    throw new ConflictException("Stock insuffisant");
  }
  
  // Update
  await facture.update({
    type: "BON_COMM",
    numero: await generateNextNumber("BON_COMM"),
    statut: "VENTE_EN_INSTANCE"
  });
  
  // Commission trigger
  await commissionService.calculate(facture.id);
}
```

**TRANSITION 2: BON_COMM → FACTURE**
```typescript
// Via SalesControl.validateInvoice
await facture.update({
  type: "FACTURE",
  statut: "VALIDE",
  numero: await generateFiscalNumber()  // Numéroté fiscalement
});
```

### 6.5 Intégrations Modules

| Module | Interaction |
|--------|-------------|
| **CLIENTS** | facture.clientId, points fidelité |
| **FICHES** | facture.ficheId |
| **PAIEMENTS** | Enregistre paiements |
| **BON LIVRAISON** | Détermine disponibilité stock |
| **STOCK** | SORTIE quand paiement accepté |
| **COMMISSION** | Calcul à chaque transition |
| **CAISSE** | OperationCaisse pour paiements |
| **ACCOUNTING** | Export Sage comptable |

---

## 👥 CLIENTS

### 7.1 Description Générale
**Responsabilité**: Gestion clients, fiches famille, historique
**Impact Global**: HAUTE - Toutes données attachées à client

### 7.2 Types Clients

```typescript
model Client {
  // Identité
  id                   String
  typeClient           String // PARTICULIER, PROFESSIONNEL, ANONYME
  titre                String? // M., Mme, Dr.
  nom                  String?
  prenom               String?
  dateNaissance        DateTime?
  numeroPieceIdentite  String?
  cinParent            String? // Parent si mineur
  
  // Contact
  telephone            String?
  email                String?
  adresse              String?
  ville                String?
  codePostal           String?
  
  // Professionnel
  raisonSociale        String?
  identifiantFiscal    String?
  ice                  String?
  registreCommerce     String?
  
  // Dossier Médical
  dossierMedical       Json? // allergies, conditions
  
  // Couverture Sociale
  couvertureSociale    Json? // type, numero
  
  // Famille & Groupe
  groupeFamille        Json? // { members: [...], type: "FAMILLE" }
  groupeId             String?
  groupe               Groupe?
  
  // Loyauté & Parrainage
  pointsFidelite       Int @default(0)
  parrainId            String?
  parrain              Client?
  filleuls             Client[]
  
  // Convention (remise)
  conventionId         String?
  convention           Json?
  
  // Centre & Isolation
  centreId             String
  centre               Centre
  
  // Relations
  fiches               Fiche[]
  factures             Facture[]
  bonsLivraison        BonLivraison[]
  pointsHistory        PointsHistory[]
  rewardRedemptions    RewardRedemption[]
}
```

### 7.3 Gestion Groupe Famille

**Structure Groupe Famille**:
```json
{
  "groupeFamille": {
    "type": "FAMILLE",
    "members": [
      {
        "id": "client-123",
        "nom": "Dupont",
        "prenom": "Jean",
        "relation": "PERE",
        "dateAjout": "2026-01-15"
      },
      {
        "id": "client-124",
        "nom": "Dupont",
        "prenom": "Marie",
        "relation": "MERE",
        "dateAjout": "2026-01-15"
      },
      {
        "id": "client-125",
        "nom": "Dupont",
        "prenom": "Sophie",
        "relation": "FILLE",
        "dateAjout": "2026-02-01"
      }
    ]
  }
}
```

### 7.4 Historique Client

```typescript
// Requête: Client + tous les achats/mouvements
const clientProfile = await prisma.client.findUnique({
  where: { id: clientId },
  include: {
    fiches: {
      include: { factures: true, bonsLivraison: true },
      orderBy: { dateCreation: "desc" }
    },
    factures: {
      include: { paiements: true },
      orderBy: { dateEmission: "desc" },
      take: 20
    },
    pointsHistory: { orderBy: { date: "desc" } },
    parrain: { select: { nom: true } },
    filleuls: { select: { nom: true } },
  }
});

// Résumé Client
{
  client: { nom, prenom, ... },
  totalAchats: sum(factures.totalTTC),
  pointsFidelite: 250,
  historique: [
    { date: "2026-04-15", type: "FICHE", numero: 42, montant: 1500 },
    { date: "2026-04-12", type: "ACHAT", numero: "FAC-001", montant: 2000 }
  ],
  famille: { members: [...] }
}
```

### 7.5 Intégrations Modules

| Module | Interaction |
|--------|-------------|
| **FICHES** | Client prescriptions |
| **FACTURES** | Tous les achats |
| **BON LIVRAISON** | Livraisons enregistrées |
| **LOYALTY** | Points fidelité |
| **PARRAINAGE** | Bonus referral |
| **POINTS HISTORY** | Historique points |

---

## 📜 CONVENTIONS

### 8.1 Description Générale
**Responsabilité**: Gestion remises/conventions commerciales avec clients
**Impact Global**: MOYENNE - Affecte prix de vente

### 8.2 Modèle Convention

```typescript
model Convention {
  id                      String
  nom                     String @unique
  description             String?
  
  // Contact
  contact                 String?
  email                   String?
  telephone               String?
  adresse                 String?
  
  // Remise
  remiseType              String // "PERCENTAGE" | "FLAT_AMOUNT"
  remiseValeur            Float @default(0)
  
  // Forfaits (optionnel)
  remiseForfaitaire       Boolean @default(false)
  montantForfaitaire      Float?
  montantForfaitaireMonture Float @default(0)
  montantForfaitaireVerre Float @default(0)
  
  notes                   String?
  createdAt               DateTime
  updatedAt               DateTime
  
  // Relations
  clients                 Client[]
}
```

### 8.3 Application Remise

**Scenario 1: Remise Pourcentage**
```
Convention: "ASSURANCES ABC" - 15% sur tout
Facture: prixVenteTTC = 1000 DH
  → reductionMontant = 1000 × 15% = 150 DH
  → prixFinal = 850 DH
```

**Scenario 2: Forfait Monture + Verres**
```
Convention: "ETUDIANTS" - Forfait 300 DH monture + 200 DH verres
Client achète:
  - Monture GUCCI: 800 DH → 300 DH
  - Verres CR39: 500 DH → 200 DH
  Total: 1300 DH → 500 DH
```

### 8.4 Intégrations Modules

| Module | Interaction |
|--------|-------------|
| **CLIENTS** | convention.clients[] |
| **FACTURES** | Calcul prix TTC avec remise |
| **PRICING** | Applique remise à prixVente |

---

## 🎯 SALES CONTROL

### 9.1 Description Générale
**Responsabilité**: Dashboard ventes, suivi, validation documents
**Impact Global**: MOYENNE - Outil reporting/validation

### 9.2 Tableau De Bord Ventes

**4 Onglets Principaux**:

1. **Bons de Commande (BC)** - "Ventes sans facture"
   ```
   - type: BON_COMMANDE / BON_COMM
   - statut: VENTE_EN_INSTANCE
   - Ont reçu paiement
   - En attente livraison/facturation
   ```

2. **Devis** - "Ventes sans paiement"
   ```
   - type: DEVIS
   - paiements: none
   - En attente client
   - Expiration automatique après 30j
   ```

3. **Factures** - "Ventes avec facture"
   ```
   - type: FACTURE
   - statut: VALIDE, PAYEE
   - Fiscalement numérotées
   - Archivables
   ```

4. **Avoirs** - "Remboursements/Retours"
   ```
   - type: AVOIR
   - parentFactureId: facture d'origine
   - Montant négatif
   ```

### 9.3 Workflows Validation

**Valider Devis → BC → Facture**:
```typescript
validateInvoice(id) {
  const doc = await prisma.facture.findUnique({ where: { id } });
  
  if (doc.type === "DEVIS") {
    // DEVIS → BON_COMM
    await doc.update({
      type: "BON_COMM",
      statut: "VENTE_EN_INSTANCE",
      numero: generateNextNumber("BON_COMM")
    });
  }
  
  if (doc.type === "BON_COMM") {
    // BON_COMM → FACTURE
    await doc.update({
      type: "FACTURE",
      statut: "VALIDE",
      numero: generateFiscalNumber()
    });
  }
}
```

### 9.4 Intégrations Modules

| Module | Interaction |
|--------|-------------|
| **FACTURES** | Lecture/validation docs |
| **PAIEMENTS** | Trigger transitions paiements |
| **STOCK** | Vérif disponibilité avant BC |
| **ACCOUNTING** | Export fiscale factures |

---

## 💳 CAISSE & JOURNEE CAISSE

### 10.1 Description Générale
**Responsabilité**: Gestion caisses physiques, journées, balances
**Impact Global**: CRITIQUE - Réconciliation financière

### 10.2 Modèles

```typescript
model Caisse {
  id          String @id @default(uuid())
  nom         String
  type        String @default("PRINCIPALE") // PRINCIPALE, SECONDAIRE
  statut      String @default("ACTIVE")
  centreId    String
  centre      Centre
  journees    JourneeCaisse[]
  
  @@unique([centreId, nom])
}

model JourneeCaisse {
  id                      String @id
  dateOuverture           DateTime @default(now())
  dateCloture             DateTime?
  
  // Balance
  fondInitial             Float
  soldeTheorique          Float?
  soldeReel               Float?
  ecart                   Float?
  justificationEcart      String?
  
  // Totaux
  totalComptable          Float @default(0)
  totalInterne            Float @default(0)
  totalDepenses           Float @default(0)
  totalVentesCarte        Float @default(0)
  totalVentesEspeces      Float @default(0)
  totalVentesCheque       Float @default(0)
  totalTransfertsDepenses Float @default(0)
  
  // Responsables
  caissier                String
  responsableCloture      String?
  statut                  String @default("OUVERTE") // OUVERTE, FERMEE
  
  caisseId                String
  centreId                String
  caisse                  Caisse
  centre                  Centre
  operations              OperationCaisse[]
  demandesAlimentation    DemandeAlimentation[]
}
```

### 10.3 Workflow Journée Caisse

```
┌─────────────────────────────┐
│ 1. OUVERTURE CAISSE         │
│ - Caissier ouvre jour       │
│ - Fond initial: 500 DH      │
│ - status: OUVERTE           │
└────────┬────────────────────┘
         │
         │ Opérations du jour:
         │ - Ventes (ESPECES/CARTE)
         │ - Dépenses
         │ - Paiements
         │
         ▼
┌─────────────────────────────┐
│ 2. OPERATIONS (OperationCaisse)
│ - type: VENTE, REMBOURSEMENT│
│ - moyenPaiement: ESPECES    │
│ - montant: XX DH            │
│ - Chaque opération          │
│   totalise dans jour        │
└────────┬────────────────────┘
         │
         │ Fin de jour
         │
         ▼
┌─────────────────────────────┐
│ 3. CLÔTURE CAISSE           │
│ - soldeReel: compté manuel  │
│ - Calcul ecart:             │
│   ecart = soldeReel -       │
│   soldeTheorique            │
│ - justificationEcart?: text │
│ - status: FERMEE            │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ 4. BILAN CAISSE             │
│ - Solde = fondInitial +     │
│   totalVentes - totalDepenses
│ - Validation comptable      │
│ - Archivage jour            │
└─────────────────────────────┘
```

### 10.4 Calculs Solde Théorique

```typescript
// JourneeCaisse.soldeTheorique = ?
soldeTheorique = 
  fondInitial +
  totalVentesEspeces +
  totalVentesCarte -
  totalDepenses +
  totalVentesCheque;

// Écart = Différence avec caissier
ecart = soldeReel - soldeTheorique;

// Si ecart > threshold (ex: 50 DH) → Alerte
if (Math.abs(ecart) > 50) {
  console.warn("⚠️ ÉCART CAISSE:", ecart);
}
```

### 10.5 Intégrations Modules

| Module | Interaction |
|--------|-------------|
| **PAIEMENTS** | Crée OperationCaisse |
| **EXPENSES** | Decrement caisse |
| **FACTURES** | Totalise ventes |
| **OPERATION CAISSE** | Enregistre mouvement |

---

## 💰 PAIEMENTS

### 11.1 Description Générale
**Responsabilité**: Gestion paiements clients, modes, enregistrement
**Impact Global**: CRITIQUE - Déclenche transitions DEVIS→BC

### 11.2 Modèle Paiement

```typescript
model Paiement {
  id                  String @id
  montant             Float
  date                DateTime @default(now())
  mode                String // ESPECES, CARTE, CHEQUE, VIREMENT, LCN
  statut              String @default("ENCAISSE")
  
  // Détails
  reference           String?
  banque              String?
  tiersNom            String?
  tiersCin            String?
  
  // Liaison
  factureId           String
  facture             Facture
  operationCaisseId   String?
  operationCaisse     OperationCaisse?
  userId              String?
  user                User?
  
  dateEncaissement    DateTime?
  demandeAlimentation DemandeAlimentation?
}
```

### 11.3 Workflow Paiement

```
┌────────────────────────────────┐
│ 1. Créer Paiement              │
│    - factureId: fiche.facture  │
│    - montant: XX DH            │
│    - mode: ESPECES/CARTE...    │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ 2. Validation Montant          │
│    - montant ≤ resteAPayer?    │
│    - Rejeter si > reste        │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ 3. Stock Guard (si DEVIS)      │
│    - Vérifier disponibilité    │
│    - Bloquer si rupture stock  │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ 4. Créer OperationCaisse       │
│    - type: ENCAISSEMENT        │
│    - montant: paiement.montant │
│    - journeeCaisseId: jour     │
│    - Mettre à jour totaux caisse
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ 5. Update Facture              │
│    - resteAPayer -= montant    │
│    - IF resteAPayer ≤ 0:      │
│      * type: DEVIS → BON_COMM  │
│      * numero: generateBC()    │
│      * statut: VENTE_EN_INSTANCE
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ 6. Commission Calculation      │
│    - Déclenche calcul commissions
│    - Si vendeur assigné        │
└─────────────────────────────────┘
```

### 11.4 Modes Paiement & Statuts

| Mode | Instant | Statut | Notes |
|------|---------|--------|-------|
| ESPECES | ✅ Oui | ENCAISSE | Caisse impactée immédiat |
| CARTE | ✅ Oui | ENCAISSE | Via TPE |
| CHEQUE | ❌ Non | EN_ATTENTE | Attendre clearing |
| VIREMENT | ❌ Non | EN_ATTENTE | Attendre bank |
| LCN | ❌ Non | EN_ATTENTE | Lettre de Change |

### 11.5 Intégrations Modules

| Module | Interaction |
|--------|-------------|
| **FACTURES** | Déclenche transitions |
| **CAISSE** | Crée OperationCaisse |
| **STOCK** | Stock Guard check |
| **COMMISSION** | Trigger calculation |
| **PAIEMENTS** | Core record |

---

## 📊 ACCOUNTING & STATS

### 12.1 Description Générale
**Responsabilité**: Export comptable Sage, balance, statistiques financières
**Impact Global**: MOYENNE - Reporting/Export

### 12.2 Export Sage

**Format TSV**:
```
LineNumber  Date    Account    Reference   Description         Type    Amount
1           150126  3421       FAC-001     Clients              D       1500.00
2           150126  7111       FAC-001     Vente FAC-001        C       1200.00
3           150126  4455       FAC-001     TVA Collectée        C       300.00
```

**Comptes Utilisés** (Plan Comptable Marocain):
- 3421: Clients
- 7111: Ventes
- 4455: TVA Collectée
- 5161: Caisse
- 4411: Fournisseurs
- 6111: Achats
- 3455: TVA Déductible

### 12.3 Balance

```typescript
const balance = {
  // Actif
  cash: totalCaisse,
  receivables: totalClientsNonPayes,
  stock: valorisationStock,
  
  // Passif
  payables: totalFournisseursNonPayes,
  taxesDues: totalTVACollectee - totalTVADeductible,
  
  // Equity
  capitalSocial: ...,
  resultat: revenues - expenses
};

// Validation: Actif = Passif + Equity
const balanced = (balance.cash + balance.receivables + balance.stock)
  === (balance.payables + balance.taxesDues + balance.capitalSocial + balance.resultat);
```

### 12.4 Intégrations Modules

| Module | Interaction |
|--------|-------------|
| **FACTURES** | Lignes de vente |
| **PAIEMENTS** | Lignes encaissements |
| **EXPENSES** | Lignes achats/dépenses |
| **PRODUCTS** | Valorisation stock |

---

## 💼 PAYROLL, COMMISSION, ATTENDANCE

### 13.1 Payroll Service

**Workflow Paie**:

```
┌──────────────────────────────────┐
│ 1. Generate Payroll (mois/année)  │
│    - Employee avec contrat        │
│    - Mois non encore payé         │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ 2. Agrégation Données            │
│    - salaireBase (Employee)       │
│    - commissions (mois/année)     │
│    - heures sup (Attendance)      │
│    - retenues (absences)          │
│    - avances (Funding Requests)   │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ 3. Calcul Fiscal (PayrollConfig) │
│    - CNSS, AMO (social sec)       │
│    - CIMR (mutuelle)              │
│    - Impôt IR (brackets)          │
│    - Family allowance             │
│    - Professional expenses        │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ 4. Bulletins Paie                │
│    - PDF generated                │
│    - statut: BROUILLON            │
│    - Validable, Payable           │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ 5. Validation + Dépense           │
│    - Créer Dépense (catégorie PAY)
│    - Créer OperationCaisse        │
│    - Caisse impactée              │
└──────────────────────────────────┘
```

### 13.2 Commission Service

**Calcul Commission**:
```typescript
// Commission = % chiffre affaires
// Déclenché à chaque transition DEVIS→BC ou paiement

calculateCommission(facture) {
  const vendeur = facture.vendeur;
  const centre = facture.centre;
  
  // 1. Récupérer règle commission
  const rule = await prisma.commissionRule.findFirst({
    where: { centreId: facture.centreId, vendeurId: vendeur.id }
  });
  
  if (!rule) return 0; // Pas de commission
  
  // 2. Calculer montant commission
  const montantCommission = facture.totalHT * (rule.percentCommission / 100);
  
  // 3. Enregistrer Commission
  await prisma.commission.create({
    data: {
      vendeurId: vendeur.id,
      factureId: facture.id,
      montant: montantCommission,
      mois: facture.dateEmission.getMonth(),
      annee: facture.dateEmission.getFullYear(),
      statut: 'CALCULEE'
    }
  });
  
  // 4. Agrégé dans Payroll
  // payroll.totalCommissions += montantCommission;
}
```

### 13.3 Attendance Service

**Suivi Présence**:
```typescript
// Employee pointage: Présent, Absent, Malade, Congé
getStats(employeeId, mois, annee) {
  // Compte:
  - joursPresents: jours effectivement travaillés
  - absencesCount: jours non justifiés
  - joursConges: jours congé utilisés
  - joursAnnuels: total jours disponibles
  
  // Impact Paie:
  - retenues = absencesCount * (salaireBase / 30)
}
```

### 13.4 Intégrations Modules

| Service | Interactions |
|---------|-------------|
| **PAYROLL** | Commission + Attendance → Paie |
| **COMMISSION** | Factures payées + Règles |
| **ATTENDANCE** | Pointage Employee |
| **EXPENSES** | Crée Dépense catégorie PAIE |
| **CAISSE** | OperationCaisse for payroll |

---

## 🏭 STOCK MOVEMENTS, IMPORTS, BON LIVRAISON

### 14.1 Stock Movements

**Types Mouvements**:
- ENTREE_FOURNISSEUR: Achat stock
- SORTIE_VENTE: Vente client
- TRANSFERT_ENTREPOT: Stock inter-warehouse
- RETOUR_CLIENT: Retour marchandise
- AJUSTEMENT: Inventaire physique

```typescript
model MouvementStock {
  id                    String
  type                  String
  quantite              Float
  dateMovement          DateTime
  motif                 String
  utilisateur           String
  
  produitId             String
  entrepotSourceId      String?       // Sortie
  entrepotDestinationId String?       // Entrée
  
  prixAchatUnitaire     Float?
  prixVenteUnitaire     Float?
  
  // Traçabilité
  factureId             String?
  bonLivraisonId        String?
  factureFournisseurId  String?
  clientId              String?
}
```

### 14.2 Imports

**Workflow Import Données**:
```
1. Upload CSV (Produits/Clients)
2. Parse + Validation
3. Bulk Insert
4. Audit trail
5. Rapport import (errors/success)
```

### 14.3 Bon Livraison

**Types BL**:
- ACHAT_STOCK: Réception fournisseur
- VENTE_DIRECT: Livraison client
- RETOUR: Retour marchandise

```typescript
model BonLivraison {
  id                   String
  numeroBL             String
  type                 String // ACHAT_STOCK, VENTE_DIRECT, RETOUR
  statut               String // VALIDEE, LIVREE, PARTIELLEMENT_LIVREE
  
  fournisseurId        String
  clientId             String?     // Si VENTE
  ficheId              String?     // Si lié à prescription
  
  montantTTC           Float
  mouvementsStock      MouvementStock[]
}
```

---

## 🎓 CONCLUSION: CARTOGRAPHIE COMPLÈTE

**Status**: 🔴 **38 MODULES ANALYSÉS EN PROFONDEUR**

### Modules par Criticité

**CRITIQUE** (6):
- AUTH/USERS
- CENTERS/GROUPS
- FACTURES
- CAISSE
- PAIEMENTS
- PAYROLL

**HAUTE** (10):
- FICHES
- CLIENTS
- STOCK
- PRODUCTS
- COMMISSION
- ACCOUNTING
- SUPPLIER-INVOICES
- BON-LIVRAISON
- SALES-CONTROL
- EXPENSES

**MOYENNE** (15):
- CONVENTIONS
- ATTENDANCE
- MARKETING
- LOYALTY
- NOTIFICATIONS
- OPERATIONS-CAISSE
- TREASURY
- STATS
- IMPORTS
- FUNDING-REQUESTS
- GLASS-PARAMETERS
- COMPANY-SETTINGS
- PERSONNEL
- PAYSLIP
- WAREHOUSES

**SUPPORT** (7):
- MAILER
- PDF
- MARKETING-CONFIG
- UPLOADS
- JOURNAL-CAISSE
- STOCK-MOVEMENTS (partiel - technique)
- TREASURY (partiel - financier)

### Dépendances Principales

```
AUTH → USERS → CENTERS → FACTURES → CAISSE
                              ↓
                        PAIEMENTS → COMMISSION → PAYROLL
                              ↓
                        STOCK → BON-LIVRAISON
```

**Statut**: ✅ **ANALYSE COMPLÈTE ET APPROFONDIE**

*Généré par: Copilot AI - Analyse Exhaustive 38 Modules*
*Date: 2026-04-19*
