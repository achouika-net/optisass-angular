# 📋 SPECIFICATION COMPLÈTE - OPTISAAS v1.0

**Date**: 2026-04-19  
**Statut**: ✅ ANALYSE APPROFONDIE COMPLETE  
**Audience**: AI/Développeurs pour implémentation/maintenance

---

## 📑 TABLE DES MATIÈRES

1. [PRÉSENTATION GÉNÉRALE](#présentation-générale)
2. [ARCHITECTURE SYSTÈME](#architecture-système)
3. [MODÈLE DE DONNÉES](#modèle-de-données)
4. [MODULES & FEATURES](#modules--features)
5. [RÈGLES MÉTIER DÉTAILLÉES](#règles-métier-détaillées)
6. [FLUX PROCESSUS](#flux-processus)
7. [VALIDATIONS & CONTRAINTES](#validations--contraintes)
8. [SÉCURITÉ & ISOLATION DONNÉES](#sécurité--isolation-données)
9. [INTERFACE UTILISATEUR](#interface-utilisateur)
10. [POINTS D'INTÉGRATION](#points-dintégration)

---

## 1. PRÉSENTATION GÉNÉRALE

### Qu'est-ce que OptiSaas?

**OptiSaas** est un logiciel SaaS (Software as a Service) multi-centre spécialisé pour **gestion complète de centres optiques**. C'est une plateforme tout-en-un permettant:

- ✅ **Gestion Clients**: Base de données clients + fiches optiques personnalisées
- ✅ **Cycle Commercial**: Devis → Facture → Paiement avec traçabilité
- ✅ **Gestion Stock**: Multi-entrepôts avec mouvements tracés (entrée, sortie, transfert)
- ✅ **Fidélité**: Programme Points "Choukra" (parrainage + rémunération)
- ✅ **Caisse & Trésorerie**: Gestion journalière + rapprochement
- ✅ **Paie Employés**: Bulletins automatisés + commissions variables
- ✅ **Comptabilité**: Exports normes marocaines (Sage, TVA, bilans)
- ✅ **Multi-centres**: Support succursales avec isolation de données

### Contexte Métier

**Secteur**: Optique (lunettes, verres, lentilles, montures)  
**Modèle Client**: B2B SaaS (Abonnement mensuel par centre)  
**Géographie**: Maroc (Plan comptable marocain, TVA 20%, devise DH)  
**Utilisateurs**: 
- Propriétaires centre (Admin)
- Managers (Vendeurs, Caissiers)
- Employés (Vendeurs commission, Caissiers)

### KPIs Principaux Suivis

1. **CA Mensuel** par vendeur/centre
2. **Stock** (valeur, rotations, alertes bas)
3. **Fidélité** (points générés, utilisés, parrainages)
4. **Paiements** (impayés, retards, taux conversion DEVIS→Facture)
5. **Paie** (masse salariale, commissions, déviations)
6. **Trésorerie** (caisse, flux entrées/sorties)

---

## 2. ARCHITECTURE SYSTÈME

### Stack Technologique

```
FRONTEND
  • Framework: Angular 15+
  • Language: TypeScript
  • State: RxJS Observables, Services
  • Forms: Reactive Forms + Validators
  • UI: Material Design + Custom SCSS
  • HTTP: Angular HttpClient + Interceptors

BACKEND
  • Framework: NestJS + Express
  • Language: TypeScript
  • ORM: Prisma
  • Auth: JWT Token-based
  • Validation: Decorators class-validator

DATABASE
  • RDBMS: PostgreSQL 12+
  • Schema: Prisma (migrations auto)
  • Normalization: BCNF

DEPLOYMENT
  • Containerization: Docker + Docker Compose
  • Frontend: Static served (Nginx)
  • Backend: Node.js process
  • Database: PostgreSQL container
  • Persistence: Named volumes

FEATURES TRANSVERSALES
  • Error Handling: Centralized exception filters
  • Logging: Console + Files
  • Caching: Redis optional (sessions)
  • Auth: Role-based access control (RBAC)
  • Audit: User + Timestamp tracked
  • Multi-tenant: Isolation stricte par centre
```

### Structure Répertoires

```
golden-cluster/
├── backend/
│   ├── src/
│   │   ├── features/              [32 modules métier]
│   │   │   ├── factures/
│   │   │   ├── fiches/
│   │   │   ├── clients/
│   │   │   ├── paiements/
│   │   │   ├── loyalty/           [Points Choukra]
│   │   │   ├── stock-movements/
│   │   │   ├── products/
│   │   │   ├── personnel/         [Employees + Commissions]
│   │   │   ├── treasury/          [Trésorerie analytique]
│   │   │   ├── accounting/        [Exports Sage]
│   │   │   ├── caisse/
│   │   │   ├── journee-caisse/    [Caisse quotidienne]
│   │   │   ├── operation-caisse/
│   │   │   ├── expenses/          [Dépenses opérationnelles]
│   │   │   ├── bon-livraison/     [Réceptions fournisseurs]
│   │   │   ├── supplier-invoices/
│   │   │   ├── suppliers/
│   │   │   ├── centers/
│   │   │   ├── groups/
│   │   │   ├── warehouses/
│   │   │   ├── conventions/       [Remises commerciales]
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── stats/
│   │   │   ├── notifications/
│   │   │   ├── imports/
│   │   │   ├── uploads/
│   │   │   └── [+ autres...]
│   │   ├── prisma/                [Prisma ORM + migrations]
│   │   ├── shared/                [Utilitaires communs]
│   │   ├── common/                [Guards, Interceptors, Pipes]
│   │   └── main.ts
│   ├── prisma/
│   │   └── schema.prisma          [Schéma DB complet]
│   └── package.json
│
├── frontend/
│   ├── src/app/
│   │   ├── features/              [18 modules UI]
│   │   │   ├── dashboard/
│   │   │   ├── client-management/
│   │   │   ├── commercial/
│   │   │   ├── finance/
│   │   │   ├── stock-management/
│   │   │   ├── measurement/       [Prescriptions optiques]
│   │   │   ├── personnel-management/
│   │   │   ├── accounting/
│   │   │   ├── reports/
│   │   │   ├── settings/
│   │   │   ├── authentication/
│   │   │   ├── user-management/
│   │   │   ├── warehouses/
│   │   │   ├── groups/
│   │   │   ├── advanced-search/
│   │   │   ├── online-payments/
│   │   │   ├── agenda/
│   │   │   └── error-page/
│   │   ├── shared/                [Composants réutilisables]
│   │   └── app.module.ts
│   └── package.json
│
└── docker-compose.yml
```

### Modèle de Déploiement

```
ENVIRONNEMENTS
├── Development (local)
│   └── docker-compose.yml (auto-reload, logs verbeux)
├── Staging
│   └── docker-compose.staging.yml (DB identique prod)
└── Production
    └── docker-compose.prod.yml (backups, monitoring)

SCALING
├── Multi-containers (backend replicas)
├── Load balancer (Nginx)
├── Database pooling (pgBouncer)
└── Static CDN (Frontend assets)
```

---

## 3. MODÈLE DE DONNÉES

### Entités Core (24 modèles Prisma)

#### 🏢 CENTRE
**Responsabilité**: Succursale optique (point de vente)
```
Centre {
  id: UUID
  nomCentre: String!
  groupe: Groupe (M-1)
  adresse: String
  telephone: String
  email: String
  responsable: User?
  caisses: Caisse[] (1-N)
  entrepots: Entrepot[] (1-N)
  clients: Client[] (1-N)              [Affectation]
  employeCentres: EmployeeCentre[] (1-N)
  commissionRules: CommissionRule[] (1-N)
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### 👤 CLIENT
**Responsabilité**: Personne physique/morale client
```
Client {
  id: UUID
  centreId: UUID! (M-1)
  nomComplet: String!
  telephone: String
  email: String
  adresse: String
  type: PARTICULIER | PROFESSIONNEL
  convention: Convention? (M-1)       [Remise appliquée]
  pointsActuels: Int = 0               [Solde fidélité]
  parrainId: UUID?                     [Client qui parrainne]
  filleuls: Client[] (reverse)
  fiches: Fiche[] (1-N)
  factures: Facture[] (1-N)
  paiements: Paiement[] (1-N)
  pointsHistory: PointsHistory[] (1-N)
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### 📋 FICHE
**Responsabilité**: Dossier optique client (lunettes/lentilles/mixte)
```
Fiche {
  id: UUID
  clientId: UUID! (M-1)
  centreId: UUID!
  type: MONTURE | LENTILLES | MIXTE
  statut: CREATION | COMMANDE | LIVREE | FACTUREE
  prescription: {
    oeilDroit: { sphère, cylindre, axe, addition, prisme }
    oeilGauche: { sphère, cylindre, axe, addition, prisme }
    distancePupillaire: Float
    dateExamen: DateTime
  }
  products: String[]                   [IDs produits choisis]
  facture: Facture? (1-1)             [Facture liée]
  bonLivraisonFournisseur: BonLivraison[] (1-N)
  notes: String
  dateCommande: DateTime?
  dateLivraison: DateTime?
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### 💰 FACTURE
**Responsabilité**: Document commercial (Devis, BC, Facture, Avoir)
```
Facture {
  id: UUID
  numero: String! (unique)             [DV/BC/FAC/AV + séquence]
  type: DEVIS | BL | FACTURE | AVOIR | BON_COMMANDE
  statut: DEVIS_EN_COURS | VALIDEE | PAYEE | PARTIELLE | SOLDEE | ANNULEE
  clientId: UUID! (M-1)
  ficheId: UUID? (M-1)
  centreId: UUID! (M-1)
  vendeurId: UUID? (M-1 → Employee)
  lignes: {
    productId: UUID
    quantite: Int
    prixUnitaire: Float
    tauxTVA: Float = 20
    totalHT: Float
    totalTTC: Float
  }[]
  totalHT: Float
  totalTVA: Float
  totalTTC: Float
  resteAPayer: Float                   [= totalTTC - paiementsRecus]
  remiseAppliquee: Float = 0           [Convention + Points]
  paiements: Paiement[] (1-N)
  mouvementsStock: MouvementStock[] (1-N)
  commissions: Commission[] (1-N)
  operationsCaisse: OperationCaisse[] (1-N)
  pointsHistory: PointsHistory[] (1-N)
  parent: Facture? (M-1)               [Facture d'origine si AVOIR]
  avoirs: Facture[] (1-N)              [Avoirs générés]
  dateEmission: DateTime
  dateEcheance: DateTime
  createdBy: UUID
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### 💳 PAIEMENT
**Responsabilité**: Encaissement client
```
Paiement {
  id: UUID
  factureId: UUID! (M-1)
  montant: Float!                      [Positif: paiement, Négatif: remboursement]
  mode: ESPECES | CARTE | CHEQUE | VIREMENT | LCN
  referencePaiement: String?           [N° chèque, N° transaction]
  dateValeur: DateTime                 [Date d'encaissement réelle]
  operationCaisse: OperationCaisse? (1-1)
  utilisateur: User (M-1)
  createdAt: DateTime
}
```

#### 📦 PRODUCT
**Responsabilité**: Article du catalogue
```
Product {
  id: UUID
  code: String! (unique)
  nom: String!
  type: MONTURE | VERRE | LENTILLE | ACCESSOIRE | SERVICE
  prixAchat: Float!
  prixVente: Float!
  description: String
  image: String?
  stock: {
    entrepot: Entrepot
    quantiteActuelle: Int
    quantiteMinimale: Int
  }[]
  mouvementsStock: MouvementStock[] (1-N)
  parametresVerres: GlassParameters? (1-1)
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### 🚚 MOUVEMENT_STOCK
**Responsabilité**: Trace mouvement produit (entrée/sortie/transfert)
```
MouvementStock {
  id: UUID
  type: ENTREE | SORTIE | TRANSFERT | RETOUR | CONFECTION | AJUSTEMENT
  productId: UUID! (M-1)
  entrepotSource: Entrepot? (M-1)
  entrepotDest: Entrepot? (M-1)
  quantite: Int!
  factureId: UUID? (M-1)               [Si sortie vente]
  bonLivraison: BonLivraison? (M-1)   [Si entrée fournisseur]
  utilisateur: User (M-1)
  raison: String                       [Justification si ajustement]
  dateOperation: DateTime
  createdAt: DateTime
}
```

#### 👨‍💼 EMPLOYEE
**Responsabilité**: Salarié/prestataire
```
Employee {
  id: UUID
  userId: UUID! (1-1 → User)
  nomComplet: String!
  fonction: VENDEUR | CAISSIER | OPTICIEN | MANAGER
  salaireBase: Float
  tauxCommission: Float? (%)
  centres: EmployeeCentre[] (1-N)    [Affectations multi-centre]
  factures: Facture[] (1-N)          [Factures vendues]
  commissions: Commission[] (1-N)
  payrolls: Payroll[] (1-N)          [Bulletins paie]
  attendances: Attendance[] (1-N)
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### 💼 COMMISSION
**Responsabilité**: Calcul commission vendeur
```
Commission {
  id: UUID
  employeeId: UUID! (M-1)
  factureId: UUID! (M-1)
  periode: String! (YYYY-MM)
  typeArticle: MONTURE | VERRE | LENTILLE | ACCESSOIRE | SERVICE
  tauxCommission: Float (%)
  montantCalcule: Float
  statut: CALCULEE | VALIDEE | PAYEE
  payroll: Payroll? (M-1)
  createdAt: DateTime
}
```

#### 📊 PAYROLL
**Responsabilité**: Bulletin de paie mensuel
```
Payroll {
  id: UUID
  employeeId: UUID! (M-1)
  periode: String! (YYYY-MM)
  salaireBase: Float
  commissions: Commission[] (1-N)
  heuresSupp: {
    nombre: Float
    tauxHoraire: Float
    montant: Float
  }
  primes: Float = 0
  retenues: Float = 0                  [Cotisations, etc.]
  montantNet: Float                    [Calculé: base + comm + heuresSup + primes - retenues]
  depense: Depense (1-1)              [Enregistrement comptable]
  statut: PROJET | VALIDEE | PAYEE
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### 💵 DEPENSE
**Responsabilité**: Dépense opérationnelle
```
Depense {
  id: UUID
  centreId: UUID! (M-1)
  type: ACHAT | SALAIRE | LOYER | UTILITAIRES | AUTRE
  montant: Float!
  description: String
  fournisseur: Fournisseur? (M-1)
  factureFournisseur: FactureFournisseur? (1-1)
  echeancesPaiement: EcheancePaiement[] (1-N)
  payroll: Payroll? (1-1)             [Si SALAIRE]
  utilisateur: User (M-1)
  dateDepense: DateTime
  createdAt: DateTime
}
```

#### 🛒 BON_LIVRAISON
**Responsabilité**: Réception fournisseur
```
BonLivraison {
  id: UUID
  numero: String! (unique)
  fournisseurId: UUID! (M-1)
  centreId: UUID! (M-1)
  ficheId: UUID? (M-1)                [Lien client optionnel]
  mouvementsStock: MouvementStock[] (1-N)
  factureFournisseur: FactureFournisseur? (1-1)
  echeancesPaiement: EcheancePaiement[] (1-N)
  statut: RECEPTIONNE | FACTURE | PAYEE
  dateReception: DateTime
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### 📄 FACTURE_FOURNISSEUR
**Responsabilité**: Facture d'achat fournisseur
```
FactureFournisseur {
  id: UUID
  numero: String! (unique)
  fournisseurId: UUID! (M-1)
  bonLivraison: BonLivraison (M-1)
  montantHT: Float
  montantTVA: Float
  montantTTC: Float
  echeancesPaiement: EcheancePaiement[] (1-N)
  depense: Depense? (1-1)
  statut: RECEPTIONNE | FACTURE | PARTIELLE | PAYEE
  dateFacture: DateTime
  createdAt: DateTime
}
```

#### ⏰ JOURNEE_CAISSE
**Responsabilité**: Caisse quotidienne
```
JourneeCaisse {
  id: UUID
  caisseId: UUID! (M-1)
  centreId: UUID! (M-1)
  caissier: User
  dateJournee: Date
  fondInitial: Float
  operationsCaisse: OperationCaisse[] (1-N)
  demandesAlimentation: DemandeAlimentation[] (1-N)
  statut: OUVERTE | FERMEE
  
  soldeTheorique: Float               [= fondInitial + Σ(recettes) - Σ(décaissements)]
  soldeReel: Float                    [Comptage réel caissier]
  ecart: Float                        [soldeReel - soldeTheorique]
  justificationEcart: String?
  
  closureTime: DateTime?
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### 💸 OPERATION_CAISSE
**Responsabilité**: Transaction caisse quotidienne
```
OperationCaisse {
  id: UUID
  journeeCaisse: JourneeCaisse (M-1)
  paiements: Paiement[] (1-N)
  type: RECETTE | DECAISSEMENT
  mode: ESPECES | CARTE | CHEQUE
  montant: Float
  factureId: UUID? (M-1)              [Lien vente optionnel]
  description: String
  dateOperation: DateTime              [Peut être antérieure si chèque]
  createdAt: DateTime
}
```

#### 🎁 POINTS_HISTORY
**Responsabilité**: Historique points fidélité
```
PointsHistory {
  id: UUID
  clientId: UUID! (M-1)
  type: ACHAT | NOUVEAU_CLIENT | PARRAINAGE | CREATION_FICHE | REDEMPTION
  montant: Int                         [Points gagnés/perdus]
  raison: String                       [Description détaillée]
  factureId: UUID? (M-1)
  soldeApres: Int                      [Points après opération]
  createdAt: DateTime
}
```

#### 🤝 CONVENTION
**Responsabilité**: Remise commerciale appliquée
```
Convention {
  id: UUID
  nomConvention: String!
  tauxRemise: Float (%)
  clients: Client[] (1-N)             [Clients éligibles]
  validityStart: DateTime
  validityEnd: DateTime?
  createdAt: DateTime
}
```

#### 🏪 ENTREPOT
**Responsabilité**: Warehouse/stock
```
Entrepot {
  id: UUID
  centreId: UUID! (M-1)
  nom: String!
  adresse: String
  type: PRINCIPAL | SECONDAIRE | TRANSIT
  createdAt: DateTime
}
```

#### 🏢 GROUPE
**Responsabilité**: Groupe optique (holding)
```
Groupe {
  id: UUID
  nom: String!
  centres: Centre[] (1-N)
  createdAt: DateTime
}
```

#### 👤 USER
**Responsabilité**: Authentification système
```
User {
  id: UUID
  email: String! (unique)
  nomUtilisateur: String!
  motDePasse: String (hashed)
  statut: ACTIF | SUSPENDU | DESACTIVE
  derniereConnexion: DateTime?
  employee: Employee? (1-1)
  centresAffectes: UserCentreRole[] (1-N)
  factures: Facture[] (1-N)           [Créateur]
  operationsCaisse: OperationCaisse[] (1-N)
  createdAt: DateTime
  updatedAt: DateTime
}
```

#### 🔐 USER_CENTRE_ROLE
**Responsabilité**: Permissions par centre
```
UserCentreRole {
  id: UUID
  userId: UUID! (M-1)
  centreId: UUID! (M-1)
  roles: ADMIN | MANAGER | VENDEUR | CAISSIER | VIEWER
  permissionsSpecifiques: {
    peutValiderFactures: Boolean
    peutModifierPrix: Boolean
    peutVoirComptabilite: Boolean
    peutGererEmployes: Boolean
  }
  createdAt: DateTime
}
```

#### 🔍 Autres Entités Supportées
- `Caisse` - Configuration points de vente
- `Fournisseur` - Répertoire suppliers
- `EcheancePaiement` - Gestion dettes fournisseur
- `DemandeAlimentation` - Demandes funding caisse
- `Attendance` - Pointage employés
- `CommissionRule` - Règles commissions par poste/article
- `GlassParameters` - Spécifications optiques produits
- `Supplier-Invoices` - Factures achats
- `Sales-Control` - Validation ventes
- `Notifications` - Templates emails/SMS
- `Settings` - Configuration générale

---

## 4. MODULES & FEATURES

### Backend (32 modules)

#### A. GESTION COMMERCIALE (7 modules)

**1. factures** - Gestion documents commerciaux
- 🔹 **Endpoints**: GET/POST/PUT /factures, /factures/:id/validate, /factures/:id/pdf
- 🔹 **Responsabilité**: CRUD Devis/BC/Factures/Avoirs + transition états + numérotation
- 🔹 **Validations**: Stock check, Montant cohérent, TVA 0-20%
- 🔹 **Workflows**: DEVIS_EN_COURS → VALIDEE → PAYEE/PARTIELLE → SOLDEE
- 🔹 **Intégrations**: Loyalty (points), Stock (mouvements), Caisse (operations)

**2. fiches** - Dossiers optiques clients
- 🔹 **Endpoints**: GET/POST/PUT /fiches, /fiches/:id/prescription, /fiches/:id/facture
- 🔹 **Responsabilité**: CRUD fiches + prescription optiques + conversion facture
- 🔹 **Validations**: Données optiques valides (sphère, cylindre, axe)
- 🔹 **Workflows**: CREATION → COMMANDE → LIVREE → FACTUREE
- 🔹 **Intégrations**: Clients, Factures, BonLivraison

**3. clients** - Gestion base clients
- 🔹 **Endpoints**: GET/POST/PUT /clients, /clients/:id/fiches, /clients/:id/factures
- 🔹 **Responsabilité**: CRUD clients + history + points fidélité
- 🔹 **Validations**: Email unique, téléphone format
- 🔹 **Attributes**: type (PARTICULIER/PROFESSIONNEL), convention, parrainage
- 🔹 **Intégrations**: Fiches, Factures, Loyalty

**4. paiements** - Encaissements clients
- 🔹 **Endpoints**: GET/POST /paiements, /paiements/:id/pdf
- 🔹 **Responsabilité**: Enregistrement paiements + modes variés
- 🔹 **Modes**: ESPECES, CARTE, CHEQUE, VIREMENT, LCN
- 🔹 **Validations**: Montant ≤ resteAPayer, Mode cohérent
- 🔹 **Auto-triggers**: OperationCaisse créée + Points fidélité + Commission si complet

**5. loyalty** - Points fidélité Choukra
- 🔹 **Endpoints**: GET/POST /loyalty/points, /loyalty/redeem, /loyalty/referral
- 🔹 **Responsabilité**: Calcul points + redemption + parrainage
- 🔹 **Règles**: +0.1pts/DH, +20 nouveau client, +50 parrain/+20 parrainé, +30 fiche
- 🔹 **Redemption**: Seuil min 500pts, 10pts = 1DH remise
- 🔹 **Audit**: PointsHistory tracée complètement

**6. stock-movements** - Mouvements stock
- 🔹 **Endpoints**: GET/POST /stock-movements, /stock-movements/:id/transfer
- 🔹 **Responsabilité**: Trace ENTREE/SORTIE/TRANSFERT/RETOUR/CONFECTION/AJUSTEMENT
- 🔹 **Validations**: Quantité disponible, Entrepôt existe
- 🔹 **Auto-linkage**: Facture (SORTIE) / BonLivraison (ENTREE)
- 🔹 **Intégrations**: Products (quantiteActuelle), Factures, BonLivraison

**7. products** - Catalogue produits
- 🔹 **Endpoints**: GET/POST/PUT /products, /products/:id/stock, /products/search
- 🔹 **Responsabilité**: CRUD catalogue + stock par entrepôt
- 🔹 **Types**: MONTURE, VERRE, LENTILLE, ACCESSOIRE, SERVICE
- 🔹 **Stock**: Quantité actuelle, minimale, alertes bas
- 🔹 **Intégrations**: MouvementStock, GlassParameters, Entrepots

---

#### B. GESTION CAISSE & TRÉSORERIE (4 modules)

**8. caisse** - Configuration points de vente
- 🔹 **Endpoints**: GET/POST/PUT /caisse
- 🔹 **Responsabilité**: Config caisses par centre
- 🔹 **Attributes**: numPdV, nomPdV, devise, responsable

**9. journee-caisse** - Caisse quotidienne
- 🔹 **Endpoints**: GET/POST /journee-caisse, /journee-caisse/:id/close
- 🔹 **Responsabilité**: Ouverture/clôture + rapprochement jour
- 🔹 **Workflows**: OUVERTE → FERMEE (avec solde théorique vs réel)
- 🔹 **Rapprochement**: Fond + recettes - décaissements = solde théorique
- 🔹 **Écart**: Justification requise si > 0.01 DH

**10. operation-caisse** - Mouvements caisse
- 🔹 **Endpoints**: GET /operation-caisse (read-only, créé par paiement)
- 🔹 **Responsabilité**: Transactions quotidiennes créées automatiquement
- 🔹 **Types**: RECETTE (paiement) / DECAISSEMENT (remboursement)
- 🔹 **Séparation**: Espèces, Cartes, Chèques, Virements

**11. treasury** - Trésorerie analytique
- 🔹 **Endpoints**: GET /treasury/balance, /treasury/flows, /treasury/forecast
- 🔹 **Responsabilité**: Analyses trésorerie (cash flow, projections)
- 🔹 **KPIs**: Solde caisse, entrées/sorties périodiques, tendances

---

#### C. GESTION PAIE & PERSONNEL (4 modules)

**12. personnel** - Gestion employees + commissions
- 🔹 **Endpoints**: GET/POST/PUT /employees, /employees/:id/commission-rules
- 🔹 **Responsabilité**: CRUD employés + commissions + paie
- 🔹 **Attributes**: Fonction, salaire base, tauxCommission
- 🔹 **Affectations**: Multi-centre possible
- 🔹 **Intégrations**: Commission (calcul), Payroll (bulletins)

**13. commission** - Calcul commissions vendeurs
- 🔹 **Endpoints**: GET /commission (read-only, calculée auto)
- 🔹 **Responsabilité**: Calcul automatique par facture + type article
- 🔹 **Trigger**: Facture VALIDEE + PAYEE
- 🔹 **Règles**: Par poste × type article × taux %
- 🔹 **Période**: Mensuelle YYYY-MM

**14. expenses** - Dépenses opérationnelles
- 🔹 **Endpoints**: GET/POST /expenses, /expenses/:id/approve
- 🔹 **Responsabilité**: Saisie dépenses (achats, loyers, salaires, etc.)
- 🔹 **Types**: ACHAT, SALAIRE, LOYER, UTILITAIRES, AUTRE
- 🔹 **Validation**: Montant cohérent, Fournisseur si achat

**15. payroll** - Bulletins de paie
- 🔹 **Endpoints**: GET/POST /payroll, /payroll/:id/pdf
- 🔹 **Responsabilité**: Génération bulletins mensuels
- 🔹 **Calcul**: Base + commissions + heures supp + primes - retenues = Net
- 🔹 **PDF**: Document officiel généré
- 🔹 **Enregistrement**: Créé comme Depense (comptabilité)

---

#### D. GESTION FOURNISSEURS (3 modules)

**16. suppliers** - Répertoire fournisseurs
- 🔹 **Endpoints**: GET/POST/PUT /suppliers
- 🔹 **Responsabilité**: CRUD fournisseurs + contacts
- 🔹 **Attributes**: Nom, adresse, tel, email, conditions paiement

**17. bon-livraison** - Réceptions fournisseurs
- 🔹 **Endpoints**: GET/POST /bon-livraison, /bon-livraison/:id/receive
- 🔹 **Responsabilité**: Réception marchandise + mouvements stock
- 🔹 **Workflows**: RECEPTIONNE → FACTURE → PAYEE
- 🔹 **Auto-trigger**: MouvementStock ENTREE créé + stock augmente
- 🔹 **Lien**: Optionnel à Fiche (si client spécifique)

**18. supplier-invoices** - Factures d'achat fournisseurs
- 🔹 **Endpoints**: GET/POST /supplier-invoices
- 🔹 **Responsabilité**: Suivi factures achats + écheances paiement
- 🔹 **Workflows**: RECEPTIONNE → FACTURE → PAYEE
- 🔹 **Lien**: À BonLivraison + EcheancesPaiement

---

#### E. GESTION MULTI-CENTRES (3 modules)

**19. centers** - Gestion centres optiques
- 🔹 **Endpoints**: GET/POST/PUT /centers
- 🔹 **Responsabilité**: Config centres (succursales)
- 🔹 **Relations**: Centre ← Groupe + Entrepots + Caisses + Employés
- 🔹 **Isolation**: Données strictement par centreId

**20. groups** - Groupes optiques
- 🔹 **Endpoints**: GET/POST/PUT /groups
- 🔹 **Responsabilité**: Gestion groupes (holding)
- 🔹 **Relation**: Groupe → Centre[] (1-N)

**21. warehouses** - Gestion entrepôts
- 🔹 **Endpoints**: GET/POST/PUT /warehouses, /warehouses/:id/stock
- 🔹 **Responsabilité**: Config entrepôts + stock par produit
- 🔹 **Types**: PRINCIPAL, SECONDAIRE, TRANSIT
- 🔹 **Stock**: Quantité actuelle par produit

---

#### F. GESTION ADMINISTRATIVE (5 modules)

**22. accounting** - Exports comptables
- 🔹 **Endpoints**: GET /accounting/export/sage, /accounting/export/tva
- 🔹 **Responsabilité**: Exports normes marocaines
- 🔹 **Format**: Sage comptable (Date | Compte | Libellé | Débit | Crédit)
- 🔹 **Filtres**: Factures VALIDEE + PAYEE + exportComptable=true
- 🔹 **Comptes**: 3421 (clients), 4455 (TVA collectée), 6024 (achats), etc.

**23. conventions** - Remises commerciales
- 🔹 **Endpoints**: GET/POST/PUT /conventions
- 🔹 **Responsabilité**: Création conventions + application clients
- 🔹 **Application**: Remise appliquée facture (montant facture × taux %)
- 🔹 **Validité**: Dates début/fin

**24. auth** - Authentification
- 🔹 **Endpoints**: POST /auth/login, /auth/logout, /auth/refresh
- 🔹 **Responsabilité**: JWT token, refresh tokens, MDP change
- 🔹 **Token**: Payload { userId, centreIds, roles }
- 🔹 **MDP**: Hash bcrypt, exigence change première connexion

**25. users** - Gestion utilisateurs
- 🔹 **Endpoints**: GET/POST/PUT /users, /users/:id/permissions
- 🔹 **Responsabilité**: CRUD utilisateurs + rôles par centre
- 🔹 **Rôles**: ADMIN, MANAGER, VENDEUR, CAISSIER, VIEWER
- 🔹 **Isolation**: Multi-centre avec permissions granulaires

**26. stats** - KPIs & Rapports
- 🔹 **Endpoints**: GET /stats/ca, /stats/loyalty, /stats/stock, /stats/payroll
- 🔹 **Responsabilité**: Agrégations analytiques
- 🔹 **KPIs**: CA mensuel, points générés, rotations stock, masse salariale

---

#### G. SUPPORT & UTILITAIRES (6 modules)

**27. notifications** - Emails & PDFs
- 🔹 **Endpoints**: GET/POST /notifications/send, /notifications/templates
- 🔹 **Responsabilité**: Génération PDFs (factures, bulletins, rapports) + envoi emails
- 🔹 **Templates**: Devis, Factures, Avoirs, Bulletins de paie
- 🔹 **Intégrations**: SendGrid/SMTP pour emails

**28. imports** - Import données massives
- 🔹 **Endpoints**: POST /imports/clients, /imports/products, /imports/historique
- 🔹 **Responsabilité**: Imports CSV/Excel de données existantes
- 🔹 **Validation**: Clés étrangères, doublons, formats

**29. uploads** - Gestion fichiers
- 🔹 **Endpoints**: POST /uploads/images, GET /uploads/:fileId
- 🔹 **Responsabilité**: Upload produits (images), documents (PDFs)
- 🔹 **Stockage**: MinIO (production) avec fallback local automtique en cas d'erreur
- 🔹 **Robustesse**: Error handling amélioré + fallback local transparent si MinIO indisponible

**30. company-settings** - Configuration générale
- 🔹 **Endpoints**: GET/PUT /settings
- 🔹 **Responsabilité**: Paramétrages système (TVA, devise, année fiscale, etc.)
- 🔹 **Scope**: Global ou par centre

**31. sales-control** - Validation ventes
- 🔹 **Endpoints**: GET/POST /sales-control/validate
- 🔹 **Responsabilité**: Checks règles avant autorisation (stock, prix, permissions)
- 🔹 **Validations**: Stock suffisant, prix cohérent, user autorisé

**32. funding-requests** - Demandes alimentation caisse
- 🔹 **Endpoints**: GET/POST /funding-requests, /funding-requests/:id/approve
- 🔹 **Responsabilité**: Demandes remontée caisse (trésorier ↔ caissier)

---

### Frontend (18 modules)

#### 🎯 Navigation (3 modules)

**1. dashboard** - Accueil KPIs
- 📊 **Écrans**: Tableau de bord avec graphiques CA, Stock, Paiements
- 📊 **Widgets**: CA mensuel, Top vendeurs, Stock bas, Factures impayées
- 📊 **Droits**: Lecture pour tous

**2. authentication** - Login/Logout
- 📊 **Écrans**: Login form, Password reset, MDP change première connexion
- 📊 **Validations**: Email obligatoire, MDP minimum 8 chars
- 📊 **Workflow**: Login → Store token → Redirect dashboard

**3. settings** - Configuration générale
- 📊 **Écrans**: Paramètres TVA, devise, années fiscales, notifications
- 📊 **Droits**: Admin seulement

---

#### 💼 Gestion Commerciale (5 modules)

**4. client-management** - Gestion clients & fiches
- 📊 **Écrans**: 
  - Liste clients (table, filtres, recherche)
  - Fiche client détail (données + historique factures)
  - Crée/Modifie client (form)
  - Créer fiche optique (prescription)
  - Sélectionner produits monture/verres/lentilles
- 📊 **Workflows**: Client → Fiche → Produits → Devis
- 📊 **Validations**: Email unique, telephone format

**5. commercial** - Fiches & Devis
- 📊 **Écrans**:
  - Lister fiches par statut (CREATION, COMMANDE, LIVREE, FACTUREE)
  - Détail fiche (prescription, produits, statut)
  - Créer devis (auto-calc prix + TVA)
  - Modifier devis (avant validation)
  - Valider devis → Stock check → Facture
- 📊 **Auto-calcs**: totalHT, TVA (20%), totalTTC, remise convention, remise points

**6. finance** - Factures & Paiements
- 📊 **Écrans**:
  - Lister factures (filtrer type, statut, date)
  - Voir détail facture + PDF
  - Enregistrer paiement (mode, montant, référence)
  - Voir paiements reçus sur facture
  - Reste à payer actualisé
  - Générer avoir (retour)
- 📊 **Validations**: Montant paiement ≤ reste à payer

**7. stock-management** - Gestion stocks
- 📊 **Écrans**:
  - Liste produits (filtrer type, stock bas)
  - Stock par entrepôt
  - Mouvements historiques (filtrer type)
  - Créer transfert entrepôt (source → dest)
  - Créer ajustement (raison)
  - Alertes stock bas configurables
- 📊 **Dashboard**: Total valeur stock, rotations

**8. measurement** - Prescriptions optiques
- 📊 **Écrans**:
  - Form prescription complète (sphère, cylindre, axe, addition, prisme)
  - Validation données optiques
  - Sauvegarde auto
  - Affichage oeil droit/gauche séparés
  - Distance pupillaire

---

#### 👥 Gestion Paie (2 modules)

**9. personnel-management** - Employés & Paie
- 📊 **Écrans**:
  - Lister employés (par centre, filtre fonction)
  - Créer/Modifier employé
  - Affectations multi-centre
  - Historique commissions (monthly table)
  - Bulletins paie (lister, voir PDF)
  - Masse salariale tendance
- 📊 **Droits**: Manager+ seulement

**10. accounting** - Comptabilité
- 📊 **Écrans**:
  - Export Sage (date range, filtre documents)
  - Export TVA (collectée vs déductible)
  - Dépenses (liste, créer, filtrer type)
  - Validation dépenses
- 📊 **Droits**: Comptable/Admin

---

#### 📊 Rapports & Analyses (3 modules)

**11. reports** - Rapports analytiques
- 📊 **Écrans**:
  - Rapport CA (mensuel, par vendeur, par centre, par produit)
  - Rapport Stock (rotation, valeur, alertes)
  - Rapport Fidélité (points générés, utilisés, parrainages)
  - Rapport Paiements (impayés, retards, modes)
  - Tendances (graphiques périodes)
- 📊 **Exports**: PDF, Excel

**12. advanced-search** - Recherche multi-critères
- 📊 **Écrans**: Formulaire recherche avancée (combinaisons filtres)
- 📊 **Cross-domain**: Clients, factures, fiches, produits, employés

**13. agenda** - Calendrier RDVs
- 📊 **Écrans**: Agenda visuel RDVs clients (optionnel)

---

#### 🏢 Gestion Administrative (5 modules)

**14. user-management** - Gestion utilisateurs
- 📊 **Écrans**:
  - Lister utilisateurs
  - Créer/Modifier (email, nom, fonction)
  - Affectations centres
  - Permissions par centre (rôles)
- 📊 **Droits**: Admin seulement

**15. warehouses** - Entrepôts
- 📊 **Écrans**:
  - Lister entrepôts (par centre)
  - Stock par entrepôt
  - Transferts inter-entrepôts
- 📊 **Droits**: Manager+ par centre

**16. groups** - Groupes & Centres
- 📊 **Écrans**:
  - Arborescence Groupe → Centres
  - Config centre (adresse, tel, caissier)
- 📊 **Droits**: Admin

**17. online-payments** - Paiements en ligne (optionnel)
- 📊 **Écrans**: 
  - Intégration passerelle (TMoney, Maroc Telecom, etc.)
  - Status paiements en ligne
  - Notifications webhook

**18. error-page** - Gestion erreurs
- 📊 **Écrans**: Pages 404, 500, access denied (UX)

---

## 5. RÈGLES MÉTIER DÉTAILLÉES

### 5.1 Gestion Factures

#### Numérotation (Règle Critique)
```
Format: PRÉFIXE + SÉQUENCE
  DEVIS         → DV 000001, DV 000002, ...
  BON_COMMANDE  → BC 000001, BC 000002, ...
  FACTURE       → FAC 000001, FAC 000002, ...
  AVOIR         → AV 000001, AV 000002, ...
  BON_LIVRAISON → BL 000001, BL 000002, ...

Unicité: Globale (pas de duplication tolérance zéro)
Génération: Atomique transactionnelle (pas de gap)
Réinitialisation: Annuellement (optionnel)
```

#### États (State Machine)
```
DEVIS:
  DEVIS_EN_COURS → (validation) → VALIDEE → (paiement) → PAYEE/PARTIELLE → (paiement complet) → SOLDEE
                                     ↓
                              (paiement client) ↓
                                   PAYEE → SOLDEE → ANNULEE (retroactivement possible)

FACTURE:
  Immédiatement → VALIDEE → (paiement) → PAYEE/PARTIELLE → SOLDEE

AVOIR (facture retour):
  Lié à facture parent → VALIDEE → PAYEE (négatif)

Transitions Interdites:
  ✗ PAYEE ↔ VALIDEE (sauf via note de crédit)
  ✗ SOLDEE ↔ n'importe quoi
  ✗ ANNULEE ↔ n'importe quoi
```

#### Calcul Montants
```
Pour chaque ligne:
  totalHT = quantité × prixUnitaire
  totalTVA = totalHT × tauxTVA (defaut 20%)
  totalTTC = totalHT + totalTVA

Facture entière:
  totalHT = Σ(totalHT par ligne)
  totalTVA = Σ(totalTVA par ligne)
  totalTTC = totalHT + totalTVA
  
  remiseAppliquee = max(
    totalTTC × convention.tauxRemise,
    pointsUtilises / 10  (10 points = 1 DH)
  )
  
  montantFinal = totalTTC - remiseAppliquee
  resteAPayer = montantFinal - paiementsRecus

Validation: 
  ✓ totalTTC > 0
  ✓ tauxTVA ∈ [0, 20]
  ✓ remiseAppliquee ≤ totalTTC
  ✓ prixUnitaire ≥ 0
```

#### Vérification Stock
```
Avant DEVIS → VALIDEE:
  Pour chaque produit de la facture:
    quantiteEnStock = Product.stock[warehouse].quantiteActuelle
    quantiteDemandee = somme quantités fiches
    
    SI quantiteEnStock < quantiteDemandee:
      → BLOQUE transition
      → Message: "Stock insuffisant pour {productName} (besoin {qty}, dispo {stock})"
      → Vendeur doit: Cder fournisseur OU changer produit OU attendre réception
```

#### Points de Fidélité (Attribués à Validation)
```
Trigger: Facture DEVIS → VALIDEE (+ paiement reçu)

Calcul:
  pointsGagnes = totalTTC * 0.1  [1 point par 10 DH]
  
  Bonus:
    + 20 si Client.createdAt < 30 jours (nouveau client)
    + 30 si Fiche.createdAt < 30 jours (création fiche)
    + 50 si Client.parrainId != null ET Fiche.type = MONTURE (parrainage)

Actions:
  1. PointsHistory { type: ACHAT, montant: pointsGagnes, factureId, ... }
  2. Client.pointsActuels += pointsGagnes

Limitation: Déjà acheté seulement (dévis complet impossible)
```

---

### 5.2 Gestion Stock & Mouvements

#### Types de Mouvements
```
ENTREE (Fournisseur)
  Déclencheur: BonLivraison reçu
  Impact: Product.stock[warehouse].quantiteActuelle += quantité
  Audit: Qui, Quand, Bon de livraison #

SORTIE (Vente client)
  Déclencheur: Facture PAYEE
  Impact: Product.stock[warehouse].quantiteActuelle -= quantité
  Audit: Qui, Quand, Facture #, Client

TRANSFERT (Inter-warehouse)
  Déclencheur: Manuel (dans module stock-management)
  Impact: 
    - Warehouse source: -= quantité
    - Warehouse dest: += quantité
  Audit: Qui, Quand, Raison

RETOUR (Client)
  Déclencheur: Avoir créé
  Impact: Product.stock[warehouse].quantiteActuelle += quantité
  Audit: Qui, Quand, Avoir #

CONFECTION (Fabrication locale)
  Déclencheur: Transformation (monture + verres → lunettes assemblées)
  Impact: Stock fin produit (+), Stock matières (-) [FUTURO]
  
AJUSTEMENT (Correction inventaire)
  Déclencheur: Inventaire physique
  Impact: Différence appliquée
  Audit: Qui, Quand, Raison justification (obligatoire si ±10%)
```

#### Alertes Stock
```
Alert Minimum:
  SI quantiteActuelle ≤ quantiteMinimale:
    → Notification acheteur (email)
    → Dashboard affiche (couleur rouge)
    → Vendeur bloqué DEVIS→VALIDEE si rupture

Alert Péremption:
  SI datePéremption < aujourd'hui + 90 jours:
    → Alerte stock "Péremption proche"
    → Non utilisable après datePéremption

Inventaire:
  Mensuel recommandé
  Audit compte physique vs système
  Ajustements tracés + justifiés
```

---

### 5.3 Points Fidélité Choukra

#### Acquisition
```
ACHAT PRODUIT:
  Règle: +0.1 points / DH dépensé (= 1 point / 10 DH)
  Trigger: Facture VALIDEE + PAYEE
  Exemple: Achat 500 DH → 50 points
  
NOUVEAU CLIENT:
  Règle: +20 points (one-time)
  Trigger: Première facture PAYEE
  Condition: Client.createdAt < 30 jours
  
CRÉATION DOSSIER:
  Règle: +30 points par fiche
  Trigger: Fiche créée
  Note: Premier contact optique récompensé
  
PARRAINAGE:
  Parraineur: +50 points (reçoit une fois par filleul qui achète)
  Parrainé: +20 points (reçoit à premier achat)
  Trigger: Client A parrainne Client B, puis B achète → A gagne 50
  Linkage: Client.parrainId = A.id (permanent)
  Network: Filleuls tracés Client.filleuls[]
```

#### Utilisation & Redemption
```
Seuil Minimum: 500 points requis
Taux Conversion: 10 points = 1 DH remise
Valeur Max: Remise ≤ 50% du totalTTC

Processus:
  1. Client exprime volonté utiliser points
  2. Validation: Client.pointsActuels ≥ 500
  3. Calcul: pointsAUtiliser * 1/10 = montantRemise
  4. Application: Facture.remiseAppliquee += montantRemise
  5. Déduction: Client.pointsActuels -= pointsAUtiliser
  6. Audit: PointsHistory { type: REDEMPTION, ... }

Tracking: PointsHistory complèt (ACHAT, REDEMPTION, BONUS)
```

#### Parrainage Réseau
```
Structure:
  Client A (parraineur)
    └─ Client B.parrainId = A.id (parrainé)
    └─ Client C.parrainId = A.id (parrainé #2)
    
Compensation:
  Quand B achète → A gagne 50 points (une fois)
  Quand C achète → A gagne 50 points (une fois)
  
  B et C gagnent chacun 20 points (primo-achat bonus)

Limitation: 1 parraineur par client (parrainId unique non-null)
Audit: Tous les mouvements points tracés PointsHistory

Dashboard Client:
  - Nombre filleuls
  - Points gagnés parrainage
  - Points totaux + historique
```

---

### 5.4 Commissions Vendeurs

#### Déclenchement
```
Condition: Facture VALIDEE + PAYEE

Calcul Périodique: Mensuel (YYYY-MM)

Timing: 
  - Facture payée en mars → Commission avril (période avril)
  - Consolidation fin mois
  - Intégrée bulletins paie (mois+1)
```

#### Calcul Montants
```
Par Facture (vendeur + type article):

Règle Standard (fallback):
  commissionGlobale = facturePayee.totalTTC * tauxCommissionVendeur% / 100
  
Règles Spécifiques (par CommissionRule):
  Pour chaque CommissionRule { poste, typeArticle, tauxCommission }:
    1. Récupérer CommissionRule matching { Employee.fonction, line.type }
    2. Si trouvée:
         commissionLigne = ligne.totalTTC * tauxCommission% / 100
    3. Si multiple matches:
         Appliquer la plus spécifique (typeArticle > global)
    4. Si aucune:
         Utiliser fallback global

Accumulation: Toutes commissions vendeur mois → Payroll.commissions
```

#### Types Articles Détectés
```
Automatiquement par ProductType:
  MONTURE     → Taux commission généralement 5-8%
  VERRE       → Taux commission généralement 2-3%
  LENTILLE    → Taux commission généralement 3-5%
  ACCESSOIRE  → Taux commission généralement 2%
  SERVICE     → Taux commission généralement 1%
```

#### Intégration Bulletins de Paie
```
Calcul Mensuel:
  montantNet = salaireBase 
             + Σ(commissions mois)
             + heuresSupp
             + primes
             - retenues

Exemple:
  Salaire base: 5000 DH
  Commissions: 1200 DH
  Heures supp: +300 DH
  Primes: +200 DH
  Retenues: -800 DH
  ───────────────────
  Montant net: 6900 DH

Génération:
  PDF bulletin (document officiel)
  Enregistrement Depense { type: SALAIRE, montant: 6900, ... }
  Intégration comptabilité
```

---

### 5.5 Gestion Caisse

#### Ouverture Journée
```
Actions:
  1. Caissier identifié (login)
  2. Caisse sélectionnée
  3. JourneeCaisse.statut = OUVERTE
  4. Fond initial renseigné (espèces en coffre)
  5. Horodatage: createdAt = datetime
  
Affichage:
  - Solde fond + toutes transactions jour
  - Comptage séparé par mode: Espèces, Cartes, Chèques
  - Recettes vs Décaissements
```

#### Transactions Jour (OperationCaisse)
```
Création Auto: 
  Chaque enregistrement Paiement crée OperationCaisse
  
Types de Transactions:
  RECETTE (paiement client reçu):
    Mode: ESPECES, CARTE, CHEQUE, VIREMENT
    Montant: positif
    Opération: +solde
    
  DECAISSEMENT (remboursement):
    Mode: ESPECES
    Montant: négatif
    Opération: -solde
    
Séparation Comptage:
  Espèces:
    - Nombre billets/pièces
    - Total montant
    - Séparation: 100 DH, 50 DH, 20 DH, 10 DH, 5 DH, 2 DH, 1 DH
    
  Cartes:
    - Nombre transactions
    - Montant total
    - Numéros PAN (lastFour)
    
  Chèques:
    - Nombre chèques
    - Montant total
    - Numéros chèques
```

#### Clôture & Rapprochement
```
Actions Clôture:
  1. Arrêter transactions jour (plus aucune entrée)
  2. Comptage caissier (réel physique)
  3. Calcul solde théorique:
       soldeTheorique = fondInitial 
                      + Σ(recettes)
                      - Σ(décaissements)
  4. Saisie solde réel (comptage caissier)
  5. Calcul écart:
       écart = soldeReel - soldeTheorique
  6. Justification si écart > 0.01 DH:
       - Raison: "Erreur comptage", "Billet détecté", etc.
       - Approbation responsable
  7. Validation clôture → JourneeCaisse.statut = FERMEE

Tolérances:
  ✓ Écart ≤ 0.01 DH: Auto-validé (arrondissement)
  ? Écart 0.01 < x ≤ 5 DH: Justification simple
  ✗ Écart > 5 DH: Escalade superviseur

Post-clôture:
  ✓ Prêt pour nouveau jour
  ✓ Rapport téléchargeable (PDF)
  ✓ Données immuables (audit trail)
```

---

### 5.6 Comptabilité & Exports

#### Export Sage (Mensuel)
```
Sélection Documents:
  - Factures VALIDEE + PAYEE
  - Bons de commande VALIDEE
  - Avoirs VALIDEE + PAYEE
  - Dépenses VALIDEE
  - Filtres: DateEmission ∈ [monthStart, monthEnd]
  - Condition: exportComptable = true (flag)

Format Sage Standard:
  DateLigneComptable | NumeroCompte | LibelleLigne | MontantDebit | MontantCredit
  
  Exemple:
  2026-03-15 | 3421 | Clients C001 | 1200.00 | 
  2026-03-15 | 4455 | TVA Facture FAC001 | | 200.00
  2026-03-15 | 7121 | Ventes de produits | | 1000.00

Plan Comptable Marocain:
  3421: Clients
  4455: TVA collectée
  6024: Achats de marchandises
  6031: Variation stock (pour fin période)
  7121: Ventes marchandises
  6125: Salaires
  6134: Cotisations sociales (salarié)
  4441: Cotisations sociales (patronal)
```

#### Calcul TVA
```
TVA Collectée (sur ventes):
  Σ(totalTVA toutes factures clients PAYEE)
  
TVA Déductible (sur achats):
  Σ(totalTVA toutes factures fournisseurs PAYEE)
  
TVA Nette à Payer:
  TVANette = TVACollectée - TVADéductible
  
Déclaration:
  Mensuelle (obligatoire)
  Délai: 15 jours après fin mois
  Modèle: Déclaration Contrôle Douanier (DCD)
  
Export Format:
  Même structure Sage
  Filtres: Taxe = 20% (taux standard Maroc)
```

---

## 6. FLUX PROCESSUS

### 6.1 Cycle Vente Complète (6 étapes)

```
┌──────────────────────────────────────────────────────────────────┐
│ ÉTAPE 1: CRÉATION CLIENT & DOSSIER OPTIQUE                       │
├──────────────────────────────────────────────────────────────────┤
│ Acteur: Vendeur                                                  │
│ Actions:                                                         │
│  1. Créer CLIENT (nom, tel, email, type PARTICULIER/PROF)       │
│  2. Créer FICHE (type MONTURE/LENTILLES/MIXTE)                 │
│  3. Saisir PRESCRIPTION (sphère, cylindre, axe, etc.)          │
│  4. Sauvegarder Fiche                                           │
│                                                                  │
│ Auto-triggers:                                                   │
│  ✅ +30 points fidélité (création fiche)                       │
│  ✅ Si Client nouveau (-30j): +20 points bonus                 │
│                                                                  │
│ Données créées:                                                  │
│  ✓ Client { id, nom, email, points=50, createdAt }            │
│  ✓ Fiche { id, clientId, type, prescription, statut=CREATION } │
│  ✓ PointsHistory { type=CREATION_FICHE, montant=30 }          │
└──────────────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────────┐
│ ÉTAPE 2: SÉLECTION PRODUITS & GÉNÉRATION DEVIS                   │
├──────────────────────────────────────────────────────────────────┤
│ Acteur: Vendeur                                                  │
│ Actions:                                                         │
│  1. Rechercher produits (montures, verres, lentilles)           │
│  2. Ajouter produits à Fiche (productId[], quantité)            │
│  3. Créer FACTURE (type=DEVIS, statut=DEVIS_EN_COURS)          │
│  4. Saisir lignes: product, quantité, prixUnitaire             │
│  5. Système calcule: HT, TVA (20%), TTC                         │
│  6. Appliquer Convention si applicable (taux remise%)           │
│  7. Afficher DEVIS: montant final, options paiement             │
│                                                                  │
│ Validations:                                                     │
│  ✓ Produits existent en base                                   │
│  ✓ Montants > 0                                                │
│  ✓ TVA ∈ [0%, 20%]                                             │
│                                                                  │
│ Données créées:                                                  │
│  ✓ Facture {                                                   │
│      numero='DV 000001',                                        │
│      type=DEVIS,                                               │
│      statut=DEVIS_EN_COURS,                                    │
│      clientId, ficheId,                                        │
│      totalHT=500, totalTVA=100, totalTTC=600                  │
│    }                                                            │
└──────────────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────────┐
│ ÉTAPE 3: VALIDATION DEVIS & ENCAISSEMENT INITIAL                 │
├──────────────────────────────────────────────────────────────────┤
│ Acteur: Client / Vendeur                                         │
│ Actions:                                                         │
│  1. Client accepte Devis (validation)                            │
│  2. Vendeur valide → FACTURE.statut = VALIDEE                  │
│  3. **VÉRIFICATION STOCK CRITIQUE**:                           │
│       SI stock insuffisant:                                    │
│         → Facture reste DEVIS_EN_COURS                         │
│         → Bloque transition + message erreur                   │
│         → Vendeur doit: Cder fournisseur OU attendre réception │
│       SI stock OK:                                             │
│         → Transition autorisée                                 │
│  4. Enregistrer PAIEMENT:                                       │
│       - Mode: ESPECES / CARTE / CHEQUE / VIREMENT              │
│       - Montant: Client peut payer partiel                      │
│       - Référence: N° chèque, N° transaction, etc.             │
│  5. SI paiement = totalTTC:                                    │
│       → Facture.statut = PAYEE                                 │
│  6. SI paiement < totalTTC:                                    │
│       → Facture.statut = PARTIELLE                             │
│       → resteAPayer = totalTTC - paiementRecus                 │
│                                                                  │
│ Auto-triggers (si PAYEE OU PARTIELLE):                          │
│  ✅ Facture.statut → PAYEE/PARTIELLE                          │
│  ✅ +0.1 pts/DH dépensé (exemple: 600 DH → 60 pts)            │
│  ✅ Commission vendeur calculée (si vendeur affecté)            │
│  ✅ MouvementStock SORTIE créé (quantité décrém.)             │
│  ✅ OperationCaisse créée (JourneeCaisse + transaction)        │
│  ✅ Fiche.statut → COMMANDE                                    │
│                                                                  │
│ Données créées/modifiées:                                        │
│  ✓ Facture { statut=PAYEE, resteAPayer=0 }                   │
│  ✓ Paiement { factureId, montant=600, mode=ESPECES }         │
│  ✓ PointsHistory { type=ACHAT, montant=60 }                  │
│  ✓ Commission { employeeId, factureId, montant=X }           │
│  ✓ MouvementStock { type=SORTIE, productId, quantite }       │
│  ✓ OperationCaisse { journeeCaisseId, montant=600 }          │
│  ✓ Fiche { statut=COMMANDE }                                 │
└──────────────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────────┐
│ ÉTAPE 4: BON DE COMMANDE FOURNISSEUR                             │
├──────────────────────────────────────────────────────────────────┤
│ Acteur: Acheteur/Manager                                         │
│ Actions:                                                         │
│  1. Analyser besoin (Fiche non livrée)                          │
│  2. Vérifier stock entrepôt (si monture/verres non stockés)     │
│  3. Créer BON_LIVRAISON fournisseur:                            │
│       - Sélectionner fournisseur                                │
│       - Ajouter articles besoin                                │
│       - Générer PDF technique + email fournisseur               │
│  4. État suivi: BON_COMMANDE créé                               │
│  5. Fiche.statut reste COMMANDE (en attente livraison)         │
│                                                                  │
│ Données créées:                                                  │
│  ✓ BonLivraison {                                              │
│      numero='BC 000001',                                        │
│      fournisseurId,                                            │
│      ficheId,                                                  │
│      statut=RECEPTIONNE,  (attente réception)                 │
│      createdAt                                                 │
│    }                                                            │
│  ✓ Email fournisseur avec PDF BC                              │
└──────────────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────────┐
│ ÉTAPE 5: RÉCEPTION & CONFECTION                                  │
├──────────────────────────────────────────────────────────────────┤
│ Acteur: Magasinier / Opticien                                    │
│ Actions:                                                         │
│  1. Fournisseur expédie marchandise                             │
│  2. Réception centre optique:                                   │
│       - Vérifier articles reçus vs BON                         │
│       - Créer MouvementStock ENTREE                            │
│       - MouvementStock.entrepot[warehouse].quantite += qty      │
│  3. Opticien commence confection:                              │
│       - Assemble monture + verres + lentilles                  │
│       - Crée MouvementStock CONFECTION (suivi optionnel)       │
│       - Teste produit fini                                     │
│  4. Produit fini prêt pour client                              │
│  5. Fiche.statut → LIVREE                                       │
│                                                                  │
│ Données créées/modifiées:                                        │
│  ✓ MouvementStock { type=ENTREE, productId, quantite }        │
│  ✓ MouvementStock { type=CONFECTION } (optionnel)             │
│  ✓ Fiche { statut=LIVREE }                                    │
│  ✓ BonLivraison { statut=FACTURE }                            │
└──────────────────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────────────────┐
│ ÉTAPE 6: LIVRAISON CLIENT & CLÔTURE DOSSIER                      │
├──────────────────────────────────────────────────────────────────┤
│ Acteur: Vendeur / Client                                         │
│ Actions:                                                         │
│  1. Client reprend lunettes finies                              │
│  2. Vendeur met à jour Fiche:                                   │
│       - Fiche.statut → FACTUREE                                 │
│       - Fiche.dateLivraison = today                            │
│  3. Émettre FACTURE FINALE (document physique)                  │
│       - Basée sur Fiche originelle                             │
│       - Même numérotation FAC 000001, FAC 000002, ...          │
│       - Statut → VALIDEE → PAYEE (normalement déjà payé)       │
│  4. Bonus parrainage (si applicable):                           │
│       SI Client.parrainId != null                              │
│         → Parraineur reçoit +50 points                         │
│         → Parrainé reçoit +20 points (déjà en stock)           │
│  5. Dossier CLÔTURÉ                                            │
│                                                                  │
│ Données créées/modifiées:                                        │
│  ✓ Fiche { statut=FACTUREE, dateLivraison }                   │
│  ✓ Facture { type=FACTURE, numero=FAC, statut=PAYEE }        │
│  ✓ PointsHistory { type=PARRAINAGE } (si applicable)          │
│  ✓ Client.pointsActuels += bonus parrainage                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 7. VALIDATIONS & CONTRAINTES

### Validations Niveau Application

```
CLIENT:
  ✓ Email unique (UNIQUE constraint)
  ✓ Téléphone format (regex: [0-9]{10})
  ✓ Nom complet non-vide
  ✓ Si PROFESSIONNEL: SIRET/ICE saisi

FICHE:
  ✓ Client existe
  ✓ Prescription optique valide:
      - Sphère ∈ [-20, +20]
      - Cylindre ∈ [-8, 0]
      - Axe ∈ [0, 180]
      - Addition ∈ [0, 4]
      - Prisme ∈ [0, 10]
  ✓ Type MONTURE/LENTILLES/MIXTE
  ✓ Produits sélectionnés existent

FACTURE:
  ✓ Client existe
  ✓ Centre existe
  ✓ Montant totalTTC > 0
  ✓ TVA tauxTVA ∈ [0, 20]
  ✓ Paiement montant ≤ resteAPayer
  ✓ Transitions d'état cohérentes
  ✓ Remise ≤ totalTTC

STOCK:
  ✓ Quantité ≥ 0
  ✓ Quantité minimale raisonnée
  ✓ Entrepôt source/dest existent (transfert)
  ✓ Produit existe en entrepôt (avant sortie)

PAIEMENT:
  ✓ Mode valide (ESPECES/CARTE/CHEQUE/VIREMENT/LCN)
  ✓ Montant > 0
  ✓ Facture existe
  ✓ Montant ≤ resteAPayer

EMPLOYEE:
  ✓ Fonction valide (VENDEUR/CAISSIER/OPTICIEN/MANAGER)
  ✓ Salaire base ≥ SMIC marocain (2500 DH approx)
  ✓ Taux commission ∈ [0, 30%]
  ✓ Au moins 1 centre affecté

PAYROLL:
  ✓ Montant net ≥ 0
  ✓ Commissions ≥ 0
  ✓ Heures supp ≥ 0
  ✓ Retenues ≤ salaire base + commissions

USER:
  ✓ Email unique, format valide
  ✓ Mot de passe minimum 8 chars (1 maj, 1 min, 1 chiffre)
  ✓ Au moins 1 centre affecté

JOURNEE_CAISSE:
  ✓ Caissier identifié
  ✓ Fond initial ≥ 0
  ✓ Écart ≤ 5 DH (sauf justification)
  ✓ Solde réel ≥ 0
```

---

## 8. SÉCURITÉ & ISOLATION DONNÉES

### Multi-Tenancy (Multi-Centre)

```
Isolation Stricte:
  ✓ Chaque user affecté à centre(s) spécifique(s)
  ✓ Header Tenant identifie centre requête
  ✓ Toutes queries filtrent: WHERE centreId = @tenantId
  ✓ Cross-centre: IMPOSSIBLE (exceptions admin globales)
  
Exemple Query:
  SELECT * FROM Facture 
  WHERE centreId = @tenantId AND clientId = @clientId
  
Violation Check:
  SI user tente accéder centre non-affecté:
    → 403 Forbidden
    → Log audit + alerte sécurité
```

### Authentification & Autorisation

```
JWT Token Structure:
  {
    "sub": userId,
    "email": "user@example.com",
    "centreIds": [centreId1, centreId2],
    "roles": { centreId1: "VENDEUR", centreId2: "CAISSIER" },
    "iat": 1234567890,
    "exp": 1234567890 + 24h
  }

Validation Token:
  ✓ Signature valide (secret key)
  ✓ Pas expiré
  ✓ User actif (statut != DESACTIVE)

Autorisation Routes:
  @UseGuards(JwtAuthGuard)
  @RequireRoles('ADMIN', 'MANAGER')  ← Granulaire par centre
  createFacture() { ... }
```

### Gestion Mots de Passe

```
Stockage:
  ✓ Hash bcrypt (salt rounds = 10)
  ✓ Jamais stocké en clair

Exigences:
  ✓ Minimum 8 caractères
  ✓ Au moins 1 majuscule
  ✓ Au moins 1 minuscule
  ✓ Au moins 1 chiffre
  ✓ Optional: 1 caractère spécial

Change Required:
  ✓ Première connexion → Force change password
  ✓ Password policy: Pas réutiliser 3 derniers mots de passe

Audit:
  ✓ Dernier changement tracé
  ✓ Tentatives login échouées (5 max → lockout 15 min)
```

### Audit & Logging

```
Events Tracés:
  ✓ Création/modification/suppression entités
  ✓ Accès données sensibles (export comptabilité)
  ✓ Changements statut critiques (facture → payée)
  ✓ Erreurs sécurité (unauthorized access, etc.)

Informations Audit:
  - User ID (qui)
  - Timestamp exact
  - Action (CREATE/UPDATE/DELETE)
  - Entité affectée + ID
  - Valeurs avant/après (si sensible)
  - Centre concerné
  - Adresse IP (optionnel)

Rétention:
  - 2 ans minimum (légal Maroc)
  - Données immuables (pas de suppression)
  - Backup régulier

Exemple Audit Log:
  {
    "id": "audit-123",
    "userId": "user-456",
    "action": "UPDATE",
    "entity": "Facture",
    "entityId": "facture-789",
    "changes": {
      "statut": { "avant": "DEVIS_EN_COURS", "après": "VALIDEE" },
      "resteAPayer": { "avant": 600, "après": 0 }
    },
    "centreId": "centre-001",
    "timestamp": "2026-03-15T14:23:45Z",
    "ipAddress": "192.168.1.100"
  }
```

---

## 9. INTERFACE UTILISATEUR

### UX Design Principles

```
CLARTÉ:
  ✓ Une action = Un écran
  ✓ Hiérarchie visuelle claire (titres, sections)
  ✓ Erreurs expliquées (pas juste "Erreur 500")
  ✓ Validations inline (champ rouge + message)

ACCESSIBILITÉ:
  ✓ Responsive (mobile 360px → desktop 2560px)
  ✓ WCAG 2.1 AA (couleurs, contrastes)
  ✓ Keyboard navigation (Tab, Enter)
  ✓ Labels explicites sur tous inputs

PERFORMANCE:
  ✓ Chargement < 3 secondes
  ✓ Pagination tables (50 lignes max)
  ✓ Lazy loading images
  ✓ Caching frontend (SPA state)

SÉCURITÉ UI:
  ✓ Masquage données sensibles (email truncated: j***@g***.com)
  ✓ Confirmation avant suppressions
  ✓ Lock UI pendant save (disable buttons)
  ✓ Session timeout (inactivité 30 min)
```

### Écrans Principaux (Wireframes)

```
1. DASHBOARD (Accueil)
   ┌─────────────────────────────┐
   │ Bienvenue {nom_user}        │
   ├─────────────────────────────┤
   │ KPIs:                       │
   │  • CA Mois: 50K DH          │
   │  • Factures impayées: 3     │
   │  • Stock bas: 5 produits    │
   │  • Commissions: 2.5K DH     │
   │                             │
   │ [Graphique CA trend]        │
   │ [Top 5 vendeurs]            │
   │ [Paiements en attente]      │
   └─────────────────────────────┘

2. LISTE FACTURES
   ┌──────────────────────────────┐
   │ Factures                     │
   │ [Filters: Type, Statut, etc] │
   ├──────────────────────────────┤
   │ N°      Client      Montant  │
   │ FAC001  Ahmed       600 DH   │
   │ DV002   Fatima      1200 DH  │
   │ BC003   Commerce    3000 DH  │
   │ [Pagination: 50/page]        │
   └──────────────────────────────┘
   
   Click ligne → Détail + PDF + Paiements

3. CRÉER FACTURE (Wizard)
   Étape 1: Sélectionner Client
   Étape 2: Ajouter Produits (table)
   Étape 3: Aperçu + Montant
   Étape 4: Validation + Paiement
   
   Validation inline: Erreurs colorées en rouge

4. STOCK MANAGEMENT
   ┌────────────────────────────┐
   │ Stock                      │
   │ [Recherche produit]        │
   │ [Filtre: Alerte bas, etc]  │
   ├────────────────────────────┤
   │ Code    Produit    Qté    │
   │ MT001   Monture    50     │  [⚠️ Bas!]
   │ VR002   Verres     120    │
   │ └─ Transfert inter-entrepôt│
   │ └─ Créer ajustement        │
   └────────────────────────────┘

5. CAISSE QUOTIDIENNE
   ┌─────────────────────────────┐
   │ Caisse du 15-03-2026        │
   │ Caissier: Ahmed             │
   │                             │
   │ Fond initial: 1000 DH       │
   │ ─────────────────────────── │
   │ Recettes:                   │
   │  • Espèces: 5200 DH (12 tx) │
   │  • Cartes: 3500 DH (8 tx)   │
   │  • Chèques: 2000 DH (2 tx)  │
   │ Total: 10700 DH             │
   │ ─────────────────────────── │
   │ Solde théorique: 11700 DH   │
   │ Solde réel: 11700 DH        │
   │ Écart: 0 DH ✓               │
   │                             │
   │ [Clôturer] → FERMEE         │
   └─────────────────────────────┘

6. FICHE CLIENT / PRESCRIPTION
   ┌─────────────────────────────┐
   │ Dossier Client: Ahmed       │
   │ Téléphone: 06123456789      │
   │                             │
   │ Fiche #1 (Monture/Verres)   │
   │ ├─ Statut: COMMANDE         │
   │ ├─ Oeil Droit:              │
   │ │  Sphère: -2.00            │
   │ │  Cylindre: -1.50          │
   │ │  Axe: 45°                 │
   │ ├─ Oeil Gauche: ...         │
   │ └─ Produits sélectionnés:   │
   │    Monture Rayban / Verres  │
   │                             │
   │ [Éditer] [Créer Devis]      │
   │ [Lier BonCommande]          │
   └─────────────────────────────┘

7. PAIEMENT CLIENT
   ┌─────────────────────────────┐
   │ Enregistrer Paiement        │
   │                             │
   │ Facture: FAC001 (600 DH)    │
   │ Reste à payer: 600 DH       │
   │                             │
   │ Montant: [_______] DH       │
   │ Mode: [Espèces ▼]           │
   │ Référence: [_______]        │
   │                             │
   │ Détails Auto:               │
   │  • Points gagnés: 60 pts    │
   │  • Commission: +120 DH      │
   │  • Caisse: Ajoutée jour     │
   │                             │
   │ [Enregistrer] [Annuler]     │
   └─────────────────────────────┘
```

---

## 10. POINTS D'INTÉGRATION

### Dépendances Inter-Modules

```
factures ← clients (M-1)
        ← fiches (M-1, optionnel)
        ← products (N-N via lignes)
        ← loyalty (points attribués)
        ← stock-movements (sorties)
        ← paiements (recettes)
        ← operation-caisse (auto-intégration)
        ← personnel/commission (calcul)

clients ← fiches (1-N)
       ← loyalty (points history)
       ← paiements (historique)
       ← conventions (remise appliquée)

loyalty ← clients (points)
       ← factures (achat trigger)
       ← paiements (redemption)

products ← stock-movements (sorties/entrées)
        ← factures (prix achat/vente)
        ← warehouses (localisation)

warehouse ← products (1-N)
         ← stock-movements (localisation)
         ← centres (M-1)

personnel ← users (auth)
         ← commissions (calcul)
         ← payroll (bulletins)
         ← factures (vendeur)

payroll ← personnel (employee)
       ← commissions (montants)
       ← expenses (enregistrement)
       ← accounting (export)

accounting ← factures (export données)
          ← expenses (export)
          ← payroll (export)
          ← treasury (réconciliation)

journee-caisse ← operation-caisse (1-N)
              ← paiements (auto-création operations)
              ← caisse (configuration)
              ← centres (localisation)

treasury ← journee-caisse (soldes)
        ← expenses (flux sortants)
        ← factures (flux entrants)
        ← bon-livraison (achats fournisseurs)
```

### API Contracts (Examples)

```
POST /factures
{
  "clientId": "client-123",
  "ficheId": "fiche-456",
  "type": "DEVIS",
  "lignes": [
    {
      "productId": "product-789",
      "quantite": 1,
      "prixUnitaire": 500
    }
  ],
  "tauxTVA": 20,
  "vendeurId": "employee-001"
}

Response (201):
{
  "id": "facture-001",
  "numero": "DV 000001",
  "statut": "DEVIS_EN_COURS",
  "totalHT": 500,
  "totalTVA": 100,
  "totalTTC": 600,
  "resteAPayer": 600,
  "createdAt": "2026-03-15T10:30:00Z"
}

───────────────────

POST /paiements
{
  "factureId": "facture-001",
  "montant": 600,
  "mode": "ESPECES",
  "referencePaiement": null
}

Response (201):
{
  "id": "paiement-001",
  "factureId": "facture-001",
  "montant": 600,
  "mode": "ESPECES",
  "dateValeur": "2026-03-15",
  "createdAt": "2026-03-15T14:45:00Z"
}

Side-effects:
  ✓ Facture.statut = PAYEE
  ✓ Facture.resteAPayer = 0
  ✓ PointsHistory créée (+60 pts)
  ✓ Commission calculée
  ✓ MouvementStock créée
  ✓ OperationCaisse créée
  ✓ Fiche.statut = COMMANDE

───────────────────

GET /loyalty/client/:clientId
Response (200):
{
  "clientId": "client-123",
  "pointsActuels": 150,
  "pointsHistory": [
    { "type": "ACHAT", "montant": 60, "date": "2026-03-15" },
    { "type": "NOUVEAU_CLIENT", "montant": 20, "date": "2026-03-10" },
    { "type": "CREATION_FICHE", "montant": 30, "date": "2026-03-10" }
  ],
  "parrainage": {
    "parrainId": "client-999",
    "filleuls": ["client-001", "client-002"]
  }
}

───────────────────

POST /journee-caisse/:id/close
{
  "soldeReel": 11700,
  "justificationEcart": "Comptage OK"
}

Response (200):
{
  "id": "journee-caisse-001",
  "statut": "FERMEE",
  "fondInitial": 1000,
  "soldeTheorique": 11700,
  "soldeReel": 11700,
  "ecart": 0,
  "closureTime": "2026-03-15T18:00:00Z"
}
```

---

## RÉSUMÉ EXÉCUTIF

**OptiSaas** est une plateforme SaaS complète pour gestion centres optiques marocains, avec architecture modulaire microservices-like, isolation multi-centre stricte, et traçabilité complète.

**Stack**: Angular 15+ / NestJS / PostgreSQL / Docker

**Couverture Fonctionnelle**:
- ✅ Cycle vente complète (Devis → Facture → Paiement)
- ✅ Gestion stock multi-entrepôt
- ✅ Points fidélité Choukra (parrainage + redemption)
- ✅ Paie employés + commissions variables
- ✅ Caisse quotidienne + rapprochement
- ✅ Comptabilité exports Sage
- ✅ Multi-centres avec isolation

**Utilisateurs**: Admin, Managers, Vendeurs, Caissiers, Opticiens

**SLA Attendu**: 99.5% uptime, < 3s chargement, 50+ utilisateurs simultanés par centre

---

**Document préparé pour**: Implémentation / Maintenance par équipes externes / AI assistants

**Questions?** Consultez les fichiers d'analyse complémentaires:
- ANALYSE_OPTISAAS_COMPLETE.json (détails techniques)
- DTOCS_MODELES.md (DTOs et validations)
- ARCHITECTURE_GUIDE.md (diagrammes flux)
