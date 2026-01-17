# Spécification Technique - Stock Alimentation

> **Version:** 1.1
> **Date:** 2026-01-14
> **Statut:** Validé
> **Feature:** Alimentation de stock via OCR ou saisie manuelle

---

## Table des matières

1. [Objectif](#1-objectif)
2. [Périmètre fonctionnel](#2-périmètre-fonctionnel)
3. [Règles métier](#3-règles-métier)
4. [Intégration OCR](#4-intégration-ocr)
5. [Modèles de données](#5-modèles-de-données)
6. [Interface utilisateur](#6-interface-utilisateur)
7. [Flux utilisateur](#7-flux-utilisateur)
8. [Validation et erreurs](#8-validation-et-erreurs)
9. [Structure des fichiers](#9-structure-des-fichiers)
10. [Implémentation par phases](#10-implémentation-par-phases)

---

## 1. Objectif

Permettre l'alimentation du stock de produits optiques à partir de :

- **OCR** : Scan de factures/bons de livraison fournisseur
- **Saisie manuelle** : Recherche et ajout de produits existants ou création rapide

### 1.1 Cas d'usage principal

Un opticien reçoit une livraison avec une facture contenant plusieurs produits. Il peut :

1. Scanner la facture → extraction automatique des produits
2. Vérifier/corriger les données extraites
3. Répartir les quantités par entrepôt
4. Valider l'entrée en stock

---

## 2. Périmètre fonctionnel

### 2.1 Inclus (Scope)

| Fonctionnalité          | Description                                                |
| ----------------------- | ---------------------------------------------------------- |
| Scan OCR                | Extraction texte depuis image facture/BL                   |
| Saisie manuelle         | Recherche produit + ajout au tableau                       |
| Création rapide produit | Formulaire minimal si produit inexistant                   |
| Création fournisseur    | Si fournisseur inexistant                                  |
| Split quantité          | Répartition d'un produit sur plusieurs entrepôts           |
| Actions groupées        | Appliquer entrepôt/TVA à plusieurs produits                |
| Validation formulaire   | Champs obligatoires selon type produit                     |
| Gestion doublons        | Fusionner les lignes si même produit ajouté plusieurs fois |

### 2.2 Exclus (Hors scope)

| Fonctionnalité              | Raison                                  |
| --------------------------- | --------------------------------------- |
| Modification stock existant | Feature séparée (ajustement inventaire) |
| Retour fournisseur          | Feature séparée                         |
| Commande fournisseur        | Feature séparée                         |
| Historique mouvements       | Feature séparée                         |

---

## 3. Règles métier

### 3.1 Ordre de traitement

```
1. Fournisseur → Créer si inexistant
2. Produits → Pour chaque produit :
   a. Si productId existe → Mise à jour stock (WAP)
   b. Si productId null → Création produit + stock initial
```

### 3.2 Calcul WAP (Weighted Average Price)

Quand on ajoute du stock à un produit existant, le prix d'achat est recalculé :

```
Nouveau WAP = (Ancien stock × Ancien prix) + (Nouvelle quantité × Nouveau prix)
              ─────────────────────────────────────────────────────────────────
                            Ancien stock + Nouvelle quantité
```

**Exemple :**

- Stock actuel : 10 unités à 50€
- Nouvelle entrée : 5 unités à 60€
- Nouveau WAP = (10 × 50 + 5 × 60) / 15 = 800 / 15 = 53.33€

### 3.3 Règles fournisseur

| Règle                       | Description                                      |
| --------------------------- | ------------------------------------------------ |
| Un fournisseur par document | Une facture/BL = un seul fournisseur             |
| Fournisseur obligatoire     | Impossible de valider sans fournisseur           |
| Création minimale           | Seul le nom est obligatoire pour création rapide |

### 3.4 Règles produit

| Règle               | Description                                  |
| ------------------- | -------------------------------------------- |
| Identification      | `productId = null` → nouveau produit à créer |
| Champs obligatoires | Selon type de produit (voir section 5.3)     |
| Quantité minimum    | Au moins 1 unité dans au moins 1 entrepôt    |
| Prix achat          | Obligatoire pour calcul WAP                  |

### 3.5 Split quantité

| Règle                | Description                                    |
| -------------------- | ---------------------------------------------- |
| Somme des quantités  | Total splits = quantité totale ligne           |
| Minimum par entrepôt | 1 unité minimum si entrepôt sélectionné        |
| Entrepôts distincts  | Pas de doublon d'entrepôt pour un même produit |

### 3.6 Gestion des doublons

| Situation                     | Action                                       |
| ----------------------------- | -------------------------------------------- |
| Même produit ajouté 2 fois    | Fusionner les lignes (additionner quantités) |
| Même produit via OCR + manuel | Proposer fusion ou garder séparé             |

### 3.7 Valeurs par défaut

| Champ          | Valeur par défaut | Source         |
| -------------- | ----------------- | -------------- |
| pricingMode    | `'coefficient'`   | Défaut système |
| coefficient    | `2.5`             | Défaut système |
| tvaRate        | `0.2` (20%)       | Défaut système |
| alertThreshold | `2`               | Défaut système |

**Règle :** Si produit existant → utiliser les valeurs du produit. Si nouveau produit → utiliser les valeurs par défaut.

### 3.8 Désignation produit

| Type produit              | Génération auto          | Exemple                     |
| ------------------------- | ------------------------ | --------------------------- |
| optical_frame / sun_frame | Marque + Modèle          | "Ray-Ban RB5154"            |
| lens                      | Type + Matériau + Indice | "Progressif Organique 1.67" |
| contact_lens              | Marque + Modèle          | "Acuvue Oasys"              |
| accessory                 | Marque + Modèle          | "Essilor Etui rigide"       |

**Règle :** Désignation auto-générée mais modifiable par l'utilisateur.

---

## 4. Intégration OCR

> **Note :** L'architecture OCR complète est documentée dans `ocr-architecture.spec.md`.
> Cette section décrit uniquement l'intégration spécifique à la feature Stock Alimentation.

### 4.1 Parser dédié : InvoiceParserService

La feature utilise `InvoiceParserService` qui étend `DocumentParser<IStockEntryProduct[]>`.

```typescript
// features/stock/stock-entry/services/invoice-parser.service.ts

@Injectable({ providedIn: 'root' })
export class InvoiceParserService extends DocumentParser<IStockEntryProduct[]> {
  readonly documentType: OcrDocumentType = 'invoice';

  // Extrait les produits du texte OCR
  protected extractData(rawText: string, blocks: IOcrBlock[]): IStockEntryProduct[];

  // Valide les produits extraits
  validate(data: IStockEntryProduct[]): IValidationResult;
}
```

### 4.2 Matching produit existant

Après extraction OCR, chaque produit doit être vérifié côté backend par désignation :

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Texte     │────▶│  Extraction │────▶│   Appel     │
│   OCR       │     │  Désignation│     │   Backend   │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                    ┌──────────┴──────────┐
                                    ▼                     ▼
                              ┌──────────┐          ┌──────────┐
                              │ Produit  │          │ Produit  │
                              │ Trouvé   │          │ Non trouvé│
                              │          │          │          │
                              │productId │          │productId │
                              │ = "xxx"  │          │ = null   │
                              └──────────┘          └──────────┘
```

**Endpoint backend :** `GET /api/products/search?designation={designation}`

**Comportement :**

- Si produit trouvé → récupérer `productId` et détails complets
- Si non trouvé → `productId = null`, row expandable auto-ouverte pour création rapide

### 4.3 Indicateurs de confiance

| Score OCR | Indicateur | Action                                      |
| --------- | ---------- | ------------------------------------------- |
| ≥ 80%     | 🟢 Vert    | Aucune                                      |
| 50-79%    | 🟡 Orange  | Warning, vérification recommandée           |
| < 50%     | 🔴 Rouge   | Champ surligné, correction manuelle requise |

### 4.4 Gestion des erreurs OCR

| Erreur                | Message utilisateur                                                  | Action                   |
| --------------------- | -------------------------------------------------------------------- | ------------------------ |
| Image illisible       | "Image non lisible. Réessayez avec une meilleure qualité."           | Retry ou saisie manuelle |
| Timeout               | "Traitement trop long. Réessayer ?"                                  | Bouton retry             |
| Aucun produit détecté | "Aucun produit détecté. Vérifiez l'image ou saisissez manuellement." | Saisie manuelle          |

---

## 5. Modèles de données

### 5.1 Payload Backend (Structure principale)

```typescript
// models/stock-entry.model.ts

export interface IStockEntryPayload {
  // Informations document
  supplierId: string | null; // null si nouveau fournisseur
  newSupplier: ISupplierQuickCreate | null;
  documentDate: string; // ISO date
  documentNumber: string; // Numéro facture/BL
  documentType: 'invoice' | 'delivery_note';

  // Produits
  products: IStockEntryProduct[];
}
```

### 5.2 Modèle Produit

```typescript
export interface IStockEntryProduct {
  // Identification
  productId: string | null; // null = nouveau produit

  // Répartition stock
  warehouseAllocations: IWarehouseAllocation[];

  // Prix (obligatoire pour tous)
  purchasePriceExclTax: number;

  // Champs obligatoires si nouveau produit (productId = null)
  productType: ProductType | null;
  pricingMode: PricingMode | null;
  coefficient: number | null; // Si pricingMode = 'coefficient'
  fixedAmount: number | null; // Si pricingMode = 'fixedAmount'
  fixedPrice: number | null; // Si pricingMode = 'fixedPrice'
  tvaRate: number | null;
  alertThreshold: number | null;

  // Champs conditionnels selon productType
  brandId: string | null; // Requis si NOT lens
  modelId: string | null; // Requis si NOT lens
  lensType: string | null; // Requis si lens
  lensMaterial: string | null; // Requis si lens
  lensRefractiveIndex: string | null; // Requis si lens
}

export interface IWarehouseAllocation {
  warehouseId: string;
  quantity: number;
}
```

### 5.3 Champs obligatoires par type de produit

| Champ                | Tous | optical_frame | sun_frame | lens | contact_lens | accessory |
| -------------------- | :--: | :-----------: | :-------: | :--: | :----------: | :-------: |
| productType          |  ✅  |       -       |     -     |  -   |      -       |     -     |
| purchasePriceExclTax |  ✅  |       -       |     -     |  -   |      -       |     -     |
| pricingMode          |  ✅  |       -       |     -     |  -   |      -       |     -     |
| coefficient\*        |  ✅  |       -       |     -     |  -   |      -       |     -     |
| fixedAmount\*        |  ✅  |       -       |     -     |  -   |      -       |     -     |
| fixedPrice\*         |  ✅  |       -       |     -     |  -   |      -       |     -     |
| tvaRate              |  ✅  |       -       |     -     |  -   |      -       |     -     |
| alertThreshold       |  ✅  |       -       |     -     |  -   |      -       |     -     |
| warehouseAllocations |  ✅  |       -       |     -     |  -   |      -       |     -     |
| brandId              |  -   |      ✅       |    ✅     |  -   |      ✅      |    ✅     |
| modelId              |  -   |      ✅       |    ✅     |  -   |      ✅      |    ✅     |
| lensType             |  -   |       -       |     -     |  ✅  |      -       |     -     |
| lensMaterial         |  -   |       -       |     -     |  ✅  |      -       |     -     |
| lensRefractiveIndex  |  -   |       -       |     -     |  ✅  |      -       |     -     |

\*Un seul requis selon pricingMode

### 5.4 Création rapide fournisseur

```typescript
export interface ISupplierQuickCreate {
  name: string; // Seul champ obligatoire
  email: string | null;
  phone: string | null;
}
```

### 5.5 Modèle UI (État du formulaire)

```typescript
// Pour le composant, état interne enrichi
export interface IStockEntryFormState {
  // Document
  supplier: ISupplier | null;
  isNewSupplier: boolean;
  newSupplierData: ISupplierQuickCreate | null;
  documentDate: Date;
  documentNumber: string;
  documentType: 'invoice' | 'delivery_note';

  // Produits
  products: IStockEntryProductRow[];

  // État UI
  selectedProductIds: Set<string>; // Pour actions groupées
  expandedProductIds: Set<string>; // Rows expandues
}

export interface IStockEntryProductRow extends IStockEntryProduct {
  // Identifiant temporaire UI
  rowId: string; // UUID généré côté front

  // Métadonnées UI
  isExpanded: boolean;
  isComplete: boolean; // Tous champs obligatoires remplis
  ocrConfidence: number | null; // Score OCR si applicable

  // Produit existant (si productId non null)
  existingProduct: Product | null;

  // Désignation extraite (pour affichage et recherche)
  designation: string | null;

  // Quantité totale (somme des allocations)
  totalQuantity: number;
}
```

---

## 6. Interface utilisateur

### 6.1 Layout général

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ALIMENTATION STOCK                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    INFORMATIONS DOCUMENT                         │   │
│  │                                                                  │   │
│  │  Fournisseur*: [Autocomplete + bouton créer]                    │   │
│  │                                                                  │   │
│  │  Type: ○ Facture  ○ Bon de livraison                           │   │
│  │                                                                  │   │
│  │  Numéro*: [__________]     Date*: [__/__/____]                  │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      IMPORT / AJOUT                              │   │
│  │                                                                  │   │
│  │  [📷 Scanner document]  [🔍 Rechercher produit]                 │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    ACTIONS GROUPÉES                              │   │
│  │                                                                  │   │
│  │  [☑ 3 sélectionnés]  Entrepôt: [____▼]  TVA: [____▼]  [Appliquer]│   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      TABLEAU PRODUITS                            │   │
│  │                                                                  │   │
│  │  ☐ │ Produit        │ Qté │ Entrepôt  │ Prix HT │ Statut │ ⋮   │   │
│  │  ──┼────────────────┼─────┼───────────┼─────────┼────────┼───  │   │
│  │  ☐ │ Ray-Ban RB5154 │ 10  │ Principal │ 45.00€  │   ✓    │ ⋮   │   │
│  │  ☐ │ ⚠ Nouveau      │ 5   │ [____▼]   │ 30.00€  │   ⚠    │ ⋮   │   │
│  │    │ ┌──────────────────────────────────────────────────┐      │   │
│  │    │ │ Type*: [____▼]  Marque*: [____▼]  Modèle*: [___] │      │   │
│  │    │ │ TVA*: [____▼]   Mode prix*: [____▼]              │      │   │
│  │    │ └──────────────────────────────────────────────────┘      │   │
│  │  ☐ │ Essilor Varilux│ 20  │ Split (2) │ 120.00€ │   ✓    │ ⋮   │   │
│  │                                                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│                                          [Annuler]  [Valider l'entrée]  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Colonnes du tableau

| Colonne  | Description                               | Éditable     | Largeur |
| -------- | ----------------------------------------- | ------------ | ------- |
| Checkbox | Sélection pour actions groupées           | Non          | 48px    |
| Produit  | Désignation + indicateur nouveau/existant | Non          | flex    |
| Quantité | Quantité totale (somme des splits)        | Oui          | 80px    |
| Entrepôt | Entrepôt ou "Split (n)" si multiple       | Oui (select) | 150px   |
| Prix HT  | Prix d'achat unitaire                     | Oui          | 100px   |
| Statut   | ✓ complet / ⚠ incomplet                   | Non          | 60px    |
| Actions  | Menu ⋮ (supprimer, dupliquer, split)      | -            | 48px    |

**Comportement quantité :**

- Si un seul entrepôt : édition directe met à jour l'allocation
- Si split (plusieurs entrepôts) : affiche la somme, clic ouvre le dialog split pour modifier

### 6.3 Row expandable (Nouveau produit)

**Comportement :**

- Auto-ouverte si produit incomplet (champs obligatoires manquants)
- Contient uniquement les champs obligatoires selon le type sélectionné

**Champs communs (toujours affichés) :**

- Désignation (auto-générée, modifiable)
- Type de produit\*
- Mode de tarification\*
- Coefficient/Montant fixe/Prix fixe\* (selon mode)
- Taux TVA\*
- Seuil d'alerte\*
- Prix d'achat HT\* (aussi éditable dans le tableau)

**Champs conditionnels (affichés selon type) :**

- Marque* + Modèle* (si type ≠ lens) - Modèles filtrés par marque sélectionnée
- Type verre* + Matériau* + Indice\* (si type = lens)

### 6.4 Recherche produit

**Champs de recherche selon type de produit :**

| Type                      | Champs de recherche            |
| ------------------------- | ------------------------------ |
| Tous                      | Désignation                    |
| optical_frame / sun_frame | + Marque, Modèle               |
| lens                      | + Type verre, Matériau, Indice |
| contact_lens              | + Marque, Modèle               |
| accessory                 | + Marque, Modèle               |

**Comportement :**

- Autocomplete avec appel backend
- Si aucun résultat → bouton "Créer ce produit"
- Sélection → ajout au tableau avec `productId` renseigné

### 6.5 Indicateurs visuels

| Indicateur         | Signification                   |
| ------------------ | ------------------------------- |
| 🟢 ✓               | Produit complet, prêt à valider |
| 🟡 ⚠               | Champs obligatoires manquants   |
| 🔴 Bordure rouge   | Champ en erreur                 |
| 📊 Badge confiance | Score OCR (ex: "85%")           |
| 🆕 Badge "Nouveau" | Produit à créer                 |

### 6.6 Split quantité (Dialog)

```
┌─────────────────────────────────────────────┐
│           RÉPARTITION PAR ENTREPÔT           │
├─────────────────────────────────────────────┤
│                                              │
│  Produit: Ray-Ban RB5154                     │
│  Quantité totale: 15                         │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │ Entrepôt        │ Quantité             │ │
│  │─────────────────┼──────────────────────│ │
│  │ Principal       │ [5_______]           │ │
│  │ Secondaire      │ [10______]           │ │
│  │                 │                      │ │
│  │ [+ Ajouter entrepôt]                   │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  Total: 15/15 ✓                             │
│                                              │
│                    [Annuler]  [Confirmer]   │
└─────────────────────────────────────────────┘
```

### 6.7 Actions groupées - Dialog conflit

Affiché si des produits sélectionnés ont déjà un split :

```
┌─────────────────────────────────────────────┐
│              CONFLIT DÉTECTÉ                 │
├─────────────────────────────────────────────┤
│                                              │
│  3 produits sélectionnés dont 1 avec        │
│  répartition multi-entrepôts.               │
│                                              │
│  Produits concernés:                         │
│  • Essilor Varilux (Principal: 10,          │
│    Secondaire: 10)                          │
│                                              │
│  Que souhaitez-vous faire ?                 │
│                                              │
│  [Écraser]           [Exclure]   [Annuler]  │
│                                              │
│  Écraser: remplace le split par l'entrepôt  │
│           sélectionné                        │
│  Exclure: applique uniquement aux produits  │
│           sans split                         │
│                                              │
└─────────────────────────────────────────────┘
```

---

## 7. Flux utilisateur

### 7.1 Flux OCR

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Upload    │────▶│  Traitement │────▶│   Appel     │────▶│  Affichage  │
│   Image     │     │    OCR      │     │  Backend    │     │  Résultats  │
└─────────────┘     └─────────────┘     │  (matching) │     └─────────────┘
                                        └─────────────┘
                                               │
                                    ┌──────────┴──────────┐
                                    ▼                     ▼
                              ┌──────────┐          ┌──────────┐
                              │ Produit  │          │ Produit  │
                              │ Trouvé   │          │ Nouveau  │
                              │          │          │          │
                              │ Row      │          │ Row      │
                              │ fermée   │          │ expandue │
                              └──────────┘          └──────────┘
```

**Détail du flux :**

1. Upload image
2. OCR extrait le texte
3. Parser extrait désignations + quantités + prix
4. Pour chaque produit : appel backend `GET /api/products/search?designation=xxx`
5. Si trouvé → `productId` renseigné, row fermée
6. Si non trouvé → `productId = null`, row auto-expandue

### 7.2 Flux saisie manuelle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Recherche  │────▶│  Résultats  │────▶│   Ajout     │
│  Produit    │     │   Liste     │     │   Tableau   │
└─────────────┘     └─────────────┘     └─────────────┘
       │
       │ (Aucun résultat)
       ▼
┌─────────────┐     ┌─────────────┐
│  Créer      │────▶│   Ajout     │
│  Nouveau    │     │   Tableau   │
│             │     │ (row expand)│
└─────────────┘     └─────────────┘
```

### 7.3 Flux validation

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Click     │────▶│  Validation │────▶│   Envoi     │
│  Valider    │     │  Front-end  │     │   Backend   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                    (Erreurs?)           (Succès?)
                           │                   │
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  Highlight  │     │  Toast      │
                    │  Erreurs +  │     │  succès +   │
                    │  Expand rows│     │  Reset form │
                    └─────────────┘     └─────────────┘
```

**Après succès :** Rester sur la page avec formulaire vide pour nouvelle saisie.

### 7.4 Flux annulation

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Click     │────▶│  Données    │────▶│  Confirm    │
│  Annuler    │     │  saisies ?  │     │  Dialog     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                    (Non)              (Oui/Non)
                           │                   │
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  Reset      │     │  Reset ou   │
                    │  direct     │     │  Rester     │
                    └─────────────┘     └─────────────┘
```

**Comportement :** Si données saisies → confirmation avant reset.

---

## 8. Validation et erreurs

### 8.1 Validation document

| Champ           | Règle                      | Message erreur                |
| --------------- | -------------------------- | ----------------------------- |
| Fournisseur     | Obligatoire                | "Fournisseur requis"          |
| Numéro document | Obligatoire                | "Numéro de document requis"   |
| Date            | Obligatoire, ≤ aujourd'hui | "Date invalide"               |
| Produits        | Au moins 1                 | "Ajoutez au moins un produit" |

### 8.2 Validation produit (commun)

| Champ    | Règle                 | Message erreur                      |
| -------- | --------------------- | ----------------------------------- |
| Quantité | > 0                   | "Quantité doit être supérieure à 0" |
| Prix HT  | ≥ 0                   | "Prix invalide"                     |
| Entrepôt | Au moins 1 allocation | "Sélectionnez un entrepôt"          |

### 8.3 Validation nouveau produit

| Champ             | Condition             | Message erreur                |
| ----------------- | --------------------- | ----------------------------- |
| Type produit      | Toujours              | "Type de produit requis"      |
| Mode tarification | Toujours              | "Mode de tarification requis" |
| Coefficient       | Si mode = coefficient | "Coefficient requis"          |
| Montant fixe      | Si mode = fixedAmount | "Montant fixe requis"         |
| Prix fixe         | Si mode = fixedPrice  | "Prix fixe requis"            |
| TVA               | Toujours              | "Taux TVA requis"             |
| Seuil alerte      | Toujours              | "Seuil d'alerte requis"       |
| Marque            | Si type ≠ lens        | "Marque requise"              |
| Modèle            | Si type ≠ lens        | "Modèle requis"               |
| Type verre        | Si type = lens        | "Type de verre requis"        |
| Matériau          | Si type = lens        | "Matériau requis"             |
| Indice            | Si type = lens        | "Indice de réfraction requis" |

### 8.4 Gestion erreurs OCR

| Erreur                | Action                     | Message utilisateur                                       |
| --------------------- | -------------------------- | --------------------------------------------------------- |
| Image illisible       | Retry ou saisie manuelle   | "Image non lisible. Réessayez ou saisissez manuellement." |
| Confiance < 50%       | Warning + highlight champs | "Vérifiez les champs surlignés"                           |
| Timeout               | Retry                      | "Traitement trop long. Réessayer ?"                       |
| Provider indisponible | Fallback ou erreur         | "Service OCR indisponible"                                |

---

## 9. Structure des fichiers

```
src/app/features/stock/stock-entry/
├── components/
│   ├── stock-entry/
│   │   ├── stock-entry.component.ts
│   │   └── stock-entry.component.html
│   │
│   ├── stock-entry-form/
│   │   ├── stock-entry-form.component.ts
│   │   └── stock-entry-form.component.html
│   │
│   ├── stock-entry-table/
│   │   ├── stock-entry-table.component.ts
│   │   └── stock-entry-table.component.html
│   │
│   ├── stock-entry-row/
│   │   ├── stock-entry-row.component.ts
│   │   └── stock-entry-row.component.html
│   │
│   ├── product-quick-form/
│   │   ├── product-quick-form.component.ts
│   │   └── product-quick-form.component.html
│   │
│   ├── product-search-dialog/
│   │   ├── product-search-dialog.component.ts
│   │   └── product-search-dialog.component.html
│   │
│   ├── warehouse-split-dialog/
│   │   ├── warehouse-split-dialog.component.ts
│   │   └── warehouse-split-dialog.component.html
│   │
│   └── bulk-action-conflict-dialog/
│       ├── bulk-action-conflict-dialog.component.ts
│       └── bulk-action-conflict-dialog.component.html
│
├── services/
│   ├── stock-entry.service.ts          # API calls
│   └── invoice-parser.service.ts       # Parse OCR → produits
│
├── models/
│   ├── stock-entry.model.ts            # Interfaces
│   └── stock-entry-form.model.ts       # Form state
│
├── stock-entry.store.ts                # Signal Store
└── stock-entry.routes.ts               # Routes
```

---

## 10. Implémentation par phases

### Phase 1 : Modèles et Store (1-2 jours)

**Objectif :** Modèles de données et state management

**Tâches :**

- [ ] Créer `stock-entry.model.ts`
- [ ] Créer `stock-entry-form.model.ts`
- [ ] Créer `stock-entry.store.ts` (Signal Store)
- [ ] Créer `stock-entry.service.ts` (API)

**Livrables :**

- Modèles TypeScript complets
- Store avec actions CRUD

---

### Phase 2 : UI Document et Tableau (2-3 jours)

**Objectif :** Interface principale sans expandable rows

**Tâches :**

- [ ] Créer `stock-entry.component.ts` (container)
- [ ] Créer `stock-entry-form.component.ts` (infos document)
- [ ] Créer `stock-entry-table.component.ts` (tableau)
- [ ] Créer `stock-entry-row.component.ts` (ligne)
- [ ] Intégrer sélection multiple
- [ ] Intégrer actions groupées basiques

**Livrables :**

- Page fonctionnelle avec tableau
- Ajout/suppression produits manuels
- Actions groupées (entrepôt, TVA)

---

### Phase 3 : Recherche produit (1-2 jours)

**Objectif :** Recherche et ajout de produits existants

**Tâches :**

- [ ] Créer `product-search-dialog.component.ts`
- [ ] Implémenter recherche par champs obligatoires selon type
- [ ] Implémenter recherche par désignation
- [ ] Appel backend pour vérification existence
- [ ] Bouton "Créer" si non trouvé
- [ ] Gestion doublons (fusion lignes)

**Livrables :**

- Dialog recherche fonctionnel
- Ajout produits existants au tableau
- Création si non trouvé

---

### Phase 4 : Expandable Rows et Validation (2 jours)

**Objectif :** Formulaire rapide pour nouveaux produits

**Tâches :**

- [ ] Créer `product-quick-form.component.ts`
- [ ] Intégrer dans expandable row
- [ ] Validation dynamique selon type produit
- [ ] Auto-expand si incomplet
- [ ] Indicateurs visuels (complet/incomplet)

**Livrables :**

- Création rapide produit inline
- Validation temps réel
- UX indicateurs

---

### Phase 5 : Split et Dialogs (1-2 jours)

**Objectif :** Fonctionnalités avancées

**Tâches :**

- [ ] Créer `warehouse-split-dialog.component.ts`
- [ ] Créer `bulk-action-conflict-dialog.component.ts`
- [ ] Intégrer logique split dans store
- [ ] Gérer conflits actions groupées (Écraser/Exclure)

**Livrables :**

- Split quantité multi-entrepôts
- Gestion conflits UX

---

### Phase 6 : Intégration OCR (2 jours)

**Objectif :** Connecter OCR à l'UI

**Prérequis :** Architecture OCR implémentée (voir `ocr-architecture.spec.md`)

**Tâches :**

- [ ] Créer `invoice-parser.service.ts`
- [ ] Upload image dans UI
- [ ] Affichage loading/progress
- [ ] Appel backend pour matching par désignation
- [ ] Mapping résultat OCR → tableau
- [ ] Auto-expand rows produits non trouvés
- [ ] Indicateurs confiance
- [ ] Gestion erreurs OCR

**Livrables :**

- Scan facture fonctionnel
- Feedback utilisateur complet

---

### Phase 7 : Tests et Polish (2 jours)

**Objectif :** Qualité et finitions

**Tâches :**

- [ ] Tests unitaires composants
- [ ] Tests intégration store
- [ ] Responsive design
- [ ] Accessibilité (a11y)
- [ ] Traductions FR/EN

**Livrables :**

- Feature production-ready
- Documentation utilisateur

---

## 11. Permissions et Routes

### 11.1 Routes à ajouter

```typescript
// À ajouter dans app-routes.config.ts
'stock/entry': [],                    // Liste/page principale
'stock/entry/add': [],                // Page création (même que principale)
```

### 11.2 Permissions

| Route             | Permission | Description                                     |
| ----------------- | ---------- | ----------------------------------------------- |
| `stock/entry`     | `[]`       | Accessible à tous les utilisateurs authentifiés |
| `stock/entry/add` | `[]`       | Même logique que `stock/products`               |

**Note :** Suit la même logique que les autres routes stock (`stock/products`).

### 11.3 Configuration routes

```typescript
// features/stock/stock-entry/stock-entry.routes.ts

import { TypedRoute } from '@app/types';
import { getRoutePermissions } from '@app/config';

export default [
  {
    path: '',
    loadComponent: () => import('./components/stock-entry/stock-entry.component'),
    data: {
      breadcrumb: 'nav.stock_entry',
      authorizationsNeeded: getRoutePermissions('stock/entry'),
    },
  },
] satisfies TypedRoute[];
```

---

## Annexes

### A. Dépendances à installer

```bash
# UUID pour rowId temporaires
npm install uuid
npm install -D @types/uuid
```

### B. Endpoints API (Backend)

| Méthode | Endpoint                                   | Description                 |
| ------- | ------------------------------------------ | --------------------------- |
| POST    | `/api/stock/entries`                       | Créer entrée stock          |
| GET     | `/api/products/search?designation=`        | Rechercher par désignation  |
| GET     | `/api/products/search?type=&brand=&model=` | Rechercher par champs       |
| POST    | `/api/suppliers/quick`                     | Création rapide fournisseur |

### C. Traductions clés

```json
{
  "stock.entry.title": "Alimentation Stock",
  "stock.entry.supplier": "Fournisseur",
  "stock.entry.documentNumber": "Numéro de document",
  "stock.entry.documentDate": "Date",
  "stock.entry.scanDocument": "Scanner document",
  "stock.entry.searchProduct": "Rechercher produit",
  "stock.entry.bulkActions": "Actions groupées",
  "stock.entry.validate": "Valider l'entrée",
  "stock.entry.newProduct": "Nouveau produit",
  "stock.entry.splitQuantity": "Répartir",
  "stock.entry.incomplete": "Champs manquants",
  "stock.entry.complete": "Complet",
  "stock.entry.createProduct": "Créer ce produit",
  "stock.entry.noResults": "Aucun produit trouvé",
  "stock.entry.duplicate.merge": "Fusionner avec existant",
  "stock.entry.conflict.overwrite": "Écraser",
  "stock.entry.conflict.exclude": "Exclure"
}
```

---

## Historique des modifications

| Version | Date       | Auteur | Description                                               |
| ------- | ---------- | ------ | --------------------------------------------------------- |
| 1.0     | 2026-01-14 | Claude | Version initiale                                          |
| 1.1     | 2026-01-14 | Claude | Ajout recherche produit, gestion doublons, séparation OCR |
