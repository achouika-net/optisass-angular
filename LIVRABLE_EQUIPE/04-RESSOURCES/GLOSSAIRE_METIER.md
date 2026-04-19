# 📖 GLOSSAIRE MÉTIER OPTIQUE

**Définitions termes utilisés dans OptiSaas**

---

## 👁️ TERMES OPTIQUES

### **Fiche / Prescription Oculaire**
Dossier optométrique client contenant sa correction visuelle:
- **SPH (Sphère)**: Correction pour hypermétropie (+) ou myopie (-)
  - Plage: -20 à +20 dioptries
  - Exemple: -3.50 = myope (voit loin flou)
  
- **CYL (Cylindre)**: Correction astigmatisme
  - Plage: -8 à 0 dioptries
  - Si 0: pas d'astigmatisme
  - Exemple: -1.25 = astigmate
  
- **AXE**: Orientation astigmatisme
  - Plage: 0 à 180°
  - Exemple: 45° = axe oblique
  
- **Validité**: Ordonnance valide 2 ans (expiration)

**Exemple fiche**: `-3.50 SPH -0.75 CYL 180 AXE` = Client myope avec légère astigmatisme

---

## 🛍️ PRODUITS OPTIQUES

### **Monture**
Cadre de lunettes (sans verres)
- **Types**: Cerclée, semi-cerclée, percée
- **Matière**: Plastique, acétate, métal, titane
- **Taille**: 52-58mm (largeur)
- **Prix**: 200-2000 DH typiquement

### **Verre**
Lentille de correction (fait sur mesure)
- **Types**:
  - **Simple foyer**: Vue lointaine seulement
  - **Bifocal**: Loin + près (ligne visible)
  - **Progressif**: Loin/moyen/près (pas de ligne)
  - **Photochrome**: Fonce au soleil
  - **Anti-lumière bleu**: Pour écran

- **Indice**: 1.5, 1.6, 1.67, 1.74 (+ haut = + fin)
- **Traitement**: Anti-reflet, anti-rayure, hydrophobe
- **Prix**: 300-1500 DH par paire

### **Lentille (Contact)**
Lentille cornéenne (à placer sur œil)
- **Types**:
  - **Journalière**: 1 jour utilisation
  - **Mensuelle**: 30 jours réutilisable
  - **Annuelle**: 365 jours réutilisable
  
- **Port**: Progressif ou correction jour 1
- **Boîtier**: Avec solution de nettoyage
- **Prix**: 30-300 DH par boîte

### **Accessoire**
Produits support:
- **Étui**: Rangement lunettes/lentilles
- **Solution**: Nettoyage lentilles
- **Chiffon**: Nettoyage verres
- **Prix**: 10-200 DH

---

## 📋 DOCUMENTS COMMERCIAUX

### **Devis (Quotation)**
Proposition de prix (pas encore engagement)
- **Statut**: `DEVIS_EN_COURS`
- **Stock**: Pas réservé
- **Paiement**: Optionnel
- **Validité**: 7 jours (expiration configurable)
- **Action**: Client peut accepter → devient Facture

**Exemple**: "Devis pour lunettesProgressIF - 1500 DH HT"

### **Facture**
Document de vente (engagement validé)
- **Statut**: `VALIDEE` (avant paiement) → `PAYEE` (après paiement) → `SOLDEE` (clôturée)
- **Stock**: Réservé/réalisé
- **Numérotation**: Séquentielle unique (FAC-001, FAC-002, ...)
- **TVA**: Automatique 20%
- **Légalité**: Requise pour comptabilité Maroc

**Exemple**: "Facture FAC-2026-00123 - Monture + Verres Progressive = 1800 DH TTC"

### **Avoir (Credit Note)**
Remboursement/correction de facture
- **Statut**: Inverse de facture
- **Stock**: Retour produit
- **Montant**: Négatif (crédit client)
- **Usage**: Client insatisfait, erreur, retour

**Exemple**: "Avoir AV-001 - Retour verres défectueux = -300 DH"

---

## 💰 CONCEPTS FINANCIERS

### **HT (Hors Taxes)**
Montant avant TVA
- Montant initial = base de calcul
- Exemple: 1500 DH HT

### **TVA (Taxe Valeur Ajoutée)**
Impôt 20% au Maroc
- Calcul: HT × 0.20
- Exemple: 1500 × 0.20 = 300 DH TVA

### **TTC (Toutes Taxes Comprises)**
Montant final à payer
- Calcul: HT + TVA = HT × 1.20
- Exemple: 1500 + 300 = 1800 DH TTC

### **Mode de Paiement**
Méthode règlement client:
- **Espèces**: Paiement comptant
- **Chèque**: À encaisser (délai)
- **Carte**: Paiement immédiat (avec frais possibles)
- **Virement**: Pour montants élevés

### **Commission Vendeur**
Pourcentage vendeur gagne par vente:
- **Monture**: 5-8% HT ligne
- **Verre**: 2-3% HT ligne
- **Lentille**: 3-5% HT ligne
- **Calcul**: S'ajoute salaire (bonus performance)

---

## 🎁 FIDÉLITÉ & POINTS

### **Points Choukra**
Système loyauté client:
- **Accumulation**: +0.1 point/DH dépensé
  - Facture 1000 DH TTC = 100 points

- **Bonuses**:
  - Nouveau client: +20 points
  - Création fiche: +30 points
  - Parrainage: +50 (qui parraille), +20 (parrainé)

- **Redemption**: 10 points = 1 DH remise
  - Minimum: 500 points (= 50 DH)
  - Maximum: 50% remise/facture

- **Validité**: Sans expiration
- **Transfert**: Non-transferable

**Exemple**: Client 1000 DH → +100 pts → A 500 pts → Remise 50 DH facture suivante

### **Parrainage (Réseau)**
Client peut inviter autres:
- **Parraineur**: Gagne +50 points + bonus client
- **Parrainé**: Gagne +20 points + discount initial
- **Lien permanent**: Non-révocable
- **Visibilité**: Parraineur peut voir ses filleuls

**Exemple**: Ahmed parraine Leila → Ahmed +50 pts, Leila +20 pts

---

## 📊 CAISSE & TRÉSORERIE

### **Caisse Quotidienne (JourneeCaisse)**
Journal de trésorerie d'un jour:
- **Ouverture**: Fond initial + caissier identifié + heure
- **Transactions**: Tous paiements du jour tracés
- **Clôture**: Solde théorique vs réel comparé

**Exemple**:
```
Caisse 15-Jan-2026 (Leila):
- Fond initial: 500 DH
- Espèces: +2500 DH (5 clients)
- Cartes: +1200 DH (3 clients)
- Chèque: +800 DH (2 clients)
- Théorique: 5000 DH
- Compté réellement: 4998 DH
- Écart: -2 DH (acceptable si <5 DH)
```

### **Opération Caisse (OperationCaisse)**
Chaque transaction = 1 opération:
- **Mode**: Espèces, Carte, Chèque, Virement
- **Montant**: Positif (entrée) ou Négatif (sortie)
- **Référence**: Chèque#, Transaction#, etc.
- **Timestamp**: Heure exacte
- **User**: Qui a fait transaction

---

## 🏪 GESTION STOCK

### **Mouvements Stock**
Trace chaque changement inventaire:

| Type | Sens | Exemple | Impact |
|------|------|---------|--------|
| **Entrée** | ➕ | Réception fournisseur | Stock ↑ |
| **Sortie** | ➖ | Facture validée | Stock ↓ |
| **Transfert** | ↔️ | Entrepôt A → B | Redistribution |
| **Retour** | ➕ | Client retour | Stock ↑ |
| **Ajustement** | ✏️ | Correction inventaire | Correction |

### **Alerte Stock**
Notification quand quantité basse:
- **Seuil**: Configurable par produit
- **Typique**: 5-10 unités
- **Trigger**: Lors sortie stock
- **Action**: Commander fournisseur

**Exemple**: Monture "Prada-2024" alerte quand < 3 unités

### **Entrepôt**
Lieu stockage produits:
- **Principal**: Stock main (central)
- **Succursale**: Stock filiale
- **Transferts**: D'un entrepôt à autre
- **Isolation**: Chaque centre a ses entrepôts

---

## 👥 RESSOURCES HUMAINES

### **Employé (Employee)**
Personne travaille au centre:
- **Types**: Vendeur, Opticien, Caissier, Manager, Admin
- **Rôles**: Permissions par type
- **Salaire**: Base + commissions

### **Commission (Commission)**
Bonus vendeur par vente:
- **Trigger**: Facture PAYEE
- **Calcul**: Par produit × taux
- **Mois**: Groupe par mois comptable
- **Intégration**: Auto-ajoutée bulletin paie

### **Paie (Payroll)**
Bulletin salaire mensuel:
- **Salaire base**: Fixe
- **Commissions**: Factures validées/payées
- **Déductions**: Taxes, assurances
- **Net**: À verser employé

**Exemple**: Vendeur Ahmed
```
Salaire base:     5000 DH
Commissions:       800 DH (8 factures × ~100 DH)
Cotisations:      -600 DH
Net à payer:      5200 DH
```

---

## 🤝 CONVENTIONS & FOURNISSEURS

### **Convention**
Accord spécial prix/conditions:
- **Avec fournisseur**: Prix réduits quantité
- **Avec client VIP**: Remises automatiques
- **Durée**: Temporelle (validité)
- **Impact**: Calculs facture automatiqu

**Exemple**: "Convention Luxottica - 15% remise montures Q1 2026"

### **Fournisseur (Supplier)**
Source produits:
- **Contact**: Email, téléphone, adresse
- **Conventions**: Prix/conditions spéciaux
- **Références**: Produits fournis
- **Facturation**: Débours acheteur

### **Bon de Livraison (BL)**
Document livraison fournisseur:
- **Contenu**: Produits reçus
- **Quantités**: Vérifiées réception
- **Mouvements stock**: Mis à jour
- **Facture**: Suit après BL

---

## 📈 CONCEPTS ANALYTIQUES

### **CA (Chiffre d'Affaires)**
Total ventes validées:
- **Calcul**: Σ Factures PAYEE + PARTIELLE
- **Par période**: Jour, mois, année
- **Par segment**: Vendeur, produit, centre

**Exemple**: CA Jan 2026 = 50,000 DH

### **AOV (Average Order Value)**
Panier moyen client:
- **Calcul**: CA total / Nombre factures
- **Target**: 800-1200 DH typiquement
- **Benchmark**: Comparer concurrents

### **Rotation Stock**
Vitesse vente produit:
- **Calcul**: (Quantité vendue année) / (Stock moyen)
- **Rapide**: > 8x/an (lentilles, accessoires)
- **Normal**: 4-6x/an (verres)
- **Lent**: < 2x/an (montures spécialisées)

### **Client Retention**
Fidélité clients:
- **New**: Achat premier fois
- **Repeat**: 2+ achats
- **Churn**: Arrête acheter
- **Target**: 60-80% retention

---

## 🔐 SÉCURITÉ SPÉCIFIQUE

### **Multi-Tenant**
Isolement centre(s):
- **Data**: Totalement séparées par centre
- **Accès**: User voit SEULEMENT son centre
- **Audit**: Qui a accédé quel centre quand
- **Garantie**: Cross-centre IMPOSSIBLE

### **RBAC (Role-Based Access Control)**
Permissions par rôle:
- **Admin**: Tout faire
- **Manager**: Opérations (employés, factures, stock)
- **Vendeur**: Vente seulement (clients, fiches, devis)
- **Caissier**: Caisse seulement (paiements)
- **Opticien**: Production seulement (fiches, confection)

### **Audit Trail**
Log tout ce qui se passe:
- **Qui**: User ID
- **Quoi**: Action (CREATE_FACTURE, UPDATE_STOCK, etc.)
- **Quand**: Timestamp précis
- **Avant/Après**: État avant/après modification
- **Usage**: Traçabilité légale + débogages

---

## 🌍 RÉGIONAL / MAROC

### **Dirham (DH)**
Monnaie Maroc: Dirham Marocain
- **Code**: MAD (ISO 4217)
- **Symbole**: د.م. ou DH
- **Subdivision**: 100 centimes

### **TVA Maroc**
Taxe standard 20%:
- **Collectée**: Sur ventes (prélevée client)
- **Déductible**: Sur achats (crédit fournisseur)
- **Déclaration**: Mensuelle/trimestrielle
- **Calcul**: HT × 0.20

### **SIRET Maroc**
Numéro identifiant entreprise:
- **Format**: Numéro unique registre commerce
- **Usage**: Factures, conventions
- **Validation**: Vérification légale
- **Impact**: Déductibilité TVA

### **Réglementation Optique Maroc**
Spécificités locales:
- **Formule**: -20 à +20 SPH, -8 CYL acceptés
- **Validité**: Ordonnances 2 ans
- **Officiel**: Optométriste/ophtalmologue valide
- **Douanes**: Import verres documenté

---

## 📞 CONTACT DÉFINITIONS

- **Unclear term?** → Consulter cette page
- **Pas dans glossaire?** → [FAQ_COMMUNES.md](FAQ_COMMUNES.md)
- **Règle métier?** → [../03-SPECIFICATIONS/SPECIFICATION_FINALE_OPTISAAS.md](../03-SPECIFICATIONS/SPECIFICATION_FINALE_OPTISAAS.md) section 5
- **Workflow?** → [../02-DOCUMENTATION_TECHNIQUE/FLUX_PROCESSUS.md](../02-DOCUMENTATION_TECHNIQUE/FLUX_PROCESSUS.md)

---

**Glossaire mis à jour: 2026-01-15**

Keep calm, CTRL+F! 🔍
