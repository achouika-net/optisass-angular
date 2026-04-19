# ANALYSE ARCHITECTURE OPTISAAS - GUIDE DÉTAILLÉ

## 📊 STRUCTURE DU PROJET

```
OptiSaas/
├── Backend (NestJS + Prisma)
│   ├── src/
│   │   ├── features/ (32 modules)
│   │   │   ├── factures/ → Gestion documents commerciaux
│   │   │   ├── fiches/ → Dossiers clients optiques
│   │   │   ├── clients/ → Base clients
│   │   │   ├── paiements/ → Encaissements
│   │   │   ├── loyalty/ → Points Choukra
│   │   │   ├── stock-movements/ → Mouvements stocks
│   │   │   ├── products/ → Catalogue produits
│   │   │   ├── treasury/ → Trésorerie analytique
│   │   │   ├── accounting/ → Exports comptables Sage
│   │   │   ├── caisse/ → Configuration caisses
│   │   │   ├── journee-caisse/ → Gestion quotidienne caisse
│   │   │   ├── operation-caisse/ → Mouvements caisse
│   │   │   ├── personnel/ → Employees + commissions + paie
│   │   │   ├── expenses/ → Dépenses opérationnelles
│   │   │   ├── bon-livraison/ → Réceptions fournisseurs
│   │   │   ├── supplier-invoices/ → Factures suppliers
│   │   │   ├── suppliers/ → Répertoire fournisseurs
│   │   │   ├── centers/ → Gestion multi-centres
│   │   │   ├── groups/ → Groupes optiques
│   │   │   ├── warehouses/ → Entrepôts stocks
│   │   │   ├── glass-parameters/ → Config verres optiques
│   │   │   ├── conventions/ → Remises commerciales
│   │   │   ├── auth/ → Authentification JWT
│   │   │   ├── users/ → Gestion utilisateurs système
│   │   │   ├── stats/ → KPIs et rapports
│   │   │   ├── notifications/ → Emails + PDFs
│   │   │   ├── imports/ → Import données massives
│   │   │   ├── funding-requests/ → Demandes alimentation caisse
│   │   │   ├── marketing/ → Config SMS/WhatsApp/Email
│   │   │   ├── company-settings/ → Config générale
│   │   │   ├── sales-control/ → Validation ventes
│   │   │   └── uploads/ → Gestion fichiers
│   │   ├── prisma/ → Schema Prisma + migrations
│   │   ├── shared/ → Utilitaires communs
│   │   └── common/ → Guards, interceptors
│   └── package.json
│
├── Frontend (Angular)
│   ├── src/app/
│   │   ├── features/ (18 modules)
│   │   │   ├── dashboard/ → Accueil KPIs
│   │   │   ├── client-management/ → Gestion clients
│   │   │   ├── commercial/ → Fiches et devis
│   │   │   ├── finance/ → Factures paiements
│   │   │   ├── stock-management/ → Stocks
│   │   │   ├── measurement/ → Prescriptions optiques
│   │   │   ├── personnel-management/ → Paie
│   │   │   ├── accounting/ → Exports comptables
│   │   │   ├── reports/ → Rapports analytiques
│   │   │   ├── settings/ → Configuration
│   │   │   ├── authentication/ → Login/logout
│   │   │   ├── user-management/ → Utilisateurs
│   │   │   ├── warehouses/ → Entrepôts
│   │   │   ├── groups/ → Groupes/centres
│   │   │   ├── advanced-search/ → Recherche multi-critères
│   │   │   ├── online-payments/ → Paiements en ligne
│   │   │   └── agenda/ → Calendrier RDVs
│   │   └── shared/ → Components réutilisables
│   └── package.json
│
├── database/
│   └── schema.prisma → Modèle données complet
│
└── docker-compose.yml → PostgreSQL + Services

```

## 🏗️ ARCHITECTURE DONNÉES (Prisma)

### Entités Principales (24 modèles)

```
CLIENT
  ├─ Fiche (1-N) → Dossier optique par produit
  ├─ Facture (1-N) → Historique achats
  ├─ PointsHistory (1-N) → Fidélité Choukra
  ├─ Convention (M-1) → Remises appliquées
  └─ Groupe (M-1) → Famille clients

FICHE
  ├─ Facture (1-1) → Lien à facture finale
  ├─ BonLivraison (1-N) → Commandes fournisseur
  └─ FactureFournisseur (1-N) → Factures suppliers

FACTURE
  ├─ Client (M-1)
  ├─ Fiche (M-1)
  ├─ Centre (M-1)
  ├─ Employee (M-1) → Vendeur commissionné
  ├─ Paiement (1-N) → Paiements clients
  ├─ OperationCaisse (1-N) → Intégration caisse
  ├─ MouvementStock (1-N) → Sorties stock
  ├─ Commission (1-N) → Commissions vendeur
  ├─ PointsHistory (1-N) → Points attribués
  └─ Facture (M-1 + 1-N) → Parent/Avoirs (retours)

PAIEMENT
  ├─ Facture (M-1)
  ├─ OperationCaisse (M-1) → Intégration
  └─ User (M-1) → Qui enregistré

MOUVEMENT_STOCK
  ├─ Product (M-1)
  ├─ Entrepot (M-1, source/destination)
  ├─ Facture (M-1) → Sortie vente
  ├─ BonLivraison (M-1) → Entrée réception
  └─ User (M-1) → Qui

PRODUCT
  ├─ Entrepot (M-1) → Stock par warehouse
  └─ MouvementStock (1-N) → Historique mouvements

ENTREPOT
  ├─ Centre (M-1)
  └─ Product (1-N) → Stocks locaux

EMPLOYEE
  ├─ User (1-1) → Authentification
  ├─ EmployeeCentre (1-N) → Affectations
  ├─ Commission (1-N) → Commissions
  ├─ Attendance (1-N) → Pointage
  ├─ Facture (1-N) → Factures vendues
  └─ Payroll (1-N) → Bulletins paie

COMMISSION
  ├─ Employee (M-1)
  ├─ Facture (M-1)
  └─ Periode (mois)

PAYROLL
  ├─ Employee (M-1)
  ├─ Depense (1-1) → Enregistrement salaire
  └─ Periodo (mois/annee)

DEPENSE
  ├─ Centre (M-1)
  ├─ Fournisseur (M-1) → Si achat
  ├─ EcheancePaiement (1-1) → Si post-daté
  ├─ FactureFournisseur (1-1) → Lien facture supplier
  ├─ User (M-1) → Qui crée/valide
  └─ Payroll (1-1) → Si paie

BON_LIVRAISON
  ├─ Fournisseur (M-1)
  ├─ Centre (M-1) → Réception ici
  ├─ Fiche (M-1) → Si lié à client
  ├─ MouvementStock (1-N) → ENTREE stock
  └─ EcheancePaiement (1-N) → Paiements planifiés

FACTURE_FOURNISSEUR
  ├─ Fournisseur (M-1)
  ├─ BonLivraison (M-1) → Facture pour BL
  ├─ MouvementStock (1-N) → Stock reçu
  ├─ EcheancePaiement (1-N) → Chèques/virements
  └─ Depense (1-1) → Comptabilisation

ECHEANCE_PAIEMENT
  ├─ FactureFournisseur (M-1) → Facture supplier
  ├─ BonLivraison (M-1) → OU BL directement
  └─ Depense (1-1) → OU dépense directe

JOURNEE_CAISSE
  ├─ Caisse (M-1)
  ├─ Centre (M-1)
  ├─ OperationCaisse (1-N) → Transactions jour
  └─ DemandeAlimentation (1-N) → Demandes funding

OPERATION_CAISSE
  ├─ JourneeCaisse (M-1)
  ├─ Facture (M-1) → Si liée
  └─ Paiement (1-N) → Auto-créée par paiement

CENTRE
  ├─ Groupe (M-1)
  ├─ Caisse (1-N) → PdV multiples
  ├─ Entrepot (1-N) → Stocks
  ├─ Client (1-N) → Clients affectés
  ├─ EmployeeCentre (1-N) → Affectations
  └─ CommissionRule (1-N) → Règles locales

GROUPE
  └─ Centre (1-N) → Succursales

CONVENTION
  └─ Client (1-N) → Bénéficiaires remise

FOURNISSEUR
  ├─ BonLivraison (1-N)
  ├─ FactureFournisseur (1-N)
  └─ Depense (1-N) → Si achat

USER
  ├─ Employee (1-1) → Si employé
  └─ UserCentreRole (1-N) → Rôles par centre
```

## 🔄 FLUX MÉTIER CRITIQUES

### 1. CYCLE VENTE COMPLÈTE (6 étapes)

```
┌─────────────────────────────────────────────────────────────┐
│ ÉTAPE 1: CRÉATION CLIENT & DOSSIER OPTIQUE                  │
├─────────────────────────────────────────────────────────────┤
│ 1. Créer CLIENT (type PARTICULIER/PROFESSIONNEL)            │
│ 2. Créer FICHE (type MONTURE/LENTILLES/MIXTE)              │
│ 3. Saisir PRESCRIPTION (données optiques)                   │
│ 4. Bonus: +20 points nouveau client, +30 points fiche      │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ ÉTAPE 2: GÉNÉRATION DEVIS                                   │
├─────────────────────────────────────────────────────────────┤
│ 1. Sélectionner PRODUITS (montures, verres, lentilles)     │
│ 2. Créer FACTURE (type DEVIS, statut DEVIS_EN_COURS)       │
│ 3. Calcul: HT + TVA (20%) = TTC                            │
│ 4. Appliquer CONVENTION si client éligible                  │
│ 5. Afficher DEVIS au client                                 │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ ÉTAPE 3: VALIDATION & PAIEMENT INITIAL                      │
├─────────────────────────────────────────────────────────────┤
│ 1. Client accepte → Valider DEVIS (statut VALIDEE)         │
│ 2. VÉRIFICATION STOCK: bloque si rupture!                  │
│ 3. Enregistrer PAIEMENT (mode ESPECES/CARTE/CHEQUE)        │
│ 4. Statut Facture → PAYEE (ou PARTIELLE si partiel)        │
└─────────────────────────────────────────────────────────────┘
         ↓
         Ici se déclenchent automatiquement:
         ├─ Statut Facture → PAYEE
         ├─ +0.1 points / DH dépensé
         ├─ Commission vendeur calculée
         ├─ SORTIE stock (quantité décrém.)
         ├─ OperationCaisse créée (caisse + jour)
         └─ Fiche → statut COMMANDE
         ↓
┌─────────────────────────────────────────────────────────────┐
│ ÉTAPE 4: BON DE COMMANDE FOURNISSEUR                        │
├─────────────────────────────────────────────────────────────┤
│ 1. Optique crée BC fournisseur (si besoin d'achat)          │
│ 2. Email au fournisseur + PDFs techniques                   │
│ 3. Suivi d'une FICHE → plusieurs BL possibles              │
│ 4. Fiche passe à statut COMMANDE                            │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ ÉTAPE 5: RÉCEPTION & CONFECTION                            │
├─────────────────────────────────────────────────────────────┤
│ 1. Réception BL fournisseur                                 │
│ 2. Créer MOUVEMENT_STOCK (type ENTREE)                     │
│ 3. Stock augmente                                           │
│ 4. Optique confectionne lunettes localement                │
│ 5. Fiche → statut LIVREE                                   │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ ÉTAPE 6: LIVRAISON CLIENT & CLÔTURE                        │
├─────────────────────────────────────────────────────────────┤
│ 1. Client reprend lunettes finies                           │
│ 2. Fiche → statut FACTUREE                                 │
│ 3. Émission FACTURE définitive (document physique)         │
│ 4. Statut → SOLDEE (si déjà payé)                          │
│ 5. Bonus parrainage si client parrainé                      │
└─────────────────────────────────────────────────────────────┘
```

### 2. GESTION PAIEMENTS & CAISSE

```
ENREGISTREMENT PAIEMENT
  ├─ Mode ESPECES → OperationCaisse créée IMMÉDIATEMENT (jour)
  ├─ Mode CARTE → OperationCaisse créée IMMÉDIATEMENT (jour)
  ├─ Mode CHEQUE → OperationCaisse créée À DATE ENCAISSEMENT
  ├─ Mode VIREMENT → OperationCaisse créée À CONFIRMATION BANK
  └─ Mode LCN → OperationCaisse créée À L'ÉCHÉANCE

PAIEMENT NÉGATIF (Remboursement)
  ├─ Force en ESPECES
  ├─ Type OperationCaisse: DECAISSEMENT
  ├─ Reverse PointsHistory
  └─ Crédite client

INTÉGRATION CAISSE
  ├─ JourneeCaisse OUVERTE
  ├─ Transactions jour → OperationCaisse (1-N)
  ├─ Clôture rapprochement:
  │   ├─ Solde théorique = fond + recettes - décaissements
  │   ├─ Solde réel = comptage caissier
  │   ├─ Écart = différence (justifiable si petit)
  │   ├─ Comptage séparé: Espèces / Cartes (montant+nombre) / Chèques
  │   └─ Status → FERMEE + trace responsable
  └─ Prêt pour nouveau jour
```

### 3. FIDÉLITÉ CHOUKRA

```
ACCQUISITION POINTS
  ├─ Achat client: +0.1 points par DH (1 point/10 DH)
  ├─ Nouveau client: +20 points
  ├─ Parrainageur: +50 points
  ├─ Nouveau parrainé: +20 points
  ├─ Création dossier: +30 points
  └─ Total accum. → PointsHistory enregistré

CONSULTATION & REDEMPTION
  ├─ Client a 500+ points → Eligible reward
  ├─ Convertir: 10 points = 1 DH remise
  ├─ Utilisation: Remise appliquée facture lors paiement
  ├─ Trace: RewardRedemption enregistrée (audit)
  └─ PointsHistory: type REDEEM

PARRAINAGE
  ├─ Client A parrainne Client B
  ├─ A reçoit: 50 points
  ├─ B reçoit: 20 points
  ├─ Lien permanent: Client.parrainId
  └─ Filleuls: Client.filleuls[] (inverse)
```

### 4. COMMISSIONS VENDEUR

```
DÉCLENCHEMENT
  ├─ Facture doit être VALIDÉE + PAYÉE
  ├─ Commission.calculateForInvoice() appelée
  └─ Période: mois-année YYYY-MM

CALCUL
  ├─ Récupérer CommissionRule (poste + typeArticle + centre)
  ├─ Pour chaque LIGNE facture:
  │   ├─ Inférer typeArticle (MONTURE/VERRE/LENTILLE/ACCESSOIRE)
  │   ├─ Appliquer taux% de la règle
  │   ├─ Montant = ligne.totalTTC * taux / 100
  │   └─ Enregistrer Commission
  └─ Fallback: règle GLOBAL si aucune spécifique

INTÉGRATION PAIE
  ├─ Collecte commissions vendeur (mois)
  ├─ Ajouté à Salaire = Base + Commissions + HeuresSup + Primes - Retenues
  ├─ Bulletin paie généré (PDF)
  └─ Dépense créée pour comptabilisation
```

### 5. STOCK & MOUVEMENTS

```
MOUVEMENTS TYPES

ENTREE (Achat fournisseur)
  └─ BL reçue → MouvementStock créée → quantiteActuelle += qty

SORTIE (Vente client)
  ├─ DEVIS → VALIDEE (paiement) → MouvementStock SORTIE
  └─ quantiteActuelle -= qty

TRANSFERT (Inter-warehouse)
  ├─ Source -= qty
  ├─ Destination += qty
  └─ MouvementStock tracée

RETOUR (Client)
  ├─ Créer AVOIR (facture enfant)
  ├─ MouvementStock RETOUR
  └─ quantiteActuelle += qty

CONFECTION (Fabrication locale)
  ├─ Suivi production optique
  └─ MouvementStock type CONFECTION

AJUSTEMENT (Après inventaire)
  └─ Correction quantité

VÉRIFICATION AVANT VENTE
  ├─ DEVIS payé → Check stock avant autoriser BC
  ├─ Si rupture → Bloque transition + message conflict
  ├─ Vendeur doit résoudre (commander fournisseur ou proposer alternative)
  └─ Ensuite transition autorisée
```

### 6. COMPTABILITÉ & EXPORTS

```
EXPORT SAGE (Mensuel)
  ├─ Sélectionner: Factures VALIDEE + PAYEE + exportComptable=true
  ├─ Format ligne Sage: Date | Compte | Libellé | Débit | Crédit
  │
  ├─ VENTES (clients)
  │   ├─ Compte 3421 (Clients) | Débit: TTC
  │   ├─ Compte 4455 (TVA collectée) | Crédit: TVA
  │   └─ Compte 7111 (Ventes) | Crédit: HT
  │
  ├─ PAIEMENTS (encaissements clients)
  │   ├─ Compte 5161 (Caisse) | Débit: montant
  │   └─ Compte 3421 (Clients) | Crédit: montant
  │
  └─ DÉPENSES (charges)
      ├─ Compte 6111 (Achats) | Débit: HT
      ├─ Compte 3455 (TVA déductible) | Débit: TVA
      └─ Compte 5161 (Caisse) / 4411 (Fournisseurs) | Crédit

TVA SUMMARY
  ├─ TVA Collectée = Somme TVA factures clients
  ├─ TVA Déductible = Somme TVA achats fournisseurs
  ├─ TVA Net = Collectée - Déductible
  └─ Reporting mensuel
```

## 🔐 SÉCURITÉ & ISOLATION DONNÉES

### Multi-Centre
- Header `Tenant` identifie le centre utilisateur
- Toutes requêtes filtrées par `centreId`
- Utilisateur ne voit que ses centres (UserCentreRole)
- Cross-centre blocked (isolation stricte)

### Authentification
- JWT Token-based
- Login: Email + Mot de passe
- Role-based access (Admin, Manager, Vendeur, Caissier)
- Permissions par centre (entrepots accessibles)

### Audit Trail
- User ID tracé sur créations (userId, createdAt)
- Employé qui crée dépense (creeParId) et valide (valideParId)
- Caissier + responsable clôture caisse
- Complet auditabilité

## 📈 PERFORMANCE & OPTIMISATIONS

### Indexes Critiques
```sql
Client(nom, prenom, telephone, centreId)
Facture(centreId, clientId, ficheId, dateCreation, statut)
Paiement(factureId, date, statut, mode)
MouvementStock(produitId, entrepotSourceId, entrepotDestinationId, dateMovement)
PointsHistory(clientId, type, date)
```

### Caching
- LoyaltyConfig: 1 heure
- Products catalogue: 30 min
- Commission Rules: 1 heure

### Transactions
- Toutes opérations critiques dans `prisma.$transaction()`
- Rollback automatique si erreur
- Isolation niveau READ_COMMITTED

## 🚀 PATTERNS UTILISÉS

### NestJS
- **Modules** par domaine métier
- **Services** pour logique métier
- **Controllers** pour routes HTTP
- **DTOs** pour validation input
- **Guards** pour authentification/autorisation
- **Interceptors** pour logging + transformations

### Angular
- **Feature modules** par domaine
- **Smart/Presentational** components split
- **Services** pour API calls
- **Reactive Forms** (FormBuilder)
- **RxJS** Observables pour async
- **Route guards** pour auth + rôles

### Prisma
- **Schema-first** approach
- **Migrations** pour évolutions DB
- **Transactions** pour multi-step operations
- **Relations** pour intégrité données
- **Indexes** sur requêtes fréquentes

## 📋 CHECKLIST IMPLÉMENTATION

### Backend Complet
- [x] 32 modules services
- [x] Schema Prisma complet (24 modèles)
- [x] Validations métier
- [x] Transactions ACID
- [x] JWT authentification
- [x] Multi-centre isolation
- [x] Audit trails
- [x] Export Sage comptable

### Frontend Complet
- [x] 18 modules features
- [x] 50+ pages/écrans
- [x] Forms validation
- [x] Dashboard KPIs
- [x] Recherche multi-critères
- [x] Rapports/exports

### Métier Couvert
- [x] Gestion complète cycle vente (Devis → Facture → Paiement)
- [x] Points fidélité Choukra (acquisition, redemption, parrainage)
- [x] Stock mouvements (entrée, sortie, transfert, retour)
- [x] Caisse quotidienne (ouverture, clôture, rapprochement)
- [x] Paie employés (commissions, retenues, bulletin)
- [x] Comptabilité (export Sage, TVA, bilan)
- [x] Conventions remises
- [x] Multi-centres

---

**Créé: Avril 2026**
**Version: 1.0 - Analyse complète codebase OptiSaas**
