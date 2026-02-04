# Architecture Product Matching OCR - Documentation Technique

> **Version**: 2.0.0
> **Date**: 2026-01-21
> **Statut**: ✅ Implémenté

---

## Quick Reference - Claude AI

### Fichiers clés

| Besoin                          | Fichier                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Service matching**            | `shared/services/product-matching.service.ts`                                                  |
| **Indicateur confiance UI**     | `stock-entry/components/match-confidence-indicator/`                                           |
| **Interfaces matching (lib)**   | `opti_saas_lib/src/shared/product-matching/matching.interfaces.ts`                             |
| **Parser désignation (lib)**    | `opti_saas_lib/src/shared/product-matching/designation.parser.ts`                              |
| **Parser Safilo (lib)**         | `opti_saas_lib/src/shared/product-matching/designation.parser.ts` → `parseSafiloDesignation()` |
| **Patterns marques (lib)**      | `opti_saas_lib/src/shared/product-matching/frame.patterns.ts`                                  |
| **Normalisation barcode (lib)** | `opti_saas_lib/src/shared/product-matching/barcode.matcher.ts`                                 |
| **Models métier (lib)**         | `opti_saas_lib/src/shared/models/`                                                             |
| **Seed data optique**           | `shared/data/optical-database.seed.ts`                                                         |

### Fonctions principales (lib)

| Fonction                              | Usage                                      |
| ------------------------------------- | ------------------------------------------ |
| `parseSafiloDesignation(designation)` | Parse format Safilo → `IParsedProductInfo` |
| `parseDesignation(designation)`       | Parse générique multi-format               |
| `normalizeBarcode(code)`              | Normalise EAN-8/13, UPC-A/E                |
| `normalizeBrandName(name)`            | Normalise nom marque pour matching         |
| `calculateSimilarity(a, b)`           | Score similarité Levenshtein (0-1)         |
| `categoryToProductType(category)`     | `ProductCategory` → `ProductType`          |
| `categoryToFrameSubType(category)`    | `ProductCategory` → `FrameSubType`         |
| `scoreToConfidence(score)`            | Score (0-100) → `MatchConfidence`          |

### Priorité de matching

```
1. EAN-13/EAN-8/UPC-A/UPC-E → Match EXACT (confiance 100%)
2. Code fournisseur + supplierId → Match par relation (confiance 95%)
3. Référence fabricant → Match exact ou fuzzy (confiance 85-95%)
4. Désignation → Parsing marque/modèle/couleur (confiance 50-80%)
```

---

## 1. Vue d'ensemble

### 1.1 Objectif

Extraction automatique des informations produits (marque, modèle, couleur, taille) depuis les factures fournisseurs OCR, avec matching intelligent vers la base de données produits.

### 1.2 Domaine métier : Optique

| Type produit                | Exemples marques       | Interface lib  |
| --------------------------- | ---------------------- | -------------- |
| **Montures** (optical, sun) | Ray-Ban, Oakley, Gucci | `IFrame`       |
| **Verres ophtalmiques**     | Essilor, Zeiss, Hoya   | `ILens`        |
| **Lentilles de contact**    | Acuvue, Bausch & Lomb  | `IContactLens` |
| **Clip-ons**                | -                      | `IClipOn`      |
| **Accessoires**             | Étuis, chiffons        | `IAccessory`   |

### 1.3 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │ stock-entry.store   │───►│ ProductMatchingService          │ │
│  │                     │    │ - matchProduct()                │ │
│  │ loadFromOcr()       │    │ - matchBrand()                  │ │
│  └─────────────────────┘    │ - matchModel()                  │ │
│                             │ - #brandCache (computed O(1))   │ │
│                             │ - #modelCache (computed O(1))   │ │
│                             └───────────────┬─────────────────┘ │
│                                             │                   │
│  ┌──────────────────────────────────────────┼─────────────────┐ │
│  │                    IMPORTS               ▼                 │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │               @optisaas/opti-saas-lib               │  │ │
│  │  │                                                     │  │ │
│  │  │  product-matching/                                  │  │ │
│  │  │  ├── parseSafiloDesignation()                       │  │ │
│  │  │  ├── parseDesignation()                             │  │ │
│  │  │  ├── normalizeBarcode()                             │  │ │
│  │  │  ├── normalizeBrandName()                           │  │ │
│  │  │  ├── calculateSimilarity()                          │  │ │
│  │  │  └── BRAND_PATTERNS_MAP (50+ marques)               │  │ │
│  │  │                                                     │  │ │
│  │  │  models/                                            │  │ │
│  │  │  ├── IBrand, IModel, IManufacturer, ILaboratory     │  │ │
│  │  │  ├── ISupplier, IAddress, IFamily, IColor           │  │ │
│  │  │  └── Product (IFrame | ILens | IContactLens | ...)  │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Codes produits supportés

### 2.1 Codes-barres universels

| Code       | Longueur    | Format                             | Exemple         |
| ---------- | ----------- | ---------------------------------- | --------------- |
| **EAN-13** | 13 chiffres | Pays + Fabricant + Produit + Check | `3660396012345` |
| **EAN-8**  | 8 chiffres  | Version courte                     | `96385074`      |
| **UPC-A**  | 12 chiffres | Standard américain                 | `012345678905`  |
| **UPC-E**  | 8 chiffres  | Compressé                          | `01234565`      |

### 2.2 Codes métier optique

| Code                    | Portée          | Exemple          |
| ----------------------- | --------------- | ---------------- |
| **Référence fabricant** | Par fabricant   | `0RB2140 901 50` |
| **Code fournisseur**    | Par fournisseur | `LUX-2140-BLACK` |

---

## 3. Format Safilo - Parsing

### 3.1 Formats supportés

**Format slash/dot** : `BRAND MODEL/GENRE.COLOR.EYESIZE.BRIDGE`

```
CH-HER 0083/G.807.54.16
  │     │   │  │   │  │
  │     │   │  │   │  └── Bridge size (16mm)
  │     │   │  │   └───── Eye size (54mm)
  │     │   │  └───────── Color code (807)
  │     │   └──────────── Genre (G=general)
  │     └──────────────── Model (0083)
  └────────────────────── Brand code (CH-HER = Carolina Herrera)
```

**Format dot only** : `BRAND MODEL. COLOR.EYESIZE.BRIDGE`

```
CH-CH 0016. 081.52.16
```

### 3.2 Extraction

```typescript
import { parseSafiloDesignation } from '@optisaas/opti-saas-lib';

const result = parseSafiloDesignation('CH-HER 0083/G.807.54.16');
// {
//   parsedBrand: 'Carolina Herrera',
//   parsedModel: '0083',
//   parsedColorCode: '807',
//   parsedCategory: 'optical',
//   parsedFrameSize: { eyeSize: 54, bridgeSize: 16, templeLength: null },
//   parsedFinish: null,
//   confidence: 0.65
// }
```

### 3.3 Marques supportées (BRAND_PATTERNS_MAP)

| Code             | Marque           | Groupe           |
| ---------------- | ---------------- | ---------------- |
| `CH-HER`, `HER`  | Carolina Herrera | Safilo           |
| `BOSS`, `HG`     | Hugo Boss        | Safilo           |
| `CAR`, `CARRERA` | Carrera          | Safilo           |
| `JMC`, `MARC`    | Marc Jacobs      | Safilo           |
| `POL`, `PLD`     | Polaroid         | Safilo           |
| `TH`, `TOMMY`    | Tommy Hilfiger   | Safilo           |
| `FEN`, `FENDI`   | Fendi            | Safilo           |
| `RAY`, `RB`      | Ray-Ban          | EssilorLuxottica |
| `OAK`, `OO`      | Oakley           | EssilorLuxottica |
| ...              | 50+ marques      | ...              |

---

## 4. Service ProductMatchingService

### 4.1 Localisation

`src/app/shared/services/product-matching.service.ts`

### 4.2 API publique

```typescript
@Injectable({ providedIn: 'root' })
export class ProductMatchingService {
  // Matching complet d'une ligne OCR
  async matchProduct(
    reference: string | null,
    designation: string,
    supplierId: string | null,
  ): Promise<IProductMatchResult>;

  // Matching marque
  matchBrand(parsedBrand: string): { brandId: string; score: number } | null;

  // Matching modèle
  matchModel(parsedModel: string, brandId: string): { modelId: string; score: number } | null;
}
```

### 4.3 Optimisations implémentées

| Optimisation            | Détail                                                        |
| ----------------------- | ------------------------------------------------------------- |
| **Cache O(1) brands**   | `computed()` → `Map<normalizedKey, BrandCacheEntry>`          |
| **Cache O(1) models**   | `computed()` → `Map<brandId:normalizedKey, ModelCacheEntry>`  |
| **Matching parallèle**  | `Promise.all()` pour barcode + supplierCode + manufacturerRef |
| **Fonctions pures lib** | Tree-shakable, réutilisables                                  |

---

## 5. Indicateur de confiance UI

### 5.1 Composant

`src/app/features/stock/stock-entry/components/match-confidence-indicator/`

### 5.2 Niveaux de confiance

| Niveau   | Score | Couleur | Icône          |
| -------- | ----- | ------- | -------------- |
| `high`   | ≥90   | Vert    | `check_circle` |
| `medium` | 70-89 | Orange  | `warning`      |
| `low`    | 50-69 | Rouge   | `error`        |
| `none`   | <50   | Gris    | `help`         |

### 5.3 Usage

```html
<app-match-confidence-indicator [matchResult]="row._matchResult" />
```

---

## 6. Models lib (source unique)

### 6.1 Localisation

`opti_saas_lib/src/shared/models/`

### 6.2 Interfaces principales

| Interface   | Champs clés                                                               |
| ----------- | ------------------------------------------------------------------------- |
| `IBrand`    | `id`, `code`, `label`, `aliases`, `manufacturerCodes`, `parentCompany`    |
| `IModel`    | `id`, `code`, `label`, `brandId`, `aliases`, `manufacturerCode`           |
| `ISupplier` | `id`, `code`, `name`, `ice`, `taxId`, `tradeRegister`                     |
| `Product`   | Union `IFrame \| ILens \| IContactLens \| IClipOn \| IAccessory`          |
| `IFrame`    | `frameEyeSize`, `frameBridge`, `frameTemple`, `frameColor`, `frameFinish` |

### 6.3 Import frontend

```typescript
// Depuis @app/models (ré-export)
import { IBrand, IModel, Product, ISupplier } from '@app/models';

// Ou directement depuis lib
import { IBrand, parseSafiloDesignation } from '@optisaas/opti-saas-lib';
```

---

## 7. Seed data optique

### 7.1 Fichier

`src/app/shared/data/optical-database.seed.ts`

### 7.2 Contenu

| Entité               | Nombre | Exemples                         |
| -------------------- | ------ | -------------------------------- |
| `SEED_BRANDS`        | 50+    | Ray-Ban, Oakley, Gucci, Prada... |
| `SEED_MODELS`        | 50+    | Wayfarer, Aviator, Holbrook...   |
| `SEED_MANUFACTURERS` | 9      | Essilor, Zeiss, Hoya...          |
| `SEED_LABORATORIES`  | 8      | Acuvue, Alcon, Bausch & Lomb...  |

### 7.3 Holdings couverts

- **EssilorLuxottica** : Ray-Ban, Oakley, Persol + licences
- **Safilo Group** : Carrera, Polaroid + licences (Dior, Boss, Marc Jacobs...)
- **Marcolin Group** : Tom Ford, Guess, Moncler
- **Kering Eyewear** : Gucci, Saint Laurent, Balenciaga

---

## 8. Intégration stock-entry

### 8.1 Flow

```
1. OCR extrait facture → ISupplierInvoice
2. invoiceToFormData() appelle parseSafiloDesignation() par ligne
3. Chaque ligne reçoit _matchResult et _ocrConfidence
4. UI affiche indicateur confiance par ligne
5. Utilisateur peut chercher/créer produit si non matché
```

### 8.2 Champs UI dans IStockEntryProductFormRow

```typescript
interface IStockEntryProductFormRow extends IProductForm {
  readonly _rowId: string; // ID unique ligne
  readonly _ocrConfidence: number | null; // Confiance OCR (0-1)
  readonly _isExpanded: boolean; // État expansion
  readonly _matchResult: IProductMatchResult | null; // Résultat matching
}
```

---

## 9. Tests manuels

### 9.1 Scénarios à tester

| Scénario                | Input                      | Résultat attendu                                              |
| ----------------------- | -------------------------- | ------------------------------------------------------------- |
| Format Safilo slash/dot | `CH-HER 0083/G.807.54.16`  | Brand: Carolina Herrera, Model: 0083, Color: 807, Size: 54-16 |
| Format Safilo dot only  | `CH-CH 0016. 081.52.16`    | Brand: Carolina Herrera, Model: 0016, Color: 081, Size: 52-16 |
| Code couleur 3 chars    | `CH-HER 0083/G.1ED.54.16`  | Color: 1ED                                                    |
| Marque inconnue         | `UNKNOWN 1234/G.001.50.18` | Brand: null, confidence faible                                |
