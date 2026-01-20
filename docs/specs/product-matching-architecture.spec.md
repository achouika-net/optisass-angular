# Architecture Product Matching OCR - Spécification Technique

> **Version**: 1.1.0
> **Date**: 2026-01-20
> **Statut**: Validé - Prêt pour implémentation

---

## Quick Reference - Contexte

### Objectif global

Permettre l'extraction automatique des informations produits (marque, modèle, référence) depuis les factures fournisseurs OCR, avec matching intelligent vers la base de données produits.

### Domaine métier : Optique

- **Montures** (optical_frame, sun_frame) : Ray-Ban, Oakley, Gucci...
- **Verres ophtalmiques** (lens) : Essilor, Zeiss, Hoya... (via IManufacturer)
- **Lentilles de contact** (contact_lens) : Acuvue, Bausch & Lomb... (via ILaboratory)
- **Accessoires** (accessory) : Étuis, chiffons, cordons...

### Codes produits - Référentiel complet

#### Codes-barres universels (identifiants uniques mondiaux)

| Code       | Longueur    | Format                                  | Usage                         | Exemple          |
| ---------- | ----------- | --------------------------------------- | ----------------------------- | ---------------- |
| **EAN-13** | 13 chiffres | Pays(2-3) + Fabricant + Produit + Check | Standard européen, lunetterie | `3660396012345`  |
| **EAN-8**  | 8 chiffres  | Version courte EAN-13                   | Petits produits               | `96385074`       |
| **UPC-A**  | 12 chiffres | Fabricant + Produit + Check             | Standard américain            | `012345678905`   |
| **UPC-E**  | 8 chiffres  | Version compressée UPC-A                | Petits emballages             | `01234565`       |
| **EAN-14** | 14 chiffres | Indicateur + EAN-13                     | Cartons/palettes              | `10012345678905` |

#### Codes métier optique

| Code                           | Portée            | Format      | Usage                         | Exemple          |
| ------------------------------ | ----------------- | ----------- | ----------------------------- | ---------------- |
| **OPC** (Optical Product Code) | Industrie optique | Variable    | Catalogue fabricants optiques | `RB2140-901-50`  |
| **Code fournisseur**           | Par fournisseur   | Variable    | Référence interne fournisseur | `LUX-2140-BLACK` |
| **Référence fabricant**        | Par fabricant     | Variable    | Code officiel fabricant       | `0RB2140 901 50` |
| **Code interne**               | OPTI-SAAS         | `PRD-XXXXX` | Généré par le système         | `PRD-00001`      |
| **SKU**                        | Par entreprise    | Variable    | Stock Keeping Unit interne    | `RAY-WAY-50-BLK` |

#### Règles de priorité pour le matching

```
1. EAN-13/EAN-8/UPC-A/UPC-E → Match EXACT (confiance 100%)
2. Code fournisseur + supplierId → Match par relation (confiance 95%)
3. Référence fabricant → Match exact ou fuzzy (confiance 85-95%)
4. Désignation → Parsing marque/modèle/couleur (confiance 50-80%)
```

### Bug connu à corriger

Dans `MOCK_MODELS`, le champ `brandId` stocke actuellement le **code** de la marque (`"RAY"`) au lieu de l'**ID** (`"brand-1"`). À corriger lors de la migration.

---

## Table des matières

1. [Analyse de l'existant](#1-analyse-de-lexistant)
2. [Principe architectural : Pas de duplication](#2-principe-architectural--pas-de-duplication)
3. [Répartition des responsabilités](#3-répartition-des-responsabilités)
4. [Interfaces et modèles](#4-interfaces-et-modèles)
5. [Système de matching produits](#5-système-de-matching-produits)
6. [Plan d'implémentation](#6-plan-dimplémentation)

---

## 1. Analyse de l'existant

### 1.1 Structure actuelle de la lib

```
opti_saas_lib/src/
├── shared/
│   ├── ocr/
│   │   ├── extractors/         # Extraction texte OCR → données structurées
│   │   ├── locales/            # Patterns FR/EN
│   │   ├── patterns/           # Regex numériques/marocains
│   │   ├── pipeline/           # Pipeline OCR
│   │   ├── utils/              # Helpers
│   │   ├── supplier-invoice.models.ts  # IInvoiceLine, ISupplierInvoice
│   │   └── ocr.interfaces.ts
│   ├── config.ts               # Resources, authorizations
│   └── types.ts                # Types authorization
├── client/                     # Helpers client
└── backoffice/                 # Helpers backoffice
```

### 1.2 Ce que le frontend importe déjà de la lib

```typescript
// Utilisé dans 20+ fichiers frontend
import {
  ResourceAuthorizations,
  ISupplierInvoice,
  IInvoiceLine,
  IOcrConfig,
  IOcrLocale,
  FR_LOCALE,
  EN_LOCALE,
  IPipelineConfig,
  // ...
} from '@optisaas/opti-saas-lib';
```

### 1.3 Interfaces frontend actuelles (models/)

| Interface               | Fichier                 | À déplacer dans lib ? |
| ----------------------- | ----------------------- | --------------------- |
| `IBrand`                | `brand.model.ts`        | ✅ OUI                |
| `IModel`                | `model.model.ts`        | ✅ OUI                |
| `IManufacturer`         | `manufacturer.model.ts` | ✅ OUI                |
| `ILaboratory`           | `laboratory.model.ts`   | ✅ OUI                |
| `ISupplier`             | `supplier.model.ts`     | ✅ OUI                |
| `IProduct`              | `product.model.ts`      | ✅ OUI                |
| `IAddress`              | `address.model.ts`      | ✅ OUI                |
| `IResource`             | `resource.model.ts`     | ✅ OUI                |
| `IFamily`, `ISubFamily` | `family.model.ts`       | ✅ OUI                |
| `IColor`                | `color.model.ts`        | ✅ OUI                |

**Constat** : Ces interfaces sont des contrats de données métier. Elles doivent être définies **UNE SEULE FOIS** dans la lib pour être partagées entre frontend et backend.

---

## 2. Principe architectural : Pas de duplication

### 2.1 Règle d'or

```
┌─────────────────────────────────────────────────────────────────┐
│  INTERFACES & TYPES      →  opti_saas_lib (source unique)       │
│  FONCTIONS PURES         →  opti_saas_lib (réutilisables)       │
│  DONNÉES (mocks/BDD)     →  frontend/backend services           │
│  LOGIQUE AVEC ÉTAT/DI    →  frontend/backend services           │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Flow d'import

```
                    opti_saas_lib
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
     Frontend        Backend        Mobile (futur)
         │               │
         │               │
    ┌────┴────┐     ┌────┴────┐
    │ Services│     │ Services│
    │ (DI,HTTP)     │ (DI,DB) │
    └─────────┘     └─────────┘
```

### 2.3 Ce qui va dans la lib

| Catégorie                | Exemples                                            | Justification              |
| ------------------------ | --------------------------------------------------- | -------------------------- |
| **Interfaces métier**    | `IBrand`, `IProduct`, `ISupplier`                   | Contrat de données partagé |
| **Types utilitaires**    | `ProductType`, `ProductStatus`                      | Enums/unions partagés      |
| **Fonctions pures**      | `parseBrandFromDesignation()`, `normalizeBarcode()` | Pas de dépendance externe  |
| **Patterns/Regex**       | `BRAND_PATTERNS`, `BARCODE_PATTERNS`                | Configuration statique     |
| **Constantes immuables** | Types de produits, catégories                       | Référentiel métier         |

### 2.4 Ce qui reste dans frontend/backend

| Catégorie             | Exemples                         | Justification            |
| --------------------- | -------------------------------- | ------------------------ |
| **Services avec DI**  | `ProductService`, `BrandService` | Injection Angular/NestJS |
| **Accès BDD/HTTP**    | `getProducts()`, `saveBrand()`   | Appels réseau/DB         |
| **Mocks temporaires** | `MOCK_BRANDS`, `MOCK_PRODUCTS`   | Données de test          |
| **Composants UI**     | `ProductAutocomplete`            | Spécifique Angular       |
| **Stores/State**      | `ProductStore`                   | État applicatif          |

---

## 3. Répartition des responsabilités

### 3.1 Dans opti_saas_lib

```
opti_saas_lib/src/shared/
├── models/                          # NOUVEAU - Interfaces métier
│   ├── index.ts
│   ├── address.model.ts             # IAddress
│   ├── brand.model.ts               # IBrand (enrichi)
│   ├── model.model.ts               # IModel (enrichi)
│   ├── manufacturer.model.ts        # IManufacturer (enrichi)
│   ├── laboratory.model.ts          # ILaboratory (enrichi)
│   ├── supplier.model.ts            # ISupplier
│   ├── product.model.ts             # IBaseProduct, IFrame, ILens, etc.
│   ├── resource.model.ts            # IResource, ResourceType, ResourceMap
│   ├── family.model.ts              # IFamily, ISubFamily
│   └── color.model.ts               # IColor
│
├── product-matching/                # NOUVEAU - Logique matching
│   ├── index.ts
│   ├── matching.interfaces.ts       # Interfaces résultat matching
│   ├── barcode.matcher.ts           # Matching par EAN/UPC
│   ├── supplier-code.matcher.ts     # Matching par code fournisseur
│   ├── designation.parser.ts        # Parsing marque/modèle depuis texte
│   ├── frame.patterns.ts            # Patterns montures
│   ├── lens.patterns.ts             # Patterns verres
│   ├── contact-lens.patterns.ts     # Patterns lentilles
│   └── accessory.patterns.ts        # Patterns accessoires
│
├── ocr/                             # EXISTANT - Extraction OCR
│   └── ...
```

### 3.2 Dans frontend

```
frontend/src/app/shared/
├── models/                          # DEVIENT - Ré-exports depuis lib
│   ├── index.ts                     # export * from '@optisaas/opti-saas-lib'
│   └── (fichiers supprimés ou transformés en ré-exports)
│
├── services/
│   ├── product.service.ts           # HTTP/mocks pour produits
│   ├── brand.service.ts             # HTTP/mocks pour marques
│   ├── resource.service.ts          # HTTP/mocks pour ressources
│   └── resource.service.mock.ts     # Données mock (RESTE ICI)
```

---

## 4. Interfaces et modèles

### 4.1 IBrand enrichi (lib)

```typescript
// opti_saas_lib/src/shared/models/brand.model.ts

export interface IBrand {
  readonly id: string;
  readonly code: string; // Code interne OPTI-SAAS (ex: "RAY")
  readonly label: string; // Nom affiché (ex: "Ray-Ban")
  readonly logo: string | null;
  readonly country: string | null;
  readonly order: number | null;
  readonly active: boolean;

  // NOUVEAUX CHAMPS pour matching OCR
  readonly aliases: readonly string[]; // ["RAYBAN", "RB", "R-B"]
  readonly manufacturerCodes: readonly string[]; // Codes fabricant ["RB", "RX"]
  readonly parentCompany: string | null; // "EssilorLuxottica"
  readonly website: string | null;
  readonly productLines: readonly ProductType[]; // Types de produits de la marque
}

export function createEmptyBrand(): IBrand {
  return {
    id: '',
    code: '',
    label: '',
    logo: null,
    country: null,
    order: null,
    active: true,
    aliases: [],
    manufacturerCodes: [],
    parentCompany: null,
    website: null,
    productLines: [],
  };
}
```

### 4.2 IModel enrichi (lib)

```typescript
// opti_saas_lib/src/shared/models/model.model.ts

export interface IModel {
  readonly id: string;
  readonly code: string; // Code interne (ex: "WAY")
  readonly label: string; // Nom (ex: "Wayfarer")
  readonly brandId: string; // ID de la marque (PAS le code!)
  readonly order: number | null;
  readonly active: boolean;

  // NOUVEAUX CHAMPS
  readonly aliases: readonly string[]; // ["WAYFARER", "WF", "2140"]
  readonly manufacturerCode: string | null; // Code fabricant (ex: "RB2140")
  readonly category: string | null; // "optical", "sun", "sport"
  readonly collection: string | null; // "Classic", "Junior"
  readonly discontinued: boolean; // Modèle arrêté
}
```

### 4.3 ISupplierProductCode (lib)

```typescript
// opti_saas_lib/src/shared/models/supplier-code.model.ts

/**
 * Code produit spécifique à un fournisseur.
 * Un même produit peut avoir des codes différents chez différents fournisseurs.
 */
export interface ISupplierProductCode {
  readonly supplierId: string;
  readonly supplierCode: string; // Code du produit chez ce fournisseur
  readonly supplierDesignation: string | null; // Libellé fournisseur
  readonly lastPurchasePrice: number | null;
  readonly lastPurchaseDate: Date | null;
}
```

### 4.4 IBaseProduct enrichi (lib)

```typescript
// opti_saas_lib/src/shared/models/product.model.ts

interface IBaseProduct {
  readonly id: string;
  readonly internalCode: string;
  readonly barcode: string | null; // EAN-13/UPC universel
  readonly productType: ProductType;
  readonly designation: string;
  readonly brandId: string | null;
  readonly modelId: string | null;
  readonly color: string | null;

  // NOUVEAU - Codes fournisseurs
  readonly supplierCodes: readonly ISupplierProductCode[];

  // NOUVEAU - Référence fabricant
  readonly manufacturerRef: string | null; // Ex: "RB2140-901-50"

  // Existants
  readonly supplierIds: readonly string[];
  readonly familyId: string | null;
  readonly subFamilyId: string | null;
  // ... reste inchangé
}
```

### 4.5 Interfaces de matching (lib)

```typescript
// opti_saas_lib/src/shared/product-matching/matching.interfaces.ts

export type MatchMethod =
  | 'barcode'
  | 'supplierCode'
  | 'manufacturerRef'
  | 'fuzzyDesignation'
  | 'manual';
export type MatchConfidence = 'high' | 'medium' | 'low' | 'none';

/**
 * Résultat de l'extraction OCR d'une ligne produit.
 */
export interface IParsedProductInfo {
  readonly rawDesignation: string;
  readonly barcode: string | null;
  readonly reference: string | null;

  // Éléments parsés
  readonly parsedBrand: string | null; // Texte brut extrait
  readonly parsedModel: string | null;
  readonly parsedColor: string | null;
  readonly parsedSize: string | null; // "52-18-145"

  // Confiance
  readonly confidence: number; // 0-1
}

/**
 * Résultat du matching avec la base de données.
 */
export interface IProductMatchResult {
  readonly method: MatchMethod;
  readonly confidence: MatchConfidence;
  readonly score: number; // 0-100

  // Produit trouvé (si match)
  readonly matchedProductId: string | null;

  // Entités matchées
  readonly matchedBrandId: string | null;
  readonly matchedModelId: string | null;

  // Suggestions si pas de match exact
  readonly suggestions: readonly IProductSuggestion[];
}

export interface IProductSuggestion {
  readonly productId: string;
  readonly score: number;
  readonly reason: string; // "Brand matches, model similar"
}
```

---

## 5. Système de matching produits

### 5.1 Pipeline de matching

```
┌─────────────────────────────────────────────────────────────────────┐
│                        OCR Invoice Line                              │
│  reference: "197737121778"                                           │
│  designation: "CH-HER 0298/G/S.807.55.HA"                           │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ÉTAPE 1: Extraction (lib - fonctions pures)                        │
│  ─────────────────────────────────────────────────────────────────  │
│  • parseBarcode() → "197737121778" (EAN-12)                         │
│  • parseDesignation() → brand:"CH-HER", model:"0298", color:"807"   │
│  Résultat: IParsedProductInfo                                       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ÉTAPE 2: Matching (service frontend/backend - accès données)       │
│  ─────────────────────────────────────────────────────────────────  │
│  1. Chercher par barcode EAN → product.barcode === "197737121778"   │
│  2. Si pas trouvé → chercher par supplierCode                       │
│  3. Si pas trouvé → matcher brand "CH-HER" → "Carolina Herrera"     │
│  4. Si brand trouvé → chercher model "0298" dans models de brand    │
│  Résultat: IProductMatchResult                                      │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  RÉSULTAT FINAL                                                      │
│  ─────────────────────────────────────────────────────────────────  │
│  • method: "fuzzyDesignation"                                        │
│  • confidence: "medium"                                              │
│  • matchedBrandId: "brand-8"                                        │
│  • matchedModelId: null (nouveau modèle à créer)                    │
│  • suggestions: [{productId: "prod-x", score: 75}]                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Fonctions pures dans lib

```typescript
// opti_saas_lib/src/shared/product-matching/barcode.matcher.ts

/**
 * Normalise un code-barres (supprime espaces, tirets, vérifie checksum).
 */
export function normalizeBarcode(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-]/g, '');
  if (!/^\d{8,14}$/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Type de code-barres supporté.
 */
export type BarcodeType = 'EAN-8' | 'EAN-13' | 'UPC-A' | 'UPC-E' | 'EAN-14';

/**
 * Détecte le type de code-barres.
 * @param barcode Code-barres normalisé (chiffres uniquement)
 * @returns Type détecté ou null si format non reconnu
 */
export function detectBarcodeType(barcode: string): BarcodeType | null {
  const len = barcode.length;

  // UPC-E : 8 chiffres commençant par 0 ou 1
  if (len === 8 && /^[01]\d{7}$/.test(barcode)) {
    return 'UPC-E';
  }

  // EAN-8 : 8 chiffres (autres cas)
  if (len === 8) {
    return 'EAN-8';
  }

  // UPC-A : 12 chiffres
  if (len === 12) {
    return 'UPC-A';
  }

  // EAN-13 : 13 chiffres
  if (len === 13) {
    return 'EAN-13';
  }

  // EAN-14 : 14 chiffres (indicateur logistique + EAN-13)
  if (len === 14) {
    return 'EAN-14';
  }

  return null;
}

/**
 * Valide le checksum d'un code-barres EAN-13 ou UPC-A.
 * @param barcode Code-barres à valider
 * @returns true si checksum valide
 */
export function validateBarcodeChecksum(barcode: string): boolean {
  if (!/^\d{12,13}$/.test(barcode)) return false;

  const digits = barcode.split('').map(Number);
  const check = digits.pop()!;

  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }

  const calculated = (10 - (sum % 10)) % 10;
  return calculated === check;
}
```

```typescript
// opti_saas_lib/src/shared/product-matching/designation.parser.ts

import { IBrand, IModel } from '../models';

/**
 * Parse une désignation pour en extraire les composants.
 * Fonction PURE - ne dépend d'aucune donnée externe.
 */
export function parseDesignation(designation: string): IParsedProductInfo {
  const result: IParsedProductInfo = {
    rawDesignation: designation,
    barcode: null,
    reference: null,
    parsedBrand: null,
    parsedModel: null,
    parsedColor: null,
    parsedSize: null,
    confidence: 0,
  };

  // Patterns communs optique
  // Format: BRAND MODEL COLOR SIZE ou BRAND-MODEL/COLOR.SIZE

  // Pattern 1: "RB2140 901 50-22-150"
  const pattern1 = /^([A-Z]{2,4})(\d{4})\s+(\w+)\s+(\d{2}[-/]\d{2}[-/]\d{3})$/i;

  // Pattern 2: "CH-HER 0298/G/S.807.55"
  const pattern2 = /^([A-Z\-]+)\s+(\d+)[\/\.]([A-Z])[\/\.]([A-Z])\.(\d+)\.(\d+)/i;

  // ... autres patterns selon types de produits

  return result;
}

/**
 * Normalise un nom de marque pour comparaison.
 */
export function normalizeBrandName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[\s\-_\.]/g, '')
    .replace(/&/g, 'AND');
}

/**
 * Calcule un score de similarité entre deux chaînes.
 */
export function calculateSimilarity(a: string, b: string): number {
  // Levenshtein ou Jaro-Winkler
  // ...
  return 0;
}
```

### 5.3 Service de matching (frontend)

```typescript
// frontend/src/app/shared/services/product-matching.service.ts

import { Injectable, inject } from '@angular/core';
import {
  IParsedProductInfo,
  IProductMatchResult,
  parseDesignation,
  normalizeBarcode,
  normalizeBrandName,
  calculateSimilarity,
} from '@optisaas/opti-saas-lib';
import { ResourceStore } from '@app/core/store/resource.store';
import { ProductService } from './product.service';

@Injectable({ providedIn: 'root' })
export class ProductMatchingService {
  readonly #resourceStore = inject(ResourceStore);
  readonly #productService = inject(ProductService);

  /**
   * Effectue le matching complet d'une ligne OCR.
   * Utilise les fonctions pures de la lib + accès données.
   */
  async matchProduct(
    reference: string | null,
    designation: string,
    supplierId: string | null,
  ): Promise<IProductMatchResult> {
    // 1. Parse la désignation (fonction pure lib)
    const parsed = parseDesignation(designation);

    // 2. Chercher par barcode si présent
    if (reference) {
      const barcode = normalizeBarcode(reference);
      if (barcode) {
        const byBarcode = await this.#matchByBarcode(barcode);
        if (byBarcode.matchedProductId) return byBarcode;
      }
    }

    // 3. Chercher par code fournisseur
    if (reference && supplierId) {
      const bySupplierCode = await this.#matchBySupplierCode(reference, supplierId);
      if (bySupplierCode.matchedProductId) return bySupplierCode;
    }

    // 4. Matching fuzzy par désignation
    return this.#matchByDesignation(parsed);
  }

  /**
   * Match une marque parsée avec les marques BDD.
   */
  matchBrand(parsedBrand: string): { brandId: string; score: number } | null {
    const brands = this.#resourceStore.brands();
    const normalized = normalizeBrandName(parsedBrand);

    for (const brand of brands) {
      // Check code exact
      if (brand.code === normalized) {
        return { brandId: brand.id, score: 100 };
      }

      // Check label normalisé
      if (normalizeBrandName(brand.label) === normalized) {
        return { brandId: brand.id, score: 95 };
      }

      // Check aliases
      for (const alias of brand.aliases ?? []) {
        if (normalizeBrandName(alias) === normalized) {
          return { brandId: brand.id, score: 90 };
        }
      }

      // Check similarité
      const similarity = calculateSimilarity(normalized, normalizeBrandName(brand.label));
      if (similarity > 0.85) {
        return { brandId: brand.id, score: Math.round(similarity * 100) };
      }
    }

    return null;
  }

  // ... méthodes privées #matchByBarcode, #matchBySupplierCode, etc.
}
```

---

## 6. Plan d'implémentation

### Phase 1 : Migration interfaces vers lib (PRIORITÉ HAUTE)

**Objectif** : Centraliser toutes les interfaces métier dans la lib.

1. Créer `opti_saas_lib/src/shared/models/`
2. Déplacer/créer les interfaces enrichies
3. Exporter depuis `opti_saas_lib/src/shared/index.ts`
4. Mettre à jour les imports frontend

**Fichiers à créer dans lib** :

- `models/address.model.ts`
- `models/brand.model.ts` (enrichi)
- `models/model.model.ts` (enrichi)
- `models/manufacturer.model.ts` (enrichi)
- `models/laboratory.model.ts` (enrichi)
- `models/supplier.model.ts`
- `models/supplier-code.model.ts`
- `models/product.model.ts` (enrichi)
- `models/resource.model.ts`
- `models/family.model.ts`
- `models/color.model.ts`
- `models/index.ts`

**Fichiers frontend à modifier** :

- `shared/models/index.ts` → ré-export depuis lib
- Supprimer les fichiers dupliqués

### Phase 2 : Fonctions de parsing produits (lib)

**Objectif** : Extraire marque/modèle/couleur depuis désignation OCR.

1. Créer `opti_saas_lib/src/shared/product-matching/`
2. Implémenter parsers par type de produit
3. Ajouter patterns optiques (marques, modèles)

**Fichiers à créer dans lib** :

- `product-matching/matching.interfaces.ts`
- `product-matching/barcode.matcher.ts`
- `product-matching/designation.parser.ts`
- `product-matching/frame.patterns.ts`
- `product-matching/lens.patterns.ts`
- `product-matching/contact-lens.patterns.ts`
- `product-matching/index.ts`

### Phase 3 : Service matching frontend

**Objectif** : Combiner parsing lib + données BDD.

1. Créer `ProductMatchingService`
2. Intégrer dans `stock-entry.store.ts`
3. Enrichir les mocks avec aliases

**Fichiers à créer/modifier** :

- `shared/services/product-matching.service.ts`
- `stock-entry/stock-entry.store.ts` (intégration)
- `shared/services/resource.service.mock.ts` (enrichir brands/models)

### Phase 4 : UI feedback matching

**Objectif** : Afficher résultats matching dans stock-entry.

1. Indicateurs de confiance par ligne
2. Suggestions si pas de match exact
3. Dialog création rapide si nouveau produit

---

## Résumé des bénéfices

| Aspect                 | Avant                       | Après                                       |
| ---------------------- | --------------------------- | ------------------------------------------- |
| **Interfaces**         | Dupliquées frontend/backend | Source unique dans lib                      |
| **Matching**           | Inexistant                  | Pipeline complet avec 4 méthodes            |
| **Maintenance**        | Modifications à 2 endroits  | Une seule modification                      |
| **Types produits**     | Montures seulement          | Montures + Verres + Lentilles + Accessoires |
| **Confiance OCR**      | Non trackée                 | Score 0-100 par ligne                       |
| **Codes fournisseurs** | Non gérés                   | Multi-fournisseurs par produit              |

---

## 7. Informations complémentaires

### 7.1 Interfaces actuelles frontend (à migrer vers lib)

Les interfaces suivantes sont actuellement dans `frontend/src/app/shared/models/` et doivent être migrées vers la lib :

```typescript
// brand.model.ts - ACTUEL
export interface IBrand {
  id: string;
  code: string;
  label: string;
  logo: string | null;
  country: string | null;
  order: number | null;
  active: boolean;
}

// model.model.ts - ACTUEL
export interface IModel {
  id: string;
  code: string;
  label: string;
  brandId: string | null; // BUG: stocke le CODE pas l'ID!
  order: number | null;
  active: boolean;
}

// manufacturer.model.ts - ACTUEL (pour verres)
export interface IManufacturer {
  id: string;
  code: string;
  label: string;
  country: string | null;
  contact: string | null;
  order: number | null;
  active: boolean;
}

// laboratory.model.ts - ACTUEL (pour lentilles)
export interface ILaboratory {
  id: string;
  code: string;
  label: string;
  country: string | null;
  order: number | null;
  active: boolean;
}
```

### 7.2 ISupplier actuel (déjà enrichi)

```typescript
// supplier.model.ts - ACTUEL (déjà complet)
export interface ISupplier {
  id: string | null; // null = nouveau fournisseur
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: IAddress;
  contactName: string | null;
  website: string | null;
  ice: string | null; // Identifiant Commun Entreprise (Maroc)
  tradeRegister: string | null; // RC
  taxId: string | null; // IF
  businessLicense: string | null; // Patente
  siret: string | null; // France
  bank: string | null;
  bankAccountNumber: string | null;
  active: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}
```

### 7.3 IProduct actuel (polymorphique)

Le modèle produit est polymorphique avec un `IBaseProduct` et des interfaces spécialisées :

```typescript
// Types de produits
export type ProductType = 'optical_frame' | 'sun_frame' | 'lens' | 'contact_lens' | 'accessory';

// Union type
export type Product = IFrame | ILens | IContactLens | IAccessory;

// Chaque type a des champs spécifiques :
// - IFrame : eyeSize, bridge, temple, frameColor, templeColor...
// - ILens : lensType, refractiveIndex, spherePower, manufacturerId...
// - IContactLens : laboratoryId, baseCurve, diameter, quantityPerBox...
// - IAccessory : category, subCategory...
```

### 7.4 Structure OCR existante dans lib

L'OCR extrait actuellement ces données depuis `IInvoiceLine` :

```typescript
// opti_saas_lib/src/shared/ocr/supplier-invoice.models.ts
export interface IInvoiceLine {
  reference: string | null; // Code-barres ou référence fournisseur
  designation: string; // Description texte (contient marque/modèle)
  quantity: number;
  unit: string | null;
  unitPriceHT: number;
  discountRate: number | null;
  totalHT: number;
  vatRate: number | null;
}
```

**Gap identifié** : Pas de champ `parsedProduct` pour stocker le résultat du parsing marque/modèle.

### 7.5 Enrichissement mocks requis

Les mocks dans `resource.service.mock.ts` devront être enrichis avec les nouveaux champs :

```typescript
// Exemple MOCK_BRANDS enrichi
export const MOCK_BRANDS: IBrand[] = [
  {
    id: 'brand-1',
    code: 'RAY',
    label: 'Ray-Ban',
    logo: null,
    country: 'Italie',
    order: 1,
    active: true,
    // NOUVEAUX CHAMPS
    aliases: ['RAYBAN', 'RB', 'R-B', 'RAY BAN'],
    manufacturerCodes: ['RB', 'RX'],
    parentCompany: 'EssilorLuxottica',
    website: 'https://www.ray-ban.com',
    productLines: ['optical_frame', 'sun_frame'],
  },
  // ...
];
```

### 7.6 Dépendances entre phases

```
Phase 1 (Interfaces lib)
    │
    ├──► Phase 2 (Fonctions parsing lib)
    │         │
    │         └──► Phase 3 (Service matching frontend)
    │                   │
    │                   └──► Phase 4 (UI feedback)
    │
    └──► Enrichissement mocks (peut être fait en parallèle)
```

### 7.7 Checklist de validation par phase

**Phase 1 - Interfaces lib** :

- [ ] Toutes les interfaces créées dans `opti_saas_lib/src/shared/models/`
- [ ] Export depuis `opti_saas_lib/src/shared/index.ts`
- [ ] `npm run build` dans lib OK
- [ ] Frontend importe depuis `@optisaas/opti-saas-lib`
- [ ] Plus de duplication d'interfaces
- [ ] Bug `brandId` corrigé dans mocks

**Phase 2 - Parsing lib** :

- [ ] `parseDesignation()` fonctionne pour frames
- [ ] `parseDesignation()` fonctionne pour lenses
- [ ] `normalizeBarcode()` gère EAN-8/13, UPC-A
- [ ] Tests unitaires dans lib

**Phase 3 - Service frontend** :

- [ ] `ProductMatchingService` créé
- [ ] Matching par barcode fonctionne
- [ ] Matching par supplierCode fonctionne
- [ ] Matching fuzzy par désignation fonctionne
- [ ] Intégration dans `stock-entry.store.ts`

**Phase 4 - UI** :

- [ ] Indicateur confiance visible par ligne
- [ ] Suggestions affichées si pas de match exact
- [ ] Dialog création produit si nouveau

---

## 8. Conformité avec les normes du projet (CLAUDE.md)

### 8.1 Règles à respecter

| Règle CLAUDE.md                          | Application dans ce plan                                           |
| ---------------------------------------- | ------------------------------------------------------------------ |
| **Interfaces dans `*.model.ts`**         | ✅ Créer dans `lib/src/shared/models/*.model.ts`                   |
| **Pas de `?` pour optionnel**            | ✅ Utiliser `\| null` partout                                      |
| **ID nullable = nouveau**                | ✅ `id: string \| null` (null = nouvelle entité)                   |
| **UI fields prefix `_`**                 | ✅ `_matchResult`, `_ocrConfidence` dans IStockEntryProductFormRow |
| **signalState pour features légères**    | ✅ stock-entry utilise déjà `signalState` - ne pas changer         |
| **ResourceStore pour données partagées** | ✅ brands/models via ResourceStore, pas de constantes              |
| **JSDoc obligatoire**                    | ✅ Toutes les fonctions avec `@param` et `@returns`                |
| **Pas de séparateurs `// =====`**        | ✅ Code propre sans séparateurs                                    |
| **Services partagés**                    | ✅ `ProductMatchingService` dans `shared/services/`                |
| **catchError pas tapResponse**           | ✅ Déjà utilisé dans stock-entry.store                             |
| **Pas de fichiers `.scss`**              | ✅ Utiliser classes Tailwind/globales uniquement                   |

### 8.2 Intégration avec stock-entry existant

Le store `stock-entry.store.ts` a **déjà** :

- ✅ `findSupplierByIdentifiers()` - Matching supplier par ICE/taxId/tradeRegister
- ✅ `computeSupplierDiffs()` - Calcul des différences OCR vs BDD
- ✅ `createSupplierFromOcr()` - Création supplier depuis OCR
- ✅ `mergeSupplierWithOcr()` - Fusion des champs acceptés
- ✅ `loadFromOcr()` - Chargement facture OCR

**Ce qui MANQUE** (à ajouter) :

- ❌ Matching **produit** par barcode/supplierCode/désignation
- ❌ `_matchResult` dans `IStockEntryProductFormRow`
- ❌ Enrichissement brands/models avec aliases pour matching fuzzy

### 8.3 Pattern UI fields existant

```typescript
// stock-entry/models/stock-entry.model.ts - PATTERN EXISTANT
interface IStockEntryProductFormRow {
  readonly _rowId: string; // ✅ UI field existant
  readonly _isExpanded: boolean; // ✅ UI field existant
  // À AJOUTER (même pattern) :
  readonly _matchResult: IProductMatchResult | null;
  readonly _ocrConfidence: number | null;
}
```

### 8.4 Fichiers référence à consulter AVANT d'implémenter

| Fichier                    | Pourquoi                                 |
| -------------------------- | ---------------------------------------- |
| `stock-entry.store.ts`     | Pattern signalState, méthodes existantes |
| `stock-entry.model.ts`     | Interfaces existantes, pattern UI fields |
| `resource.service.mock.ts` | Structure mocks à enrichir               |
| `product.service.ts`       | Pattern service HTTP existant            |

---

## 9. Plan détaillé des modifications

### Phase 1 : Migration interfaces vers lib

#### 1.1 Fichiers à CRÉER dans `opti_saas_lib/src/shared/models/`

| Fichier                  | Contenu                                                                           | Basé sur                                                             |
| ------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `index.ts`               | Exports de tous les models                                                        | Nouveau                                                              |
| `address.model.ts`       | `IAddress`, `createEmptyAddress()`                                                | `frontend/.../address.model.ts`                                      |
| `brand.model.ts`         | `IBrand` enrichi + `createEmptyBrand()`                                           | `frontend/.../brand.model.ts` + nouveaux champs                      |
| `model.model.ts`         | `IModel` enrichi + `createEmptyModel()`                                           | `frontend/.../model.model.ts` + nouveaux champs                      |
| `manufacturer.model.ts`  | `IManufacturer` enrichi                                                           | `frontend/.../manufacturer.model.ts` + nouveaux champs               |
| `laboratory.model.ts`    | `ILaboratory` enrichi                                                             | `frontend/.../laboratory.model.ts` + nouveaux champs                 |
| `supplier.model.ts`      | `ISupplier`, `ISupplierSearchRequest`, `createEmptySupplier()`                    | `frontend/.../supplier.model.ts` (copie)                             |
| `supplier-code.model.ts` | `ISupplierProductCode`                                                            | Nouveau                                                              |
| `product.model.ts`       | `IBaseProduct`, `IFrame`, `ILens`, `IContactLens`, `IAccessory`, `Product`, types | `frontend/.../product.model.ts` + `supplierCodes`, `manufacturerRef` |
| `resource.model.ts`      | `IResource`, `ResourceType`, `ResourceMap`                                        | `frontend/.../resource.model.ts`                                     |
| `family.model.ts`        | `IFamily`, `ISubFamily`                                                           | `frontend/.../family.model.ts`                                       |
| `color.model.ts`         | `IColor`                                                                          | `frontend/.../color.model.ts`                                        |

#### 1.2 Fichier à MODIFIER dans `opti_saas_lib/src/shared/`

```typescript
// opti_saas_lib/src/shared/index.ts - AJOUTER
export * from './models';
```

#### 1.3 Fichiers à MODIFIER dans `frontend/src/app/shared/models/`

| Fichier                 | Action                                                                 |
| ----------------------- | ---------------------------------------------------------------------- |
| `index.ts`              | Remplacer exports locaux par `export * from '@optisaas/opti-saas-lib'` |
| `address.model.ts`      | SUPPRIMER (ou ré-export depuis lib)                                    |
| `brand.model.ts`        | SUPPRIMER                                                              |
| `model.model.ts`        | SUPPRIMER                                                              |
| `manufacturer.model.ts` | SUPPRIMER                                                              |
| `laboratory.model.ts`   | SUPPRIMER                                                              |
| `supplier.model.ts`     | SUPPRIMER                                                              |
| `product.model.ts`      | SUPPRIMER                                                              |
| `resource.model.ts`     | SUPPRIMER                                                              |
| `family.model.ts`       | SUPPRIMER                                                              |
| `color.model.ts`        | SUPPRIMER                                                              |

#### 1.4 Fichier à MODIFIER dans `frontend/src/app/shared/services/`

```typescript
// resource.service.mock.ts - MODIFIER
// 1. Corriger MOCK_MODELS.brandId (CODE → ID)
// 2. Enrichir MOCK_BRANDS avec aliases, manufacturerCodes, etc.
// 3. Enrichir MOCK_MODELS avec aliases, manufacturerCode, etc.
// 4. Enrichir MOCK_MANUFACTURERS avec aliases, productLines, etc.
// 5. Enrichir MOCK_LABORATORIES avec aliases, productLines, etc.
```

#### 1.5 Commandes à exécuter

```bash
# 1. Dans opti_saas_lib
cd ../opti_saas_lib
npm run build

# 2. Dans frontend
cd ../frontend
npm run build
```

---

### Phase 2 : Fonctions de parsing (lib)

#### 2.1 Fichiers à CRÉER dans `opti_saas_lib/src/shared/product-matching/`

| Fichier                    | Contenu                                                                  |
| -------------------------- | ------------------------------------------------------------------------ |
| `index.ts`                 | Exports                                                                  |
| `matching.interfaces.ts`   | `IParsedProductInfo`, `IProductMatchResult`, `IProductSuggestion`, types |
| `barcode.matcher.ts`       | `normalizeBarcode()`, `detectBarcodeType()`, `validateEAN13Checksum()`   |
| `designation.parser.ts`    | `parseDesignation()`, `normalizeBrandName()`, `calculateSimilarity()`    |
| `frame.patterns.ts`        | Patterns regex pour montures optiques                                    |
| `lens.patterns.ts`         | Patterns regex pour verres                                               |
| `contact-lens.patterns.ts` | Patterns regex pour lentilles                                            |

#### 2.2 Fichier à MODIFIER

```typescript
// opti_saas_lib/src/shared/index.ts - AJOUTER
export * from './product-matching';
```

---

### Phase 3 : Service matching (frontend)

#### 3.1 Fichiers à CRÉER

| Fichier                                                    | Contenu                                 |
| ---------------------------------------------------------- | --------------------------------------- |
| `frontend/.../shared/services/product-matching.service.ts` | Service Angular combinant lib + données |

#### 3.2 Fichiers à MODIFIER

| Fichier                                                | Modification                              |
| ------------------------------------------------------ | ----------------------------------------- |
| `frontend/.../shared/services/index.ts`                | Exporter `ProductMatchingService`         |
| `frontend/.../stock-entry/stock-entry.store.ts`        | Intégrer matching dans `loadFromOcr()`    |
| `frontend/.../stock-entry/models/stock-entry.model.ts` | Ajouter `_matchResult` à `IStockEntryRow` |

---

### Phase 4 : UI feedback (frontend)

#### 4.1 Fichiers à MODIFIER

| Fichier                          | Modification                              |
| -------------------------------- | ----------------------------------------- |
| `stock-entry-row.component.ts`   | Afficher indicateur confiance             |
| `stock-entry-row.component.html` | Template indicateur + tooltip suggestions |
| `stock-entry-table.component.ts` | Gérer tri/filtre par confiance            |

#### 4.2 Fichiers à CRÉER (optionnel)

| Fichier                                   | Contenu                                   |
| ----------------------------------------- | ----------------------------------------- |
| `product-match-indicator.component.ts`    | Composant standalone indicateur confiance |
| `product-suggestions-dialog.component.ts` | Dialog suggestions si pas de match        |

---

## 9. Ordre d'exécution recommandé

```
ÉTAPE 1: Créer models/ dans lib
         └─► Créer toutes les interfaces
         └─► Exporter depuis index.ts
         └─► npm run build (lib)

ÉTAPE 2: Migrer frontend
         └─► Modifier shared/models/index.ts (ré-export lib)
         └─► Supprimer fichiers locaux
         └─► Corriger imports si nécessaire
         └─► npm run build (frontend)

ÉTAPE 3: Enrichir mocks
         └─► Ajouter nouveaux champs aux mocks
         └─► Corriger bug brandId
         └─► npm run build (frontend)

ÉTAPE 4: Créer product-matching/ dans lib
         └─► Interfaces matching
         └─► Fonctions pures parsing
         └─► npm run build (lib)

ÉTAPE 5: Service frontend
         └─► ProductMatchingService
         └─► Intégration stock-entry.store
         └─► npm run build (frontend)

ÉTAPE 6: UI
         └─► Indicateurs visuels
         └─► Tests manuels
```

---

## 10. Décisions validées

### 10.1 Questions résolues

**Q1 : Codes produits ✅**

Liste complète des codes supportés documentée dans la section "Quick Reference - Codes produits".
Priorité de matching : EAN → Code fournisseur → Référence fabricant → Désignation fuzzy.

**Q2 : ISupplierProductCode - où le stocker ? ✅**

**Décision : Option A - Embarqué dans `IBaseProduct.supplierCodes[]`**

Raisons :

- Cohérence avec le modèle de données (un produit = une entité complète)
- Pas de jointures complexes
- Facilite la sérialisation/désérialisation
- Pattern déjà utilisé pour `supplierIds[]`

**Q3 : Interfaces de matching - dans lib ou stock-entry ? ✅**

**Décision : Option A - Dans `lib/shared/product-matching/`**

Raisons :

- Réutilisable par frontend ET backend
- Cohérent avec l'architecture "lib = source unique"
- Permettra au backend de faire du matching aussi (import automatique, API)

**Q4 : Scope Phase 1 - migration progressive ou big bang ? ✅**

**Décision : Big bang avec filet de sécurité**

Stratégie :

1. Créer TOUTES les interfaces dans lib d'abord (sans toucher frontend)
2. `npm run build` dans lib pour valider
3. Modifier frontend pour importer depuis lib
4. `npm run build` dans frontend pour valider
5. Supprimer les anciens fichiers SEULEMENT après validation

Avantages :

- Plus performant (pas d'états intermédiaires instables)
- Évite les imports mixtes (lib + local)
- Filet de sécurité : on ne supprime qu'après validation du build

### 10.2 Enrichissement des interfaces (validé)

```typescript
// IBrand - NOUVEAUX CHAMPS VALIDÉS
aliases: readonly string[];           // ["RAYBAN", "RB"] pour matching
manufacturerCodes: readonly string[]; // Codes fabricant
parentCompany: string | null;         // Groupe (EssilorLuxottica)
website: string | null;
productLines: readonly ProductType[]; // Types produits de la marque

// IModel - NOUVEAUX CHAMPS VALIDÉS
aliases: readonly string[];           // Alias pour matching
manufacturerCode: string | null;      // Code fabricant (RB2140)
category: string | null;              // optical/sun/sport
collection: string | null;            // Gamme
discontinued: boolean;                // Arrêté ?
```

### 10.3 Risques identifiés

| Risque                    | Mitigation                                  |
| ------------------------- | ------------------------------------------- |
| Breaking changes frontend | Build après chaque étape                    |
| Imports cassés            | Recherche globale `from '@app/models'`      |
| Mocks incompatibles       | Enrichir mocks AVANT de modifier interfaces |
| Régression stock-entry    | Tester manuellement après intégration       |

### 10.4 Estimation effort

| Phase                      | Complexité | Fichiers     |
| -------------------------- | ---------- | ------------ |
| Phase 1 - Interfaces lib   | Moyenne    | ~15 fichiers |
| Phase 2 - Parsing lib      | Haute      | ~8 fichiers  |
| Phase 3 - Service frontend | Moyenne    | ~4 fichiers  |
| Phase 4 - UI               | Basse      | ~3 fichiers  |

---

## 11. Base de données optique (Seed Data)

### 11.1 Fichier créé

**Emplacement** : `src/app/shared/data/optical-database.seed.ts`

Ce fichier contient les données réelles de l'industrie optique pour alimenter la BDD :

| Entité                                         | Nombre | Exemples                                            |
| ---------------------------------------------- | ------ | --------------------------------------------------- |
| **Marques (SEED_BRANDS)**                      | 50+    | Ray-Ban, Oakley, Gucci, Prada, Dior...              |
| **Modèles (SEED_MODELS)**                      | 50+    | Wayfarer, Aviator, Holbrook, Frogskins...           |
| **Fabricants verres (SEED_MANUFACTURERS)**     | 9      | Essilor, Zeiss, Hoya, Rodenstock...                 |
| **Laboratoires lentilles (SEED_LABORATORIES)** | 8      | Acuvue (J&J), Alcon, Bausch & Lomb, CooperVision... |

### 11.2 Groupes/Holdings couverts

- **EssilorLuxottica** : Ray-Ban, Oakley, Persol, Vogue, Oliver Peoples + licences (Prada, Chanel, Versace, D&G, Armani, Burberry, Coach, Michael Kors, Tiffany, Ralph Lauren)
- **Safilo Group** : Carrera, Polaroid, Smith + licences (Dior, Fendi, Givenchy, Hugo Boss, Marc Jacobs, Tommy Hilfiger, Kate Spade, Levi's)
- **Marcolin Group** : Tom Ford, Guess, Moncler, ic! berlin, Adidas
- **Kering Eyewear** : Gucci, Saint Laurent, Bottega Veneta, Balenciaga, Alexander McQueen, Puma
- **De Rigo Vision** : Police, Chopard, Fila
- **Marchon Eyewear** : Lacoste, Calvin Klein, Nike Vision, Dragon
- **Silhouette International** : Silhouette

### 11.3 Structure des données

```typescript
interface ISeedBrand {
  code: string; // "RAY"
  label: string; // "Ray-Ban"
  aliases: string[]; // ["RAYBAN", "RB", "R-B"]
  manufacturerCodes: string[]; // ["RB", "RX", "RJ"]
  parentCompany: string; // "EssilorLuxottica"
  country: string; // "Italie"
  website: string;
  productLines: ProductType[];
  order: number;
}
```

### 11.4 Utilisation

1. **Mocks temporaires** : Importer dans `resource.service.mock.ts`
2. **Seed BDD** : Créer endpoint backend `/api/seed/optical-database`
3. **Matching OCR** : Les `aliases` et `manufacturerCodes` permettent le matching fuzzy

---

## 12. Adaptations requises - Feature Product

> ⚠️ **À faire dans une session dédiée** - Ces adaptations concernent la feature Product existante pour supporter les nouveaux champs nécessaires au matching.

### 12.1 Contexte

La feature Product actuelle ne gère pas :

- Les codes produits fournisseurs (un même produit peut avoir différents codes selon les fournisseurs)
- La référence fabricant (code officiel du fabricant)
- Le lien avec la marque enrichie (avec aliases pour le matching)

Ces champs sont essentiels pour :

1. **Matching OCR** : Retrouver un produit à partir d'un code scanné sur facture
2. **Multi-fournisseurs** : Gérer différents codes pour le même produit
3. **Historique prix** : Suivre les prix d'achat par fournisseur

### 12.2 Fichiers à modifier

| Fichier                                | Modification                                            |
| -------------------------------------- | ------------------------------------------------------- |
| `shared/models/product.model.ts`       | Enrichir `IBaseProduct` avec nouveaux champs            |
| `product/models/product-form.model.ts` | Adapter le form model pour les nouveaux champs          |
| `product/components/product-form/`     | Ajouter section "Codes fournisseurs" dans le formulaire |
| `product/product.store.ts`             | Gérer nouveaux champs dans CRUD                         |
| `shared/services/product.service.ts`   | Adapter les appels API                                  |

### 12.3 Nouveaux champs IBaseProduct

```typescript
// À ajouter dans IBaseProduct (shared/models/product.model.ts)
interface IBaseProduct {
  // ... champs existants ...

  // NOUVEAUX CHAMPS
  readonly manufacturerRef: string | null; // Code officiel fabricant (ex: "RB2140")
  readonly supplierCodes: readonly ISupplierProductCode[]; // Codes par fournisseur
}

interface ISupplierProductCode {
  readonly supplierId: string;
  readonly code: string; // Code produit chez ce fournisseur
  readonly lastPurchasePrice: number | null;
  readonly lastPurchaseDate: string | null;
}
```

### 12.4 UI Product Form - Nouvelle section

Ajouter un `mat-expansion-panel` "Codes fournisseurs" permettant :

| Fonctionnalité      | Détail                                                        |
| ------------------- | ------------------------------------------------------------- |
| **Liste des codes** | Tableau avec colonnes : Fournisseur, Code, Dernier prix, Date |
| **Ajouter code**    | Autocomplete fournisseur + input code                         |
| **Supprimer code**  | Bouton supprimer par ligne                                    |
| **Historique**      | Afficher dernier prix/date automatiquement (readonly)         |

```html
<!-- Exemple de structure -->
<mat-expansion-panel>
  <mat-expansion-panel-header>
    <mat-panel-title>Codes fournisseurs</mat-panel-title>
    <mat-panel-description>
      {{ supplierCodes().length }} code(s) enregistré(s)
    </mat-panel-description>
  </mat-expansion-panel-header>

  <table mat-table [dataSource]="supplierCodes()">
    <!-- Colonnes : Fournisseur, Code, Prix, Date, Actions -->
  </table>

  <button mat-button (click)="addSupplierCode()"><mat-icon>add</mat-icon> Ajouter un code</button>
</mat-expansion-panel>
```

### 12.5 Form Model adapté

```typescript
// product-form.model.ts - Ajouter
interface IProductForm {
  // ... champs existants ...

  manufacturerRef: string | null;
  supplierCodes: ISupplierProductCodeForm[];
}

interface ISupplierProductCodeForm {
  supplierId: string | null;
  code: string;
}

// Helper
function getDefaultProductForm(): IProductForm {
  return {
    // ... existants ...
    manufacturerRef: null,
    supplierCodes: [],
  };
}
```

### 12.6 Priorité et dépendances

| Ordre | Tâche                                      | Dépendance |
| ----- | ------------------------------------------ | ---------- |
| 1     | Modifier `IBaseProduct` dans shared/models | Aucune     |
| 2     | Adapter `IProductForm` dans product/models | Tâche 1    |
| 3     | Modifier `product-form.component.ts`       | Tâches 1-2 |
| 4     | Adapter le store et service                | Tâches 1-3 |
| 5     | Tester le formulaire complet               | Tâches 1-4 |

### 12.7 Impact sur les mocks

Mettre à jour `product.service.mock.ts` pour inclure des exemples :

```typescript
const MOCK_PRODUCTS: IProduct[] = [
  {
    id: '1',
    designation: 'Ray-Ban Wayfarer RB2140',
    manufacturerRef: 'RB2140',
    supplierCodes: [
      {
        supplierId: 'sup-1',
        code: 'RB-WAY-001',
        lastPurchasePrice: 85,
        lastPurchaseDate: '2026-01-15',
      },
      {
        supplierId: 'sup-2',
        code: 'RAYBAN-2140',
        lastPurchasePrice: 82,
        lastPurchaseDate: '2026-01-10',
      },
    ],
    // ...
  },
];
```

---

## 13. Prompt pour nouvelle session

```
Lis les fichiers suivants dans l'ordre :
1. CLAUDE.md (normes du projet)
2. docs/specs/product-matching-architecture.spec.md (ce plan)
3. src/app/shared/data/optical-database.seed.ts (base de données optique)

Puis exécute le plan section 9 "Ordre d'exécution recommandé",
en commençant par l'ÉTAPE 1.

Contexte :
- opti_saas_lib est dans ../opti_saas_lib (lien local)
- Le store stock-entry.store.ts utilise signalState (pas signalStore)
- Les interfaces doivent aller dans lib, les mocks restent dans frontend
- Toujours npm run build après chaque modification
- Base de données optique disponible dans shared/data/

Valide chaque étape avant de passer à la suivante.
```
