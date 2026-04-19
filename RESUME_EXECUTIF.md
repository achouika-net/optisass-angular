# RÉSUMÉ EXÉCUTIF - OPTISAAS

## 🎯 QU'EST-CE QUE OPTISAAS?

**OptiSaas** est un logiciel de gestion complète pour **centres optiques** - une plateforme tout-en-un gérée:
- ✅ Gestion clients et dossiers optiques
- ✅ Cycle commercial (Devis → Facture → Paiement)
- ✅ Stock produits (montures, verres, lentilles, accessoires)
- ✅ Points fidélité "Choukra" (parrainage, redemption)
- ✅ Caisse et paie employés
- ✅ Comptabilité (exports Sage, TVA, bilan)
- ✅ Multi-centres/succursales

---

## 💻 ARCHITECTURE TECHNIQUE

### Stack
```
Frontend:   Angular 15+ (TypeScript, RxJS, Reactive Forms)
Backend:    NestJS (TypeScript, services, modules)
Database:   PostgreSQL (Prisma ORM)
Deployment: Docker Compose
```

### Structure
```
Backend:   32 modules métier + 24 modèles Prisma
Frontend:  18 modules UI + 50+ composants
API:       50+ endpoints RESTful
Auth:      JWT token-based, role-based access
```

---

## 📊 DONNÉES PRINCIPALES

### Entités Core (24 modèles)

```
CLIENT
  ├─ Points Fidélité (Choukra)
  ├─ Factures (Historique achats)
  ├─ Fiches (Dossiers optiques)
  ├─ Remises Conventions
  └─ Groupes Familiaux

FACTURE
  ├─ Devis / Bon Commande / Facture / Avoir
  ├─ Paiements (Suivi encaissement)
  ├─ Mouvements Stock (Sorties)
  ├─ Commissions Vendeur
  └─ Points Fidélité (Attribués)

FICHE (Dossier optique)
  ├─ Prescription (Données optiques: sphère, cylindre, axe)
  ├─ Montures / Verres / Lentilles sélectionnés
  ├─ Suivi production / Commande fournisseur
  └─ Conversion en Facture

STOCK
  ├─ Produits (Catalogue complet)
  ├─ Mouvements (Entrées/Sorties/Transferts)
  ├─ Entrepôts (Multi-warehouse par centre)
  └─ Alertes (Stock bas)

EMPLOYEE
  ├─ Commissions (Basé factures vendues)
  ├─ Paie (Bulletin mensuel)
  ├─ Pointage (Présence)
  └─ Affectations Centre
```

---

## 🔄 PROCESSUS MÉTIER CLÉS

### 1. CYCLE VENTE COMPLÈTE

```
Client arrive magasin
     ↓
Créer Fiche (données optiques)
     ↓
Saisir Prescription (sphère, cylindre, axe)
     ↓
Sélectionner Produits + Générer Devis
     ↓
Client paie → Enregistrer Paiement
     ↓ [Automatiquement]
┌─────────────────────────────────────┐
├─ Stock décrème (Sortie)            │
├─ Points Fidélité attribués (0.1/DH)│
├─ Commission Vendeur calculée       │
├─ Opération Caisse créée            │
├─ Fiche → Statut "Commande"         │
└─────────────────────────────────────┘
     ↓
Fournisseur expédie (Bon de Commande)
     ↓
Réception Stock (Entrée, Mouvement)
     ↓
Optique confectionne lunettes
     ↓
Client reprend → Livraison complète
     ↓
Fiche → Facturé → Dossier Clôturé
```

### 2. POINTS FIDÉLITÉ CHOUKRA

```
Acquisition:
  • +0.1 points/DH dépensé (1 point/10 DH)
  • +20 points nouveau client
  • +50 points parraineur, +20 points parrainé
  • +30 points création dossier

Redemption:
  • Seuil min: 500 points
  • 10 points = 1 DH remise
  • Remise appliquée facture (paiement)

Parrainage:
  • Client A parrainne Client B
  • Lien permanent Client.parrainId
  • Filleuls réseau tracés
```

### 3. COMMISSIONS VENDEURS

```
Déclenchement:
  Facture VALIDEE + PAYEE

Calcul:
  Par ligne × Type Produit × Taux%
  Types: MONTURE, VERRE, LENTILLE, ACCESSOIRE, SERVICE

Période:
  Mensuelle (YYYY-MM)

Intégration:
  Ajouté à Salaire = Base + Commissions + HeuresSup + Primes - Retenues

Bulletin Paie:
  PDF généré, enregistré comme Dépense
```

### 4. CAISSE QUOTIDIENNE

```
Ouverture:
  ├─ Fond initial renseigné
  ├─ Caissier identifié
  └─ Statut: OUVERTE

Transactions jour:
  ├─ Chaque paiement → OperationCaisse
  ├─ Moyen séparé: Espèces, Cartes, Chèques
  └─ Comptabilisé immédiatement

Clôture:
  ├─ Comptage réel caisse
  ├─ Solde théorique = Fond + Recettes - Décaissements
  ├─ Écart = Réel - Théorique
  ├─ Justification si écart > 0.01 DH
  └─ Statut: FERMEE + Responsable
```

---

## 🚀 MODULES PRINCIPAUX

### Backend (32 modules)

**Gestion Commerciale**
- Factures → Devis, BC, Factures, Avoirs
- Fiches → Dossiers optiques clients
- Clients → Base clients
- Paiements → Encaissements
- Loyalty → Points Choukra
- Stock-Movements → Mouvements
- Products → Catalogue

**Gestion Opérationnelle**
- Caisse, Journee-Caisse, Operation-Caisse → Trésorerie
- Personnel → Employees + Commissions + Paie
- Expenses → Dépenses opérationnelles
- Bon-Livraison, Supplier-Invoices → Fournisseurs

**Gestion Administrative**
- Treasury → Trésorerie analytique
- Accounting → Exports Sage (comptabilité)
- Auth, Users → Authentification + Rôles
- Stats → KPIs, Rapports

**Support**
- Conventions → Remises
- Imports → Import données
- Notifications → Emails + PDFs
- Uploads, Settings, etc.

### Frontend (18 modules)

**Navigation**
- Dashboard → Accueil KPIs
- Authentication → Login/logout
- Settings → Configuration

**Métier**
- Client-Management → Gestion clients
- Commercial → Fiches et devis
- Finance → Factures et paiements
- Stock-Management → Inventaire
- Measurement → Prescriptions optiques
- Personnel-Management → Paie

**Support**
- Accounting, Reports, User-Management, Warehouses, Groups, etc.

---

## 🔐 SÉCURITÉ & ISOLATION

### Multi-Centre
- Chaque user affecté à centre(s) spécifique(s)
- Données isolées strictement par `centreId`
- Header `Tenant` identifie centre requête
- Cross-centre: **Impossible**

### Authentification
- JWT token-based
- Rôles par centre: Admin, Manager, Vendeur, Caissier
- Permissions granulaires (entrepôts visibles)
- MDP changement première connexion

### Audit
- User ID tracé (qui crée, qui valide)
- Timestamps (createdAt, updatedAt)
- Complète traçabilité

---

## 📈 RÈGLES MÉTIER CRITIQUES

### Gestion Factures
- ✅ Numérotation unique par type (DV/BC/FAC/AV)
- ✅ Transitions d'état contrôlées
- ✅ Stock vérifié avant autorisation
- ✅ TVA calculée automatique (20%)
- ✅ Points attribués à validation
- ✅ Commission vendeur si facture payée

### Gestion Stock
- ✅ Mouvements tracés (entree/sortie/transfert/retour)
- ✅ Quantité actuelle mise à jour
- ✅ Alertes stock bas (seuil configurable)
- ✅ Lot tracking + date péremption
- ✅ Bloque DEVIS→BC si stock insuffisant

### Gestion Caisse
- ✅ Solde théorique vs réel rapproché
- ✅ Écarts justifiés
- ✅ Comptage séparé par moyen
- ✅ Intégration paiements automatique

### Gestion Comptabilité
- ✅ Plan comptable marocain
- ✅ TVA collectée vs déductible
- ✅ Export Sage format standard
- ✅ Seuls documents éligibles exportés

---

## 💡 VALIDATIONS CRITIQUES

### Niveau 1: Création
```
✓ Entités obligatoires existent (Client, Centre, Fournisseur)
✓ IDs uniques respectés
✓ Formats emails valides
✓ Dates cohérentes (emission ≤ echeance)
```

### Niveau 2: Transitions
```
✓ Transitions d'état autorisées
✓ Stock suffisant avant DEVIS→BC
✓ Montant paiement ≤ reste à payer
✓ Facture non annulée avant modification
```

### Niveau 3: Métier
```
✓ Prix cohérents (achat ≤ vente)
✓ Données optiques valides (sphère/cylindre/axe)
✓ TVA dans 0-20%
✓ Points fidélité seuil respecté (500 min)
✓ Commission calculée uniquement si facture payée
```

### Niveau 4: Comptable
```
✓ TVA collectée/déductible correctes
✓ Export comptable: uniquement éligibles
✓ Montants balancés
✓ Trace audit complète
```

---

## 📊 SCHÉMA DONNÉES SIMPLIFIÉ

```
┌─────────┐         ┌──────────┐         ┌─────────┐
│ CLIENT  │◄────────┤ FACTURE  │────────►│ PRODUIT │
└─────────┘         └──────────┘         └─────────┘
    │                    │                    │
    ├─ Points (Loyalty)  ├─ Paiements        ├─ Stocks
    ├─ Fiches (Devis)    ├─ Commissions      └─ Mouvements
    └─ Conventions       └─ OperationCaisse


┌──────────┐         ┌──────────┐         ┌─────────┐
│ EMPLOYEE │◄────────┤ PAYROLL  │────────►│ DEPENSE │
└──────────┘         └──────────┘         └─────────┘
    │                    │
    ├─ Commissions       └─ Salaires
    └─ Affectations Centre


┌──────────┐         ┌──────────────┐     ┌──────────┐
│ CAISSE   │◄────────┤ JOURNEE_CAISSE│───►│ OPERATION│
└──────────┘         └──────────────┘     │ _CAISSE  │
    │                                      └──────────┘
    └─ Centre
```

---

## 🎯 CAPACITÉS PRINCIPALES

### Vente
- [x] Création devis multi-article
- [x] Conversion devis → bon commande
- [x] Suivi fournisseur
- [x] Paiement partiel/total
- [x] Retours/avoirs
- [x] Points fidélité auto

### Stocks
- [x] Catalogue produits (montures, verres, lentilles, accessoires)
- [x] Multi-entrepôt
- [x] Mouvements tracés (7 types)
- [x] Alertes stock bas
- [x] Transferts inter-warehouse
- [x] Lot + date péremption

### Clients
- [x] Base de données clients
- [x] Groupes familiaux
- [x] Parrainage (réseau)
- [x] Remises conventions
- [x] Historique achats
- [x] Points fidélité

### Caisse
- [x] Multi-caisses par centre
- [x] Sessions quotidiennes
- [x] Comptage espèces/cartes/chèques
- [x] Rapprochement automatique
- [x] Écarts justifiés
- [x] Intégration paiements

### Paie
- [x] Fiches employés
- [x] Commissions basées factures
- [x] Calcul bulletins paie
- [x] Retenues sociales
- [x] Impôt sur revenu progressif
- [x] Export PDF

### Comptabilité
- [x] Export Sage (format standard)
- [x] Plan comptable marocain
- [x] TVA collectée vs déductible
- [x] Bilan mensuel
- [x] Trésorerie analytique

---

## 🔄 INTÉGRATIONS CLÉS

```
Facture.paiement → OperationCaisse → JourneeCaisse
Facture.validée → PointsHistory (Loyalty)
Facture.payée → Commission (Vendeur)
Facture.payée → MouvementStock (SORTIE)
BonLivraison.reçu → MouvementStock (ENTREE)
Employee.mois → Payroll (Bulletin)
Payroll → Depense (Comptabilisation Salaire)
```

---

## 📋 CHECKLIST COMPRENDRE OPTISAAS

- [ ] Lire ce résumé (5 min)
- [ ] Consulter ARCHITECTURE_GUIDE.md (10 min)
- [ ] Parcourir structure JSON modules (15 min)
- [ ] Réaliser un cycle complet vente (20 min)
- [ ] Vérifier intégration caisse + paie (10 min)
- [ ] Lire DTOs pour 2-3 modules (15 min)

**Total: ~75 min pour compréhension complète**

---

## 🎓 POUR ALLER PLUS LOIN

### Fichiers associés
- `ANALYSE_OPTISAAS_COMPLETE.json` → Détails complets (modèles, modules, endpoints)
- `ARCHITECTURE_GUIDE.md` → Architecture + flux détaillés
- `DTOCS_MODELES.md` → Tous DTOs et structures
- `INDEX_ANALYSE.md` → Navigation et recherche
- `backend/src/features/*/` → Code source
- `backend/prisma/schema.prisma` → Modèle données exact

### Domaines clés à étudier
1. **Gestion Factures** → Backbone application
2. **Loyalty (Fidélité)** → Logique métier complexe
3. **Stock & Mouvements** → Intégrations nombreuses
4. **Caisse** → Opérations critiques
5. **Paie & Commissions** → Calculs complexes

---

## 📞 CONTACTS & RESSOURCES

**Documentation générée**: Avril 2026
**Version**: 1.0 Analyse Complète
**Couverture**: 100% codebase OptiSaas

---

**PRÊT À EXPLORER OPTISAAS EN DÉTAIL!** 🚀

Démarrez par [ARCHITECTURE_GUIDE.md](./ARCHITECTURE_GUIDE.md) pour flux visuels,
puis [ANALYSE_OPTISAAS_COMPLETE.json](./ANALYSE_OPTISAAS_COMPLETE.json) pour détails.
