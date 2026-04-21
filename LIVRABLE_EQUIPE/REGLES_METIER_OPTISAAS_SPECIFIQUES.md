# 🎯 RÈGLES MÉTIER SPECIFIQUES À OPTISAAS

**Date**: 2026-04-20  
**Audience**: Product Managers, Développeurs, Testeurs  
**Objectif**: Clarifier les différences entre métier optique générique et OptiSaas

---

## 📋 TABLE DES MATIÈRES

1. [Métier Optique Générique vs OptiSaas](#métier-optique-générique-vs-optisaas)
2. [Règles Spécifiques OptiSaas](#règles-spécifiques-optisaas)
3. [Processus Métier OptiSaas](#processus-métier-optisaas)
4. [Validations OptiSaas](#validations-optisaas)
5. [Features Exclusives OptiSaas](#features-exclusives-optisaas)
6. [Extraction du Code](#extraction-du-code)

---

## 🔍 MÉTIER OPTIQUE GÉNÉRIQUE vs OptiSaas

### ✅ MÉTIER OPTIQUE GÉNÉRIQUE (Universel)
```
Tout centre optique, n'importe où, doit gérer:

1. PRESCRIPTION OPTIQUE
   - Sphère (SPH), Cylindre (CYL), Axe (AXE)
   - Addition (ADD), Distance P/V
   - Lentilles vs Lunettes

2. PRODUITS
   - Montures (collection, prix)
   - Verres (traitement, indice)
   - Lentilles (correction)

3. CYCLE COMMERCIAL
   - Devis client (montant, détails produits)
   - Facture (document légal, TVA)
   - Paiement (multiples modes)

4. STOCK
   - Entrées fournisseur
   - Sorties (vente)
   - Retours clients

5. COMMANDE FOURNISSEUR
   - Bon de commande
   - Réception marchandise
   - Facturation fournisseur
```

---

### 🔷 RÈGLES OptiSaas AJOUTÉES (Spécifiques à la plateforme)

OptiSaas va **BIEN AU-DELÀ** du métier optique générique avec des règles métier exclusives:

---

## 🎯 RÈGLES SPÉCIFIQUES OPTISAAS

### 1️⃣ MULTI-CENTRE AVEC ISOLATION STRICTE

#### Règle
```
Chaque centre = Silo de données complètement isolé
- Un utilisateur du centre A ne VOIT RIEN du centre B
- Aucun partage de clients, factures, stock, ou employés
- Multi-centre POSSIBLE: un manager peut gérer 2+ centres
```

#### Impact
- **Sécurité**: Secret commercial protégé
- **Conformité**: Données financières ségrégées
- **Multitenancy**: Identifiant tenant (centreId) obligatoire sur TOUTES les queries

#### Exemple Code
```typescript
// ✓ Validation: TOUT query doit filtrer par centreId
const factures = await prisma.facture.findMany({
  where: {
    centreId: req.user.centreId,  // OBLIGATOIRE
    // Autres filtres...
  }
});

// ❌ JAMAIS sans centreId (security risk)
const factures = await prisma.facture.findMany({});
```

#### Lien Code
- **Backend**: `backend/src/common/guards/tenant.guard.ts`
- **DB**: `prisma/schema.prisma` - chaque entité a `centreId`

---

### 2️⃣ PROGRAMME FIDÉLITÉ "CHOUKRA" (Points + Parrainage)

#### Règle
```
Accumulation Points:
├─ Base: +0.1 points/DH dépensé (facture payée)
├─ Nouveau client: +20 bonus (1ère facture payée)
├─ Création fiche optique: +30 bonus
├─ Parrainage: +50 points (parrain), +20 points (parrainé)

Redemption:
├─ Seuil minimum: 500 points avant redemption
├─ Conversion: 10 points = 1 DH remise
├─ Application: Remise déduite AVANT facture payée

Limites:
├─ Remise ≤ 50% du montant facture (anti-fraude)
├─ Points ne peuvent pas créer crédit client
```

#### Impact
- **Métier**: Rétention clients (+20% repurchase visé)
- **Données**: Client.pointsActuels + PointsHistory audit trail
- **Calcul**: Totalement automatisé (pas manuel)
- **Reporting**: KPI - nombre clients avec 500+ points

#### Exemple Flux
```
1. Client PAIEMENT: 2000 DH facture
   └─ Points gagnés: 2000 × 0.1 = +200 pts
   └─ Si nouveau client: +20 pts bonus
   └─ Si fiche créée: +30 pts bonus
   └─ Total: 250 pts nouveaux

2. Client a 600 pts → veut remise
   └─ Utilise 500 pts = 50 DH remise
   └─ Solde: 100 pts restants
   └─ Remise appliquée sur facture suivante

3. Client A parraine Client B
   └─ A: +50 pts imméd
   └─ B: +20 pts imméd (lors 1ère transaction)
```

#### Lien Code
- **Backend**: `backend/src/features/loyalty/` (service calcul points)
- **DB**: 
  - `Client.pointsActuels`, `Client.parrainage`
  - `PointsHistory` (audit trail)
  - `Facture.remiseAppliquee`

---

### 3️⃣ COMMISSIONS VENDEURS AUTOMATIQUES

#### Règle
```
Trigger: Une facture DEVIENT PAYEE

Calcul par TYPE ARTICLE:
├─ Monture: 5-8% (configurable par centre)
├─ Verre: 2-3%
├─ Lentille: 3-5%
└─ Accessoire: 2%

Montant Commission = Facture.montantTTC × (taux%)

Application:
├─ Créée lors paiement facture (automatic)
├─ Associée au vendeur assigné sur Facture
├─ Intégrée au bulletin salaire du mois suivant

Limitations:
├─ Commission nulle si facture NON PAYEE
├─ Commission calculée si facture PARTIELLE (% du montant payé)
```

#### Impact
- **Motivation**: Vendeurs motivés, sales +30%
- **Paie**: Bulletins automatisés (moins travail RH)
- **Données**: Commission entité separée (pas dans Facture)
- **Audit**: Tous mouvements tracés (créé, annulé, remboursé)

#### Exemple
```
Facture FAC001: 1000 DH (Monture 400 + Verre 600)
Vendeur: Ahmed
Commission Rule:
  - Monture: 5%
  - Verre: 3%

Commission = (400 × 5%) + (600 × 3%)
            = 20 + 18
            = 38 DH

Audit:
2026-04-20 14:25 - Ahmed vendu FAC001 1000 DH (DEVIS_EN_COURS)
2026-04-20 14:27 - FAC001 validée (pas encore commission)
2026-04-20 14:30 - Paiement 1000 DH espèces
            └─ Commission créée: 38 DH
            └─ PointsHistory: +100 pts client
```

#### Lien Code
- **Backend**: `backend/src/features/personnel/commissions/`
- **DB**: `Commission` entité (facture, employee, montant, type)
- **Calcul**: `CommissionRule` config par centre

---

### 4️⃣ NUMÉROTATION SÉQUENTIELLE UNIQUE PAR TYPE

#### Règle
```
Chaque type document a sa propre séquence:

FACTURES:      FAC 000001, FAC 000002, ... (réinitialise par année)
DEVIS:         DEV 000001, DEV 000002, ... (réinitialise par année)
BON LIVRAISON: BL 000001, BL 000002, ...
BON COMMANDE:  BC 000001, BC 000002, ...

Automatique:
├─ Auto-increment au création
├─ Format: Préfixe + numéro 6 chiffres (zero-padded)
├─ Unique dans le centre + année
├─ JAMAIS réutilisé (même si facture annulée)

Format Marocain:
├─ Obligatoire légalement (traçabilité TVA)
└─ Anti-fraude (impossible renuméroter)
```

#### Impact
- **Légalité**: Conformité fiscale marocaine
- **Audit**: Tracabilité complète (comptabilité)
- **Sécurité**: Impossible renuméroter document

#### Exemple
```
Centre Casablanca - Année 2026:
- Facture 001 créée → FAC 000001 assigné
- Facture 002 créée → FAC 000002 assigné
- (Une fois FAC 000003 créée, c'est IMPOSSIBLE revenir à FAC 000002)
```

#### Lien Code
- **Backend**: `backend/src/features/factures/services/facture.service.ts`
- **DB**: 
  - `Facture.numero @unique @default(autoincrement())`
  - Migration: contrainte unique (centreId, type, numero, year)

---

### 5️⃣ ÉTATS FACTURE AVEC TRANSITIONS STRICTES

#### Règle
```
État Machine pour Facture:

DEVIS_EN_COURS
    │
    ├─→ [Vendeur ajoute produits, change prix]
    │
    └─→ VALIDEE
         │ [Client accepte, stock vérifié, TVA appliquée]
         │
         ├─→ PAYEE (paiement complet)
         │    ├─→ SOLDEE (si facture fermée)
         │    └─→ REMBOURSEE (retour client)
         │
         ├─→ PARTIELLE (paiement partiel)
         │    ├─→ PAYEE (rest complété)
         │    └─→ REMBOURSEE
         │
         └─→ ANNULEE (erreur, client change avis)

Validations Transitions:
├─ DEVIS_EN_COURS → VALIDEE: Montant > 0, Stock ✓, Client existe
├─ VALIDEE → PAYEE: Paiement reçu, Montant égal facture
├─ PAYEE → PARTIELLE: Erreur système (audit trail)
└─ *ANY* → ANNULEE: Avant VALIDEE (sinon compta cassée)
```

#### Impact
- **Business Logic**: Stricte (pas erreur état)
- **Comptabilité**: Factures PAYEE/PARTIELLE seules comptabilisées
- **Points**: Points gagnés UNIQUEMENT si PAYEE
- **Stock**: Réservé à VALIDEE, libéré si ANNULEE

#### Exemple
```
ERREUR MÉTIER (détectée dans tests):
- Facture FAC001 PAYEE → vendeur tente changement prix
  └─ REJETÉ ❌ (impossible modifier facture PAYEE)

CORRECT:
- Facture FAC001 DEVIS_EN_COURS → vendeur ajoute produit
  └─ OK ✓ (visible avant validation)
- Vendeur valide FAC001 → stock vérifié → FAC001 → VALIDEE
  └─ Client paie
  └─ FAC001 → PAYEE
```

#### Lien Code
- **Backend**: `backend/src/features/factures/services/`
- **DB**: `Facture.etat` enum (DEVIS_EN_COURS, VALIDEE, PAYEE, etc.)

---

### 6️⃣ APPLICATOIN TVA 20% AUTOMATIQUE + COMPTABILITÉ MAROCAINE

#### Règle
```
TVA Marocaine:
├─ Taux standard: 20%
├─ Taux réduit: Certains produits (rare)
├─ Application: Sur montant HT (avant TVA)

Calcul Auto:
  Facture.montantHT = Σ(produits prix HT)
  Facture.montantTVA = montantHT × 0.20
  Facture.montantTTC = montantHT + montantTVA

Comptabilité:
├─ Export Sage (format marocain)
├─ Déclaration TVA mensuelle
├─ Conformité DGII (Direction Générale Impôts)
└─ Bilan annuel (audit légal)
```

#### Impact
- **Légalité**: OBLIGATOIRE (non-conformité = sanction)
- **Reporting**: KPIs TVA distinct
- **Export**: Tous formats (Sage, Excel, PDF)

#### Exemple
```
Article 1: Monture 100 DH (HT)
Article 2: Verre 80 DH (HT)
──────────────────────────
Total HT:     180 DH
TVA (20%):     36 DH
──────────────────────────
Total TTC:    216 DH

Facture.remise (50 DH convention):
  Remise appliquée APRÈS TVA
  Total final: 216 - 50 = 166 DH
```

#### Lien Code
- **Backend**: `backend/src/features/factures/services/facture-calculation.ts`
- **DB**: `Facture.montantHT`, `Facture.montantTVA`, `Facture.montantTTC`

---

### 7️⃣ CAISSE QUOTIDIENNE AVEC RAPPROCHEMENT

#### Règle
```
Processus Journalier:
1. OUVERTURE: Caissier ouvre JourneeCaisse (8h00)
   └─ Solde initial: espèces physiques comptées

2. OPERATIONS: Tout paiement ESPECES → OperationCaisse
   └─ Facture payée 1000 DH espèces
   └─ Dépense 50 DH (fournitures)
   └─ Alimentation caisse 500 DH

3. FERMETURE: Caissier ferme JourneeCaisse (17h00)
   └─ Solde final: espèces physiques comptées ACTUELLEMENT
   └─ Solde théorique: calculé par système

4. RAPPROCHEMENT:
   Écart = Solde réel - Solde théorique
   
   ├─ Écart = 0 → PARFAIT ✓ (rare)
   ├─ Écart ≤ 5 DH → ACCEPTABLE (rounding)
   ├─ Écart > 5 DH → ANORMAL
   │  └─ Caissier justifie (perte, erreur)
   │  └─ Manager valide ou demande recount

Validation:
├─ FERME (rapprochement OK)
├─ PENDING (écart, justification en cours)
└─ REJETE (impossible fermer si écart > tolérance)
```

#### Impact
- **Trésorerie**: Vue temps-réel caisse
- **Fraude**: Détection écarts anormaux
- **Audit**: Tous mouvements tracés

#### Exemple
```
Jour: 2026-04-20 Centre Fès

OUVERTURE 08:00
  Solde initial: 5000 DH (compté manuel)

OPERATIONS JOURNEE:
  14:10 - Facture 1000 DH espèces (+1000) → Solde: 6000
  14:30 - Facture 500 DH espèces (+500) → Solde: 6500
  15:00 - Dépense fournitures (-50) → Solde: 6450
  16:00 - Alimentation (+1000) → Solde: 7450

Solde théorique: 7450 DH

FERMETURE 17:00
  Comptage réel espèces: 7455 DH
  Écart: +5 DH ✓ (acceptable, rounding)
  État: FERME

DEMAIN: Solde initial 17:00 = Solde final 16:00 (7450 DH)
```

#### Lien Code
- **Backend**: `backend/src/features/journee-caisse/`
- **DB**: `JourneeCaisse`, `OperationCaisse`, `Caisse`

---

### 8️⃣ RÔLES & PERMISSIONS GRANULAIRES

#### Règle
```
Rôles définis:

ADMIN_CENTRE
├─ Accès: Tout (centre)
├─ Permissions: Créer/modifier/supprimer ALL données
├─ Typical: Propriétaire centre
└─ Impact: TOTAL

MANAGER
├─ Accès: Opérations (employés, factures, stock)
├─ Permissions: Gestion équipe + validation documents
├─ Typical: Directeur opérations
└─ Impact: MOYEN

VENDEUR
├─ Accès: Commercial (clients, fiches, devis)
├─ Permissions: CRUD clients + créer fiches + devis (pas facture)
├─ Typical: Vendeur boutique
└─ Impact: BAS (commissions via factures)

CAISSIER
├─ Accès: Caisse UNIQUEMENT
├─ Permissions: Enregistrer paiements + ouvrir/fermer caisse
├─ Typical: Caissier
└─ Impact: MOYEN (trésorerie)

OPTICIEN
├─ Accès: Confection
├─ Permissions: Fiches + production (pas vente)
├─ Typical: Opticien confectionneur
└─ Impact: BAS (technique)

Validation:
├─ Multi-centre: Un rôle par centre (peut être ADMIN Fès + VENDEUR Cas)
├─ Permission check: TOUTES API endpoints
└─ Audit: TOUT action tracé (user, timestamp, avant/après)
```

#### Impact
- **Sécurité**: Least privilege access
- **Opération**: Workflows clairs par rôle
- **Audit**: Traçabilité qui fit quoi

#### Lien Code
- **Backend**: `backend/src/common/guards/roles.guard.ts`
- **DB**: `User.roles[]`, `EmployeeCentre.role`

---

### 9️⃣ AUDIT TRAIL SYSTÉMATIQUE

#### Règle
```
CHAQUE modification tracée:

ChangeLog (pour chaque entité modifiée):
├─ userId: Qui
├─ timestamp: Quand
├─ action: Créé/Modifié/Supprimé
├─ avant: État avant (JSON)
├─ apres: État après (JSON)
├─ raison: Pourquoi (optionnel)

Exemples:
1. Facture créée FAC001
   └─ changeLog: userId=1, action=CREATE, montant=1000, timestamp=14:23

2. Montant facture changé 1000 → 950 (remise client)
   └─ changeLog: userId=2, action=UPDATE, avant={...1000...}, apres={...950...}

3. Paiement enregistré 1000 DH espèces
   └─ changeLog: userId=3, action=CREATE (Paiement), mode=ESPECES

Implication:
├─ Impossible effacer trace
├─ Restauration facile si erreur
└─ Audits externes facilités
```

#### Impact
- **Compliance**: Légal (traçabilité 10 ans)
- **Fraude**: Détection manipulation données
- **Investigation**: Reconstruire séquence événements

#### Lien Code
- **Backend**: `backend/src/common/interceptors/audit.interceptor.ts`
- **DB**: `AuditLog` entité ou soft-delete avec timestamps

---

## 📊 PROCESSUS MÉTIER OPTISAAS

### Jour Client Complet (Avec règles OptiSaas)

```
┌─────────────────────────────────────────────────────────┐
│ CLIENT ENTRE AU MAGASIN                                 │
└─────────────────────────────────────────────────────────┘

1. CRÉATION FICHE OPTIQUE (Vendeur)
   ├─ Vendeur: Ahmed
   ├─ Client: nouveau (Alaoui)
   │  └─ OptiSaas créée: Client.pointsActuels = +20 bonus
   ├─ Prescription saisie
   │  └─ SPH +2.50, CYL -0.75, AXE 180
   │  └─ OptiSaas: Fiche validée → +30 bonus points (total +50)
   └─ État: CREATION → COMMANDE

2. SÉLECTION PRODUITS & DEVIS
   ├─ Monture: 400 DH HT
   ├─ Verres: 600 DH HT
   │  ├─ OptiSaas Auto-calcul:
   │  │  Total HT:   1000 DH
   │  │  TVA (20%):   200 DH
   │  │  Total TTC: 1200 DH
   └─ Devis créée: DEVIS_EN_COURS → numérotation auto (DEV 000001)

3. VALIDATION CLIENT
   ├─ Client accepte 1200 DH
   ├─ OptiSaas vérifie STOCK (bloque si rupture)
   ├─ État Devis: DEVIS_EN_COURS → VALIDEE
   │  └─ Commission Ahmed provisionnée (pas payée)
   │  └─ Points: ATTENTE (seulement si PAYEE)
   └─ Timestamp audit: 14:23

4. PAIEMENT (Caissier)
   ├─ Paiement 1200 DH espèces
   ├─ Mode: ESPECES
   │  ├─ OptiSaas Auto:
   │  │  ├─ Facture créée (FAC 000001)
   │  │  ├─ État: VALIDEE → PAYEE
   │  │  ├─ Commission Ahmed: (400×5%) + (600×3%) = 38 DH ✓
   │  │  ├─ Points Alaoui: +120 pts (1200×0.1) ✓
   │  │  ├─ OperationCaisse: +1200 (ENTREE)
   │  │  ├─ Stock: -1 Monture, -1 Verre
   │  │  └─ Audit: userId=3(Leila), action=CREATE(Paiement)
   │  └─ ChangeLog tracé
   │
   ├─ Caissier enregistre: caisse +1200 DH
   └─ Facture: FAC 000001 PAYEE

5. CONFECTION (Opticien)
   ├─ Réception commande système
   ├─ Montage monture + verres
   ├─ Qualité check
   └─ État Fiche: COMMANDE → LIVREE

6. LIVRAISON
   ├─ Client reprend lunettes
   ├─ Signature (+optionnel)
   ├─ État Fiche: LIVREE
   └─ États facturation: FAC 000001 = SOLDEE

RÉSULTAT OptiSaas:
├─ CA +1200 DH (visible dashboard temps-réel)
├─ Ahmed commission +38 DH (bulletin mois pro)
├─ Alaoui points +120 (pour remise future)
├─ Stock -1 monture, -1 verre (alertes bas si needed)
├─ Caisse +1200 DH (rapprochement JourneeCaisse)
├─ Audit trail: Qui a fait quoi, quand (10 ans traçabilité)
└─ TVA enregistrée: +200 DH (déclaration mensuelle)
```

---

## 🔍 VALIDATIONS OPTISAAS

### Validations Spécifiques (Pas dans métier optique générique)

```
1. MULTI-CENTRE ISOLATION
   ├─ Validation: Tous query DOIVENT filtrer centreId
   ├─ Risque: Cross-centre data leak (CRITICAL)
   └─ Check: Prisma middleware enforce

2. POINTS FIDÉLITÉ
   ├─ Validation: Points ≥ 0 (jamais négatif)
   ├─ Remise ≤ 50% facture TTC
   ├─ Seuil redemption: ≥ 500 pts
   └─ Conversion: 10 pts = 1 DH (exact)

3. COMMISSIONS
   ├─ Validation: % positif (5-8% monture, 2-3% verre)
   ├─ Trigger: Facture DOIT ÊTRE PAYEE
   ├─ Doublons: Impossible créer 2x commission même facture
   └─ Audit: ChangeLog tracé (créé, modifié, annulé)

4. NUMÉROTATION
   ├─ Validation: Unique (centreId, type, year, numero)
   ├─ Format: Préfixe + 6 chiffres zero-padded
   ├─ Immuable: Impossible renuméroter après création
   └─ Séquence: Auto-increment (jamais sauter)

5. ÉTATS FACTURE
   ├─ Validation: Transitions STRICTES (state machine)
   ├─ Impossible: PAYEE → DEVIS_EN_COURS (back)
   ├─ Modifications: Seulement si DEVIS_EN_COURS
   └─ Annulation: UNIQUEMENT avant VALIDEE

6. TVA
   ├─ Validation: Montant TVA = HT × 0.20
   ├─ Precision: 2 décimales (DH)
   ├─ Jamais: Remise appliquée AVANT TVA
   └─ Export: Traçabilité TVA par facture

7. CAISSE
   ├─ Validation: Écart ≤ 5 DH acceptable
   ├─ Justification: Écart > 5 DH DOIT être justifié
   ├─ Fermeture: IMPOSSIBLE si écart non-justifié
   └─ Solde: Solde réel ≥ 0 (jamais négatif)

8. PERMISSIONS
   ├─ Validation: VENDEUR ne peut pas créer facture
   ├─ CAISSIER ne peut pas modifier clients
   ├─ Chaque action = permission check
   └─ Audit: Tentative non-autorisée LOGGÉE

9. PARRAINAGE
   ├─ Validation: Parrain EXISTE déjà
   ├─ Parrain ne PEUT PAS parrainer lui-même
   ├─ Lien permanent: Impossible modifier après
   └─ Points: Créés AUTOMATIQUEMENT à linkage
```

---

## 🚀 FEATURES EXCLUSIVES OPTISAAS

### Features QUI N'EXISTENT PAS dans métier optique générique

| Feature | Description | Impact |
|---------|-------------|--------|
| **Programme Choukra** | Points + Parrainage pour fidélité | Rétention +20% |
| **Commissions Auto** | Calcul auto vendeurs (5-8% monture) | Paie simplifiée |
| **Multi-centre** | Succursales isolées mais gérées centre | Scalabilité |
| **Caisse Quotidienne** | Rapprochement espèces + audit | Trésorerie temps-réel |
| **Audit Trail** | TOUT tracé (10 ans conformité) | Compliance |
| **Rôles Granulaires** | VENDEUR, CAISSIER, OPTICIEN, etc. | Opérations |
| **Export Comptable** | Normes marocaines (Sage, DGII) | Légalité |
| **État Machine Facture** | DEVIS → VALIDEE → PAYEE → SOLDEE | Integrity |
| **Conventions Remise** | Remises commerciales à client | Commerce |
| **Bon Livraison** | Suivi fournisseur + réceptions | Supply chain |
| **Dépenses Opérations** | Suivi costs (fournitures, etc.) | Analytics |
| **Personnel Paie** | Bulletins, pointage, absences | RH |

---

## 📁 EXTRACTION DU CODE

### Comment trouver les règles métier OptiSaas dans le code:

```
Backend Structure:
└─ src/features/
   ├─ factures/          → États, numérotation, TVA
   ├─ loyalty/           → Points Choukra + parrainage
   ├─ personnel/         → Commissions, paie
   ├─ journee-caisse/    → Caisse quotidienne
   ├─ centers/           → Multi-centre isolation
   ├─ users/             → Rôles & permissions
   ├─ clients/           → Fiches optiques
   ├─ paiements/         → Modes paiement
   └─ [+ 25 autres modules]

DB Schema:
└─ prisma/schema.prisma
   ├─ Client (pointsActuels, parrainage)
   ├─ Facture (etat, numero, montantTTC, remise)
   ├─ Commission (montant, taux, type article)
   ├─ PointsHistory (audit trail points)
   ├─ OperationCaisse (tous mouvements caisse)
   ├─ JourneeCaisse (rapprochement)
   ├─ EmployeeCentre (rôles, affectation)
   └─ [+ 18 autres modèles]

Frontend Components:
└─ src/app/features/
   ├─ dashboard/              → KPIs OptiSaas (CA, points, commissions)
   ├─ commercial/             → Cycle complet devis→facture
   ├─ loyalty/                → Interface points Choukra
   ├─ personnel/              → Paie + commissions
   ├─ accounting/             → Exports comptables
   ├─ caisse/                 → Rapprochement journalier
   └─ [+ 12 autres modules]

Tests (Unit + Integration):
└─ backend/test/
   ├─ factures.spec.ts        → États, transitions, numérotation
   ├─ loyalty.spec.ts         → Calcul points, parrainage
   ├─ commissions.spec.ts     → Taux, trigger PAYEE
   ├─ caisse.spec.ts          → Rapprochement, écarts
   ├─ multi-tenant.spec.ts    → Isolation centreId
   ├─ audit.spec.ts           → Tracabilité
   └─ permissions.spec.ts     → RBAC
```

---

## ✅ CHECKLIST VALIDATION

Avant d'implémenter une règle métier OptiSaas, valider:

- [ ] Règle est-elle **multi-centre aware** (centreId obligatoire)?
- [ ] **Audit trail** tracée (ChangeLog)?
- [ ] **Permissions** validées (user.role)?
- [ ] **États** respectent machine d'état?
- [ ] **TVA** automatique appliquée?
- [ ] **Validations** en frontend ET backend?
- [ ] **Cas limites** testés (remise 50%, points négatifs, etc.)?
- [ ] **Documentation** mise à jour?

---

## 🔗 RÉFÉRENCES

Voir aussi:
- [POUR_PRODUCT_MANAGER.md](./01-GUIDES_RAPIDES/POUR_PRODUCT_MANAGER.md) - Processus métier
- [SPECIFICATION_FINALE_OPTISAAS.md](./03-SPECIFICATIONS/SPECIFICATION_FINALE_OPTISAAS.md) - Spec complète
- [DTOCS_MODELES.md](./03-SPECIFICATIONS/DTOCS_MODELES.md) - Validations précises
- [GLOSSAIRE_METIER.md](./04-RESSOURCES/GLOSSAIRE_METIER.md) - Termes optique
- Code: `backend/src/features/*`, `prisma/schema.prisma`
