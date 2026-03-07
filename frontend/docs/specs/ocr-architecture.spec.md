# Spécification Technique - Architecture OCR

> **Version:** 2.4
> **Date:** 2026-01-22
> **Statut:** ✅ Implémenté
> **Module:** Core OCR + opti_saas_lib

---

## Quick Reference (Claude AI)

> Section condensée pour Claude AI lors des sessions de développement.

### Fichiers clés

| Besoin                  | Fichier                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| Parser exemple          | `features/stock/stock-entry/parsers/supplier-invoice.parser.ts`   |
| Classe abstraite Parser | `core/ocr/document-parser.ts`                                     |
| Enregistrement parsers  | `core/ocr/parser.providers.ts`                                    |
| Provider OCR            | `core/ocr/providers/tesseract.provider.ts`                        |
| Service langue          | `core/ocr/services/locale.service.ts`                             |
| Pipeline orchestrateur  | `core/ocr/pipeline/ocr-pipeline.ts`                               |
| Factory pipelines       | `core/ocr/pipeline/pipeline.factory.ts`                           |
| Extractors (lib)        | `opti_saas_lib/src/shared/ocr/extractors/`                        |
| Detection zones (lib)   | `opti_saas_lib/src/shared/ocr/detection/`                         |
| Patterns (lib)          | `opti_saas_lib/src/shared/ocr/patterns/`                          |
| Locales (lib)           | `opti_saas_lib/src/shared/ocr/locales/`                           |
| Templates fournisseurs  | `opti_saas_lib/src/shared/ocr/templates/`                         |
| Product parsing (lib)   | `opti_saas_lib/src/shared/product-matching/designation.parser.ts` |
| Mapping OCR → Business  | `features/stock/stock-entry/components/stock-entry.component.ts`  |

### Checklist nouveau Parser

- [ ] Créer modèle `IMyDocument` dans `models/`
- [ ] Créer parser `extends DocumentParser<IMyDocument>`
- [ ] Définir `readonly documentType = 'my_type' as const`
- [ ] Implémenter `extractData(rawText, blocks)` avec extractors
- [ ] Implémenter `validate(data)` retournant `IValidationResult`
- [ ] Enregistrer avec `provideParsers(createParserRegistration(...))`
- [ ] Utiliser via `PipelineFactory.createPipeline<IMyDocument>('my_type')`

### Checklist nouvel Extractor

- [ ] Créer dans `opti_saas_lib/src/shared/ocr/extractors/`
- [ ] Étendre `BaseExtractor<T>`
- [ ] Utiliser `this.success()` / `this.failure()` pour retours
- [ ] Utiliser `this.tryPatterns()` pour essayer plusieurs patterns
- [ ] Exporter depuis `extractors/index.ts`
- [ ] Instancier comme propriété readonly dans parser (pas à chaque appel)

### Décisions de design OCR

| Décision        | Choix                     | Raison                              |
| --------------- | ------------------------- | ----------------------------------- |
| Worker pool     | LRU max 3                 | Évite recréation workers par langue |
| Regex cache     | `Map<string, RegExp>`     | Évite compilation répétée           |
| Langue OCR      | Liée à `TranslateService` | Cohérence avec langue app           |
| Langue parsing  | Détection auto (FR/AR)    | Document peut différer de l'app     |
| Extractors      | Instancier une fois       | Réutilisation, performance          |
| Parser strategy | `'regex'` ou `'ai'`       | Préparé pour parsing IA futur       |

### Erreurs courantes OCR

| Erreur                        | Cause                           | Solution                        |
| ----------------------------- | ------------------------------- | ------------------------------- |
| `extractData` protected error | Parent public, enfant protected | Enlever `protected` dans parser |
| Parser non trouvé             | Pas enregistré                  | `provideParsers()` dans routes  |
| Duplicate parser              | Même documentType 2x            | Un seul parser par type         |
| Regex recompilée              | `new RegExp()` dans méthode     | Utiliser cache ou const         |
| Worker lent                   | Création à chaque appel         | Pool réutilise workers          |

### Patterns de code

```typescript
// ✅ Parser: Instancier extractors une fois
readonly #dateExtractor = new DateExtractor();
readonly #localeService = inject(OcrLocaleService);

// ✅ extractData: Détecter locale puis extraire
extractData(rawText: string, _blocks: IOcrBlock[]): IMyDocument {
  const locale = this.#localeService.getLocaleForText(rawText);
  return {
    date: this.#dateExtractor.extract(rawText, locale, 'invoice').value,
    // ...
  };
}

// ✅ Enregistrement: Dans routes lazy-loaded
providers: [
  provideParsers(
    createParserRegistration('invoice', SupplierInvoiceParser, 'Supplier invoices'),
  ),
]

// ✅ Utilisation: Via PipelineFactory
const pipeline = this.#pipelineFactory.createPipeline<ISupplierInvoice>('invoice');
const result = await pipeline.process(imageFile);
```

### Architecture résumée

```
Image → Pipeline → Provider (Tesseract) → Texte brut
                         ↓
                    Parser → Locale + Extractors + Patterns → Données structurées
                         ↓
                    Mapping → ISupplierInvoice → IOcrSupplierData → ISupplier (business)
```

### Mapping OCR → Business Object

| OCR (IInvoiceSupplier) | Frontend (IOcrSupplierData) | Business (ISupplier) |
| ---------------------- | --------------------------- | -------------------- |
| `name`                 | `name`                      | `name`               |
| `ice`                  | `ice`                       | `ice`                |
| `fiscalId`             | `fiscalId`                  | `taxId`              |
| `tradeRegister`        | `tradeRegister`             | `tradeRegister`      |
| `cnss`                 | `cnss`                      | -                    |
| `patente`              | `patente`                   | `businessLicense`    |
| `address`              | `address`                   | `address.street`     |
| `addressDetails`       | `addressDetails`            | `address.*`          |
| `phone`                | `phone`                     | `phone`              |
| `email`                | `email`                     | `email`              |
| `bank`                 | `bank`                      | `bank`               |
| `rib`                  | `rib`                       | `bankAccountNumber`  |

---

## Table des matières

1. [Objectif](#1-objectif)
2. [Architecture globale](#2-architecture-globale)
3. [Flux de données](#3-flux-de-données)
4. [Structure des fichiers](#4-structure-des-fichiers)
5. [Pipeline](#5-pipeline)
6. [Providers](#6-providers)
7. [Parsers](#7-parsers)
8. [Extractors](#8-extractors)
9. [Patterns](#9-patterns)
10. [Locales](#10-locales)
11. [Services](#11-services)
12. [Configuration](#12-configuration)
13. [Guide d'implémentation](#13-guide-dimplémentation)
14. [Optimisations](#14-optimisations)
15. [Tests](#15-tests)
16. [Évolutions futures](#16-évolutions-futures)
17. [Avancement de l'implémentation](#17-avancement-de-limplémentation)

---

## 1. Objectif

### 1.1 But principal

Fournir une architecture OCR **modulaire**, **performante** et **multi-langue** permettant :

- Extraction de texte depuis images (factures, ordonnances, cartes mutuelle...)
- Parsing intelligent avec extractors spécialisés et patterns réutilisables
- Support multi-langue (FR, AR, EN) avec détection automatique
- Changement de provider OCR sans impact sur les features
- Support du parsing IA (préparé pour implémentation future)

### 1.2 Cas d'usage

| Feature     | Type de document    | Données extraites                              |
| ----------- | ------------------- | ---------------------------------------------- |
| Stock Entry | Facture fournisseur | N° facture, dates, fournisseur, lignes, totaux |
| Client      | Ordonnance médicale | Prescription, corrections optiques             |
| Client      | Carte mutuelle      | Numéro, plafonds, dates                        |
| Finance     | Facture fournisseur | Montants, TVA, échéances                       |

### 1.3 Principes directeurs

| Principe                  | Description                                                         |
| ------------------------- | ------------------------------------------------------------------- |
| **Pipeline Pattern**      | Combine Provider + Parser dans un flux configurable                 |
| **Single Responsibility** | Provider = extraction texte, Parser = interprétation métier         |
| **Open/Closed**           | Ouvert à l'extension (nouveaux extractors), fermé à la modification |
| **DRY**                   | Extractors et patterns réutilisables entre parsers                  |

---

## 2. Architecture globale

### 2.1 Schéma d'ensemble

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              UTILISATEUR                                     │
│                          Upload image facture                                │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           1. PIPELINE                                        │
│                      Orchestrateur principal                                 │
│                Combine Provider + Parser + Config                            │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
┌───────────────────────────────┐     ┌───────────────────────────────────────┐
│      2. PROVIDER              │     │           3. PARSER                    │
│   (Tesseract Worker)          │     │    (SupplierInvoiceParser)             │
│                               │     │                                        │
│   Image → Texte brut          │     │   Texte brut → Données structurées     │
│   + positions + confiance     │     │                                        │
└───────────────────────────────┘     └──────────────────┬────────────────────┘
                                                         │
                              ┌──────────────────────────┼──────────────────────┐
                              ▼                          ▼                      ▼
               ┌──────────────────────┐  ┌──────────────────────┐  ┌───────────────────┐
               │   4. EXTRACTORS      │  │    5. PATTERNS       │  │   6. LOCALES      │
               │                      │  │                      │  │                   │
               │ DateExtractor        │  │ MOROCCAN_PATTERNS    │  │ FR: "janvier"     │
               │ AmountExtractor      │  │ NUMERIC_PATTERNS     │  │ AR: "يناير"       │
               │ IdentifierExtractor  │  │                      │  │                   │
               │ ContactExtractor     │  │ ICE, IF, RC...       │  │ dateContext       │
               │ LineItemExtractor    │  │ DATE.DMY             │  │ paymentTerms      │
               └──────────────────────┘  └──────────────────────┘  └───────────────────┘
```

### 2.2 Vocabulaire

| Terme         | Rôle                                                       |
| ------------- | ---------------------------------------------------------- |
| **Pipeline**  | Orchestrateur qui combine Provider + Parser                |
| **Provider**  | Moteur OCR (Tesseract, OpenAI Vision)                      |
| **Parser**    | Transforme texte brut en données métier structurées        |
| **Extractor** | Fonction spécialisée pour extraire UN type de donnée       |
| **Pattern**   | Expression régulière pour détecter des formats spécifiques |
| **Locale**    | Configuration linguistique (mois, patterns contextuels)    |

---

## 3. Flux de données

### 3.1 Flux complet étape par étape

```
1. Utilisateur uploade image
       ↓
2. Pipeline.process(image)
       ↓
3. OcrService → TesseractProvider (Worker pool)
       ↓
4. Image → Texte brut + blocs + confiance
       ↓
5. Parser.extractData(rawText, blocks)
       ↓
6. LocaleService.getLocaleForText() → FR_LOCALE ou AR_LOCALE
       ↓
7. Extractors utilisent Patterns + Locale pour extraire:
   • DateExtractor → invoiceDate, dueDate
   • IdentifierExtractor → invoiceNumber, ICE, IF
   • AmountExtractor → totalHT, totalTTC, TVA
   • ContactExtractor → supplier name, address
   • LineItemExtractor → product lines
       ↓
8. Pipeline retourne IParseResult<ISupplierInvoice>
       ↓
9. UI affiche données structurées avec warnings
```

### 3.2 Exemple de données à chaque étape

```typescript
// Étape 4: Sortie Provider
{
  rawText: "FACTURE N° 2024-001\nDate: 15/01/2024\nFournisseur: ABC SARL\nICE: 001234567000089\n...",
  confidence: 0.92,
  blocks: [{ text: "FACTURE N° 2024-001", confidence: 0.95, boundingBox: {...} }, ...],
  provider: "tesseract"
}

// Étape 8: Sortie Pipeline
{
  data: {
    invoiceNumber: "2024-001",
    invoiceDate: Date("2024-01-15"),
    supplier: { name: "ABC SARL", ice: "001234567000089", ... },
    lines: [{ designation: "Produit A", quantity: 10, unitPrice: 50, total: 500 }, ...],
    totals: { totalHT: 1000, totalVAT: 200, totalTTC: 1200 }
  },
  confidence: 0.92,
  warnings: ["Uncertain text: \"...\""],
  processingTime: 3500
}
```

---

## 4. Structure des fichiers

### 4.1 Frontend (Angular)

```
frontend/src/app/core/ocr/
├── index.ts                           # Exports publics
├── document-parser.ts                 # Classe abstraite DocumentParser<T>
├── ocr.service.ts                     # Point d'entrée OCR
├── parser-registry.ts                 # Registry des parsers
├── parser.providers.ts                # provideParsers() + validation
│
├── providers/
│   └── tesseract.provider.ts          # TesseractProvider avec worker pool LRU
│
├── services/
│   ├── index.ts
│   └── locale.service.ts              # OcrLocaleService (langue app → OCR)
│
└── pipeline/
    ├── ocr-pipeline.ts                # OcrPipeline<T> orchestrateur
    ├── pipeline.factory.ts            # PipelineFactory (crée pipelines)
    ├── pipeline.config.token.ts       # PIPELINE_CONFIG token
    └── parsers/
        └── ai-invoice.parser.ts       # Parser IA (placeholder)
```

### 4.2 Features (Parsers métier)

```
frontend/src/app/features/stock/alimentation/
├── parsers/
│   └── supplier-invoice.parser.ts     # SupplierInvoiceParser
├── models/
│   └── supplier-invoice.model.ts      # ISupplierInvoice, IInvoiceLine
└── components/
    └── invoice-upload/                # UI upload + preview
```

### 4.3 Library partagée (opti_saas_lib)

```
opti_saas_lib/src/shared/ocr/
├── index.ts                           # Exports publics
├── ocr.models.ts                      # IOcrBlock, IOcrResult, OcrDocumentType
├── supplier-invoice.models.ts         # ISupplierInvoice, IInvoiceSupplier, IInvoiceClient
├── document-parser.interfaces.ts      # IDataExtractor<T>, IParseResult<T>
│
├── detection/
│   ├── index.ts
│   ├── zone-detector.ts               # ZoneDetector (header/body/footer)
│   └── entity-zone-detector.ts        # EntityZoneDetector (vendor/customer)
│
├── extractors/
│   ├── index.ts
│   ├── base.extractor.ts              # BaseExtractor (classe abstraite)
│   ├── date.extractor.ts              # DateExtractor + cache regex
│   ├── amount.extractor.ts            # AmountExtractor
│   ├── identifier.extractor.ts        # IdentifierExtractor (ICE, IF, RC)
│   ├── contact.extractor.ts           # ContactExtractor
│   ├── customer.extractor.ts          # CustomerExtractor (client facture)
│   ├── loose-contact.extractor.ts     # LooseContactExtractor (fallback)
│   └── line-item.extractor.ts         # LineItemExtractor
│
├── patterns/
│   ├── index.ts
│   ├── numeric.patterns.ts            # NUMERIC_PATTERNS (dates, montants)
│   ├── moroccan.patterns.ts           # MOROCCAN_PATTERNS (ICE, IF, RC)
│   ├── city-lookup.ts                 # CityLookup (détection villes)
│   └── pattern.helpers.ts             # parseDate(), isValidICE()
│
├── templates/
│   └── supplier-templates.ts          # Templates par fournisseur connu
│
├── validation/
│   └── totals.validator.ts            # TotalsValidator (cohérence montants)
│
├── locales/
│   ├── index.ts
│   ├── locale.interface.ts            # IOcrLocale, IExtractionResult<T>
│   ├── fr.locale.ts                   # FR_LOCALE
│   └── ar.locale.ts                   # AR_LOCALE
│
└── utils/
    ├── index.ts
    ├── currency.helper.ts             # detectCurrency()
    └── warning.helper.ts              # detectLowConfidenceWarnings()
```

---

## 5. Pipeline

### 5.1 OcrPipeline

Le pipeline est l'orchestrateur central qui combine un provider OCR avec un parser.

**Fichier:** `frontend/src/app/core/ocr/pipeline/ocr-pipeline.ts`

```typescript
export class OcrPipeline<T> implements IOcrPipeline<T> {
  constructor(
    private readonly ocrService: OcrService,
    private readonly parser: IPipelineParser<T>,
    private readonly config: IPipelineDocumentConfig,
  ) {}

  async process(image: File): Promise<IParseResult<T>> {
    const startTime = performance.now();

    // 1. OCR: Image → Texte brut
    const ocrResult = await this.ocrService.process(image, {
      documentType: this.config.documentType,
    });

    // 2. Parse: Texte brut → Données structurées
    const data = this.parser.extractData(ocrResult.rawText, ocrResult.blocks);

    // 3. Warnings: Détecte zones à faible confiance
    const warnings = detectLowConfidenceWarnings(ocrResult.blocks);

    return {
      data,
      confidence: ocrResult.confidence,
      warnings,
      processingTime: performance.now() - startTime,
    };
  }
}
```

### 5.2 PipelineFactory

Crée des pipelines à la demande selon la configuration.

**Fichier:** `frontend/src/app/core/ocr/pipeline/pipeline.factory.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class PipelineFactory implements IPipelineFactory {
  // Cache des parsers par type+stratégie
  readonly #parserCache = new Map<string, IPipelineParser<unknown>>();

  createPipeline<T>(documentType: OcrDocumentType): OcrPipeline<T> {
    const config = this.#getDocumentConfig(documentType);
    const parser = this.#getOrCreateParser<T>(documentType, config.parserStrategy);

    return new OcrPipeline<T>(this.#ocrService, parser, config);
  }

  #getOrCreateParser<T>(
    documentType: OcrDocumentType,
    strategy: ParserStrategyType,
  ): IPipelineParser<T> {
    const cacheKey = `${documentType}:${strategy}`;

    if (this.#parserCache.has(cacheKey)) {
      return this.#parserCache.get(cacheKey) as IPipelineParser<T>;
    }

    let parser: IPipelineParser<T>;

    switch (strategy) {
      case 'regex':
        parser = this.#getRegexParser<T>(documentType);
        break;
      case 'ai':
        parser = this.#getAiParser<T>(documentType);
        break;
      default:
        throw new Error(`Unknown parser strategy: ${strategy}`);
    }

    this.#parserCache.set(cacheKey, parser as IPipelineParser<unknown>);
    return parser;
  }
}
```

### 5.3 Configuration Pipeline

**Fichier:** `frontend/src/app/core/ocr/pipeline/pipeline.config.token.ts`

```typescript
export const PIPELINE_CONFIG = new InjectionToken<IPipelineConfig>('PIPELINE_CONFIG');

export const DEFAULT_PIPELINE_CONFIG: IPipelineConfig = {
  documents: {
    invoice: {
      documentType: 'invoice',
      provider: 'tesseract',
      parserStrategy: 'regex', // ou 'ai' pour parsing IA
    },
    // Ajouter autres types de documents...
  },
};
```

---

## 6. Providers

### 6.1 TesseractProvider avec Worker Pool LRU

Le provider Tesseract utilise un pool de workers avec éviction LRU pour optimiser les performances.

**Fichier:** `frontend/src/app/core/ocr/providers/tesseract.provider.ts`

```typescript
const MAX_POOL_SIZE = 3; // Maximum 3 workers en mémoire

@Injectable()
export class TesseractProvider implements IOcrEngine, OnDestroy {
  readonly name = 'tesseract';
  readonly isAvailable = true;

  // Pool de workers par langue
  readonly #workerPool = new Map<string, Worker>();

  // Ordre d'accès pour LRU
  readonly #accessOrder: string[] = [];

  async process(image: File, options?: IOcrOptions): Promise<IOcrResult> {
    const language = options?.language ?? 'fra';
    const worker = await this.#getWorker(language);
    const { data } = await worker.recognize(image);

    return {
      rawText: data.text,
      confidence: data.confidence / 100,
      blocks: this.#mapBlocks(data.blocks),
      provider: this.name,
      processingTime: performance.now() - startTime,
    };
  }

  async #getWorker(language: string): Promise<Worker> {
    // 1. Réutiliser worker existant
    let worker = this.#workerPool.get(language);
    if (worker) {
      this.#updateAccessOrder(language);
      return worker;
    }

    // 2. Éviction LRU si pool plein
    if (this.#workerPool.size >= MAX_POOL_SIZE) {
      await this.#evictLeastRecentlyUsed();
    }

    // 3. Créer nouveau worker
    worker = await createWorker(language);
    this.#workerPool.set(language, worker);
    this.#updateAccessOrder(language);
    return worker;
  }

  async #evictLeastRecentlyUsed(): Promise<void> {
    const lruLanguage = this.#accessOrder.shift();
    if (lruLanguage) {
      const worker = this.#workerPool.get(lruLanguage);
      if (worker) {
        await worker.terminate();
        this.#workerPool.delete(lruLanguage);
      }
    }
  }
}
```

### 6.2 Avantages du Worker Pool

| Sans Pool             | Avec Pool             |
| --------------------- | --------------------- |
| Créer worker FR (~2s) | Créer worker FR (~2s) |
| Créer worker FR (~2s) | **Réutiliser** (~0s)  |
| Créer worker FR (~2s) | **Réutiliser** (~0s)  |
| Créer worker EN (~2s) | Créer worker EN (~2s) |
| Créer worker FR (~2s) | **Réutiliser** (~0s)  |

---

## 7. Parsers

### 7.1 DocumentParser (Classe abstraite)

Classe de base pour tous les parsers métier.

**Fichier:** `frontend/src/app/core/ocr/document-parser.ts`

```typescript
export abstract class DocumentParser<T> implements IDataExtractor<T> {
  abstract readonly documentType: OcrDocumentType;

  /**
   * Extrait les données métier du texte OCR.
   * Méthode publique implémentant IDataExtractor.
   */
  abstract extractData(rawText: string, blocks: IOcrBlock[]): T;

  /**
   * Valide les données extraites.
   */
  abstract validate(data: T): IValidationResult;
}
```

### 7.2 SupplierInvoiceParser (Exemple concret)

**Fichier:** `frontend/src/app/features/stock/alimentation/parsers/supplier-invoice.parser.ts`

```typescript
@Injectable()
export class SupplierInvoiceParser extends DocumentParser<ISupplierInvoice> {
  readonly documentType = 'invoice' as const;

  // Injection des extractors
  readonly #localeService = inject(OcrLocaleService);
  readonly #dateExtractor = new DateExtractor();
  readonly #amountExtractor = new AmountExtractor();
  readonly #identifierExtractor = new IdentifierExtractor();
  readonly #contactExtractor = new ContactExtractor();
  readonly #lineItemExtractor = new LineItemExtractor();

  extractData(rawText: string, _blocks: IOcrBlock[]): ISupplierInvoice {
    // Détection automatique de la langue du document
    const locale = this.#localeService.getLocaleForText(rawText);

    return {
      invoiceNumber: this.#identifierExtractor.extractInvoiceNumber(rawText, locale).value,
      invoiceDate: this.#dateExtractor.extract(rawText, locale, 'invoice').value,
      dueDate: this.#dateExtractor.extract(rawText, locale, 'due').value,
      supplier: this.#extractSupplier(rawText, locale),
      lines: this.#lineItemExtractor.extractLines(rawText, 0.2, locale.noiseKeywords),
      totals: this.#extractTotals(rawText, locale),
      currency: detectCurrency(rawText, 'MAD'),
      rawText,
    };
  }

  validate(data: ISupplierInvoice): IValidationResult {
    const errors: IValidationError[] = [];

    if (!data.invoiceNumber) {
      errors.push({ field: 'invoiceNumber', message: 'Invoice number not found' });
    }
    if (!data.invoiceDate) {
      errors.push({ field: 'invoiceDate', message: 'Invoice date not found' });
    }
    if (data.lines.length === 0) {
      errors.push({ field: 'lines', message: 'No invoice lines found' });
    }

    return { isValid: errors.length === 0, errors };
  }
}
```

### 7.3 Enregistrement des Parsers

**Fichier:** `frontend/src/app/features/stock/alimentation/alimentation.routes.ts`

```typescript
export const alimentationRoutes: Routes = [
  {
    path: '',
    providers: [
      provideParsers(
        createParserRegistration('invoice', SupplierInvoiceParser, 'Supplier invoices'),
      ),
    ],
    children: [
      /* ... */
    ],
  },
];
```

**Fichier:** `frontend/src/app/core/ocr/parser.providers.ts`

```typescript
// Validation des doublons à l'enregistrement
export function provideParsers(...registrations: IParserRegistration[]): EnvironmentProviders {
  validateRegistrations(registrations); // Throws si doublons

  return makeEnvironmentProviders([
    ...registrations.map((r) => r.parser),
    { provide: PARSER_CONFIG, useValue: { parsers: registrations } },
  ]);
}

function validateRegistrations(registrations: IParserRegistration[]): void {
  const types = registrations.map((r) => r.documentType);
  const duplicates = types.filter((type, index) => types.indexOf(type) !== index);

  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate parser registrations for document types: ${[...new Set(duplicates)].join(', ')}`,
    );
  }
}
```

---

## 8. Extractors

### 8.1 Architecture des Extractors

Les extractors sont des classes spécialisées pour extraire UN type de donnée spécifique.

```
BaseExtractor<T>
├── DateExtractor        → Dates (facture, échéance)
├── AmountExtractor      → Montants (HT, TTC, TVA)
├── IdentifierExtractor  → Identifiants (ICE, IF, RC, N° facture)
├── ContactExtractor     → Coordonnées (nom, adresse, téléphone)
└── LineItemExtractor    → Lignes produits
```

### 8.2 BaseExtractor

**Fichier:** `opti_saas_lib/src/shared/ocr/extractors/base.extractor.ts`

```typescript
export abstract class BaseExtractor<T> {
  /**
   * Crée un résultat de succès.
   */
  protected success(
    value: T,
    confidence: number,
    rawMatch: string,
    pattern: RegExp,
  ): IExtractionResult<T> {
    return { value, confidence, rawMatch, pattern };
  }

  /**
   * Crée un résultat d'échec.
   */
  protected failure(): IExtractionResult<T> {
    return { value: null, confidence: 0, rawMatch: null, pattern: null };
  }

  /**
   * Calcule la confiance basée sur la qualité du match.
   */
  protected calculateConfidence(match: RegExpMatchArray, text: string): number {
    const matchLength = match[0].length;
    const textLength = text.length;
    const ratio = matchLength / textLength;
    return Math.min(0.95, 0.5 + ratio * 0.5);
  }

  /**
   * Essaie plusieurs patterns et retourne le premier match.
   */
  protected tryPatterns(
    text: string,
    patterns: RegExp[],
  ): { match: RegExpMatchArray; pattern: RegExp } | null {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return { match, pattern };
    }
    return null;
  }
}
```

### 8.3 DateExtractor (avec cache regex)

**Fichier:** `opti_saas_lib/src/shared/ocr/extractors/date.extractor.ts`

```typescript
// Cache pour éviter de recréer les regex à chaque appel
const textDatePatternCache = new Map<string, RegExp>();

function getTextDatePattern(locale: IOcrLocale): RegExp {
  let pattern = textDatePatternCache.get(locale.code);

  if (!pattern) {
    const monthsPattern = locale.months.join('|');
    pattern = new RegExp(`(\\d{1,2})\\s+(${monthsPattern})\\s+(\\d{4})`, 'i');
    textDatePatternCache.set(locale.code, pattern);
  }

  return pattern;
}

export class DateExtractor extends BaseExtractor<Date> {
  /**
   * Extrait une date avec contexte optionnel.
   * @param text Texte source
   * @param locale Locale pour mois et patterns contextuels
   * @param dateType Type de date (invoice, due, any)
   */
  extract(text: string, locale: IOcrLocale, dateType: DateType = 'any'): IExtractionResult<Date> {
    // 1. Cherche avec contexte (ex: "Date facture: 15/01/2024")
    if (dateType !== 'any') {
      const contextResult = this.#extractWithContext(text, locale, dateType);
      if (contextResult.value) {
        return { ...contextResult, confidence: contextResult.confidence + 0.15 };
      }
    }

    // 2. Sinon cherche format générique
    return this.#extractGeneric(text, locale);
  }

  #extractWithContext(
    text: string,
    locale: IOcrLocale,
    dateType: 'invoice' | 'due',
  ): IExtractionResult<Date> {
    const contextPatterns = locale.dateContext[dateType];

    for (const contextPattern of contextPatterns) {
      const contextMatch = text.match(contextPattern);
      if (contextMatch) {
        const dateContext = contextMatch[1];
        return this.#extractFromContext(dateContext, locale);
      }
    }

    return this.failure();
  }

  #extractGeneric(text: string, locale: IOcrLocale): IExtractionResult<Date> {
    // Pattern numérique: 15/01/2024
    const numericMatch = text.match(NUMERIC_PATTERNS.DATE.DMY);
    if (numericMatch) {
      const date = parseDate(numericMatch, 'dmy');
      if (date && this.#isValidDate(date)) {
        return this.success(
          date,
          this.calculateConfidence(numericMatch, text) - 0.1,
          numericMatch[0],
          NUMERIC_PATTERNS.DATE.DMY,
        );
      }
    }

    // Pattern textuel: 15 janvier 2024
    const textPattern = getTextDatePattern(locale);
    const textMatch = text.match(textPattern);
    if (textMatch) {
      const date = parseDate(textMatch, 'dmy', locale.months);
      if (date && this.#isValidDate(date)) {
        return this.success(
          date,
          this.calculateConfidence(textMatch, text) - 0.1,
          textMatch[0],
          textPattern,
        );
      }
    }

    return this.failure();
  }

  #isValidDate(date: Date): boolean {
    const now = new Date();
    const minDate = new Date(now.getFullYear() - 10, 0, 1);
    const maxDate = new Date(now.getFullYear() + 2, 11, 31);
    return date >= minDate && date <= maxDate;
  }
}
```

### 8.4 IdentifierExtractor

**Fichier:** `opti_saas_lib/src/shared/ocr/extractors/identifier.extractor.ts`

```typescript
export class IdentifierExtractor extends BaseExtractor<string> {
  /**
   * Extrait tous les identifiants marocains.
   */
  extractAllMoroccan(text: string): IMoroccanIdentifiers {
    return {
      ice: this.#extractSimple(text, MOROCCAN_PATTERNS.ICE),
      fiscalId: this.#extractSimple(text, MOROCCAN_PATTERNS.IF),
      tradeRegister: this.#extractSimple(text, MOROCCAN_PATTERNS.RC),
      cnss: this.#extractSimple(text, MOROCCAN_PATTERNS.CNSS),
      patente: this.#extractSimple(text, MOROCCAN_PATTERNS.PATENTE),
    };
  }

  /**
   * Extrait le numéro de facture avec plusieurs stratégies.
   */
  extractInvoiceNumber(text: string, locale: IOcrLocale): IExtractionResult<string> {
    // 1. Patterns contextuels de la locale
    const result = this.tryPatterns(text, locale.invoiceNumber);
    if (result?.match[1]) {
      return this.success(
        result.match[1].trim(),
        this.calculateConfidence(result.match, text),
        result.match[0],
        result.pattern,
      );
    }

    // 2. Patterns fallback de la locale
    if (locale.invoiceNumberFallback) {
      const fallbackResult = this.tryPatterns(text, locale.invoiceNumberFallback);
      if (fallbackResult?.match[1]) {
        return this.success(
          fallbackResult.match[1].trim(),
          this.calculateConfidence(fallbackResult.match, text) - 0.1,
          fallbackResult.match[0],
          fallbackResult.pattern,
        );
      }
    }

    // 3. Pattern générique universel
    const genericFallback = /(?:FA|FAC|INV|BL|BC|CMD)[- ]?(\d{4,})/i;
    const fallbackMatch = text.match(genericFallback);
    if (fallbackMatch?.[1]) {
      return this.success(
        fallbackMatch[1].trim(),
        this.calculateConfidence(fallbackMatch, text) - 0.15,
        fallbackMatch[0],
        genericFallback,
      );
    }

    return this.failure();
  }
}
```

### 8.5 AmountExtractor

```typescript
export class AmountExtractor extends BaseExtractor<number> {
  /**
   * Extrait tous les montants labélisés.
   */
  extractAllLabeled(text: string, locale: IOcrLocale): ILabeledAmounts {
    return {
      totalHT: this.#extractWithLabel(text, locale.amountLabels.totalHT),
      totalTTC: this.#extractWithLabel(text, locale.amountLabels.totalTTC),
      vat: this.#extractWithLabel(text, locale.amountLabels.vat),
      discount: this.#extractWithLabel(text, locale.amountLabels.discount),
    };
  }

  /**
   * Calcule la TVA si non extraite.
   */
  calculateVAT(totalHT: number, totalTTC: number): number {
    return totalTTC - totalHT;
  }
}
```

### 8.6 EntityZoneDetector (Détection Fournisseur/Client)

**Fichier:** `opti_saas_lib/src/shared/ocr/detection/entity-zone-detector.ts`

Détecte et sépare les blocs FOURNISSEUR (vendor) et CLIENT (customer) dans les factures.

**Stratégies de détection (par ordre de confiance):**

1. **Labels explicites** (confiance 0.90-0.95):
   - Client: "Facturé à:", "Bill to:", "Client:", "Destinataire:"
   - Fournisseur: "Émetteur:", "Vendor:", "De la part de:"

2. **Analyse positionnelle** (confiance 0.65-0.85):
   - Gauche du header = généralement fournisseur
   - Droite du header = généralement client
   - Identifiants légaux (ICE, IF) = fournisseur

3. **Footer** (confiance basée sur champs trouvés):
   - Informations légales du fournisseur (ICE, IF, RC, CNSS, Patente)
   - Coordonnées bancaires (RIB, Banque)

```typescript
export class EntityZoneDetector {
  static readonly CUSTOMER_LABELS: RegExp[] = [
    /^(?:factur[ée]\s*[àa]|client|destinataire|acheteur)\s*[:：]/im,
    /^(?:bill(?:ed)?\s*to|ship(?:ped)?\s*to|customer|buyer)\s*[:：]/im,
  ];

  static readonly VENDOR_LABELS: RegExp[] = [
    /^(?:fournisseur|émetteur|vendeur|notre\s*société)\s*[:：]/im,
    /^(?:from|vendor|supplier|seller)\s*[:：]/im,
  ];

  static readonly FOOTER_VENDOR_PATTERNS = {
    ice: /ice\s*[:：]?\s*(\d{15})/i,
    fiscalId: /i\.?f\.?\s*[:：]?\s*(\d{7,8})/i,
    bank: /(?:banque|bank)\s*[:：]?\s*([A-Za-zÀ-ü\s]+?)(?=\s*[-–|]|\n|$)/i,
    rib: /(?:rib|iban)\s*[:：]?\s*([\d\s]{20,35})/i,
    // ... autres patterns
  };

  detectEntityBlocks(text: string): IEntityBlocks;
  extractVendorFromFooter(footerText: string): IVendorFooterInfo;
  extractCustomerCode(text: string): string | null;
}
```

### 8.7 CustomerExtractor

**Fichier:** `opti_saas_lib/src/shared/ocr/extractors/customer.extractor.ts`

Extrait les informations client/destinataire des factures.

**Stratégies d'extraction:**

1. Bloc labellé détecté par `EntityZoneDetector`
2. Section client labellée directement dans le texte
3. Uniquement code client si minimal

```typescript
export class CustomerExtractor extends BaseExtractor<IInvoiceClient> {
  extractCustomer(
    text: string,
    locale: IOcrLocale,
    vendorName?: string, // Évite confusion avec le fournisseur
  ): ICustomerExtractionResult;
}
```

### 8.8 LooseContactExtractor (Fallback)

**Fichier:** `opti_saas_lib/src/shared/ocr/extractors/loose-contact.extractor.ts`

Extracteur de secours utilisant les patterns d'optisass-angular quand les méthodes strictes échouent.

**Mots-clés fournisseurs détectés:**

- Industrie optique: LUXOTTICA, ESSILOR, SAFILO, HOYA, ZEISS, BBGR, RODENSTOCK
- Générique: DISTRIBUTION, SOCIETE, OPTICAL, OPTIQUE, VISION

```typescript
export class LooseContactExtractor {
  extractSupplier(text: string, locale: IOcrLocale): ILooseContactResult;
  extractFullSupplier(text: string, locale: IOcrLocale): Partial<IInvoiceSupplier>;
}
```

---

## 9. Patterns

### 9.1 NUMERIC_PATTERNS

**Fichier:** `opti_saas_lib/src/shared/ocr/patterns/numeric.patterns.ts`

```typescript
export const NUMERIC_PATTERNS = {
  DATE: {
    // 15/01/2024, 15-01-2024, 15.01.2024
    DMY: /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/,
    // 2024-01-15, 2024/01/15
    YMD: /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/,
  },

  AMOUNT: {
    // 1 234,56 ou 1234.56
    DECIMAL: /[\d\s]+[,.]?\d*/,
    // Avec devise: 1 234,56 DH, 1234.56 MAD
    WITH_CURRENCY: /[\d\s]+[,.]?\d*\s*(DH|MAD|€|EUR)?/i,
  },

  QUANTITY: /(\d+)\s*(pcs?|pièces?|unités?|u\.?)?/i,
};
```

### 9.2 MOROCCAN_PATTERNS

**Fichier:** `opti_saas_lib/src/shared/ocr/patterns/moroccan.patterns.ts`

```typescript
export const MOROCCAN_PATTERNS = {
  // ICE: 15 chiffres (ex: 001234567000089)
  ICE: /ICE\s*[:\s]?\s*(\d{15})/i,

  // IF (Identifiant Fiscal): 7-8 chiffres
  IF: /I\.?F\.?\s*[:\s]?\s*(\d{7,8})/i,

  // RC (Registre de Commerce)
  RC: /R\.?C\.?\s*[:\s]?\s*(\d+)/i,

  // CNSS
  CNSS: /CNSS\s*[:\s]?\s*(\d+)/i,

  // Patente
  PATENTE: /Patente\s*[:\s]?\s*(\d+)/i,
};

// Validation ICE (15 chiffres)
export function isValidICE(ice: string): boolean {
  return /^\d{15}$/.test(ice);
}

// Validation IF (7-8 chiffres)
export function isValidIF(fiscalId: string): boolean {
  return /^\d{7,8}$/.test(fiscalId);
}
```

### 9.3 Pattern Helpers

**Fichier:** `opti_saas_lib/src/shared/ocr/patterns/pattern.helpers.ts`

```typescript
/**
 * Parse une date depuis un match regex.
 * @param match Match regex
 * @param format Format attendu ('dmy' ou 'ymd')
 * @param months Liste des mois pour dates textuelles
 */
export function parseDate(
  match: RegExpMatchArray,
  format: 'dmy' | 'ymd',
  months?: string[],
): Date | null {
  let day: number, month: number, year: number;

  if (format === 'dmy') {
    day = parseInt(match[1], 10);

    // Mois textuel ou numérique
    if (months && isNaN(parseInt(match[2], 10))) {
      const monthIndex = months.findIndex((m) => m.toLowerCase() === match[2].toLowerCase());
      month = monthIndex >= 0 ? monthIndex : 0;
    } else {
      month = parseInt(match[2], 10) - 1;
    }

    year = parseInt(match[3], 10);
  } else {
    year = parseInt(match[1], 10);
    month = parseInt(match[2], 10) - 1;
    day = parseInt(match[3], 10);
  }

  const date = new Date(year, month, day);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Parse un montant depuis une chaîne.
 */
export function parseAmount(text: string): number {
  // Normalise: "1 234,56" → 1234.56
  const normalized = text.replace(/\s/g, '').replace(',', '.');
  return parseFloat(normalized) || 0;
}
```

---

## 10. Locales

### 10.1 Interface IOcrLocale

**Fichier:** `opti_saas_lib/src/shared/ocr/locales/locale.interface.ts`

```typescript
export interface IOcrLocale {
  /** Code langue (fr, ar, en) */
  code: string;

  /** Noms des mois pour parsing dates textuelles */
  months: string[];

  /** Patterns contextuels pour dates */
  dateContext: {
    invoice: RegExp[]; // "Date facture:", "Invoice date:"
    due: RegExp[]; // "Date échéance:", "Due date:"
  };

  /** Patterns pour numéro de facture */
  invoiceNumber: RegExp[];
  invoiceNumberFallback?: RegExp[];

  /** Labels pour montants */
  amountLabels: {
    totalHT: RegExp[];
    totalTTC: RegExp[];
    vat: RegExp[];
    discount: RegExp[];
  };

  /** Mots à ignorer dans les lignes produits */
  noiseKeywords: string[];

  /** Patterns pour conditions de paiement */
  paymentTerms: RegExp[];
}
```

### 10.2 FR_LOCALE

**Fichier:** `opti_saas_lib/src/shared/ocr/locales/fr.locale.ts`

```typescript
export const FR_LOCALE: IOcrLocale = {
  code: 'fr',

  months: [
    'janvier',
    'février',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'août',
    'septembre',
    'octobre',
    'novembre',
    'décembre',
  ],

  dateContext: {
    invoice: [/Date\s*(?:de\s*)?facture\s*[:\s]?\s*(.+)/i, /Date\s*[:\s]?\s*(.+)/i],
    due: [/Date\s*(?:d[''])?échéance\s*[:\s]?\s*(.+)/i, /Échéance\s*[:\s]?\s*(.+)/i],
  },

  invoiceNumber: [
    /Facture\s*[Nn]°?\s*[:\s]?\s*([A-Z0-9\-\/]+)/i,
    /N°\s*(?:de\s*)?facture\s*[:\s]?\s*([A-Z0-9\-\/]+)/i,
  ],

  amountLabels: {
    totalHT: [/Total\s*H\.?T\.?\s*[:\s]?\s*([\d\s,\.]+)/i],
    totalTTC: [/Total\s*T\.?T\.?C\.?\s*[:\s]?\s*([\d\s,\.]+)/i],
    vat: [/T\.?V\.?A\.?\s*[:\s]?\s*([\d\s,\.]+)/i],
    discount: [/Remise\s*[:\s]?\s*([\d\s,\.]+)/i],
  },

  noiseKeywords: [
    'total',
    'sous-total',
    'subtotal',
    'tva',
    'ht',
    'ttc',
    'remise',
    'discount',
    'net à payer',
    'montant',
  ],

  paymentTerms: [/Paiement\s*[:\s]?\s*(.+)/i, /Conditions\s*(?:de\s*)?paiement\s*[:\s]?\s*(.+)/i],
};
```

### 10.3 AR_LOCALE

**Fichier:** `opti_saas_lib/src/shared/ocr/locales/ar.locale.ts`

```typescript
export const AR_LOCALE: IOcrLocale = {
  code: 'ar',

  months: [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'ماي',
    'يونيو',
    'يوليوز',
    'غشت',
    'شتنبر',
    'أكتوبر',
    'نونبر',
    'دجنبر',
  ],

  dateContext: {
    invoice: [/تاريخ\s*الفاتورة\s*[:\s]?\s*(.+)/],
    due: [/تاريخ\s*الاستحقاق\s*[:\s]?\s*(.+)/],
  },

  invoiceNumber: [
    /فاتورة\s*رقم\s*[:\s]?\s*([A-Z0-9\-\/]+)/i,
    /رقم\s*الفاتورة\s*[:\s]?\s*([A-Z0-9\-\/]+)/i,
  ],

  // ... autres labels en arabe
};
```

---

## 11. Services

### 11.1 OcrLocaleService

Gère la correspondance entre la langue de l'application et la configuration OCR.

**Fichier:** `frontend/src/app/core/ocr/services/locale.service.ts`

```typescript
const TESSERACT_LANGUAGES: Record<string, string> = {
  fr: 'fra',
  en: 'eng',
  ar: 'ara',
};

@Injectable({ providedIn: 'root' })
export class OcrLocaleService {
  readonly #translateService = inject(TranslateService);

  /** Signal de la langue courante de l'app */
  readonly localeCode = computed(() => {
    const lang = this.#translateService.currentLang;
    return lang || 'fr';
  });

  /**
   * Retourne le code langue Tesseract basé sur la langue de l'app.
   */
  getTesseractLanguage(): string {
    const appLang = this.#translateService.currentLang;
    return TESSERACT_LANGUAGES[appLang] ?? 'fra';
  }

  /**
   * Retourne la locale pour le parsing basée sur le contenu du texte.
   * Détection automatique FR/AR.
   */
  getLocaleForText(text: string): IOcrLocale {
    if (this.#hasArabicContent(text)) {
      return AR_LOCALE;
    }
    return FR_LOCALE;
  }

  #hasArabicContent(text: string): boolean {
    const arabicPattern = /[\u0600-\u06FF]/;
    const arabicMatches = text.match(new RegExp(arabicPattern, 'g')) || [];
    return arabicMatches.length > 50; // Seuil significatif
  }
}
```

### 11.2 OcrService

Point d'entrée principal pour les opérations OCR.

**Fichier:** `frontend/src/app/core/ocr/ocr.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class OcrService {
  readonly #provider = inject(TesseractProvider);
  readonly #localeService = inject(OcrLocaleService);

  readonly isProcessing = signal(false);
  readonly lastError = signal<string | null>(null);

  async process(image: File, options?: IOcrOptions): Promise<IOcrResult> {
    this.isProcessing.set(true);
    this.lastError.set(null);

    try {
      this.#validateImage(image);

      // Langue OCR basée sur la langue de l'app
      const language = options?.language ?? this.#localeService.getTesseractLanguage();

      return await this.#provider.process(image, { ...options, language });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OCR failed';
      this.lastError.set(message);
      throw error;
    } finally {
      this.isProcessing.set(false);
    }
  }

  #validateImage(file: File): void {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'];
    if (!validTypes.includes(file.type)) {
      throw new Error(`Invalid image type: ${file.type}`);
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Image too large (max 10MB)');
    }
  }
}
```

---

## 12. Configuration

### 12.1 Enregistrement dans app.config.ts

```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideOcr(),
    providePipelineConfig(DEFAULT_PIPELINE_CONFIG),
    // ...
  ],
};
```

### 12.2 Types de documents supportés

**Fichier:** `opti_saas_lib/src/shared/ocr/ocr.models.ts`

```typescript
// Const array pour pouvoir itérer
export const OCR_DOCUMENT_TYPES = [
  'invoice',
  'delivery_note',
  'quote',
  'purchase_order',
  'prescription',
  'insurance_card',
  'generic',
] as const;

// Type dérivé pour type safety
export type OcrDocumentType = (typeof OCR_DOCUMENT_TYPES)[number];
```

---

## 13. Guide d'implémentation

### 13.1 Ajouter un nouveau Parser

**Étape 1:** Créer le modèle de données

```typescript
// features/my-feature/models/my-document.model.ts
export interface IMyDocument {
  field1: string | null;
  field2: Date | null;
  // ...
}
```

**Étape 2:** Créer le parser

```typescript
// features/my-feature/parsers/my-document.parser.ts
@Injectable()
export class MyDocumentParser extends DocumentParser<IMyDocument> {
  readonly documentType = 'my_type' as const;

  readonly #dateExtractor = new DateExtractor();
  readonly #localeService = inject(OcrLocaleService);

  extractData(rawText: string, blocks: IOcrBlock[]): IMyDocument {
    const locale = this.#localeService.getLocaleForText(rawText);

    return {
      field1: this.#extractField1(rawText, locale),
      field2: this.#dateExtractor.extract(rawText, locale, 'any').value,
    };
  }

  validate(data: IMyDocument): IValidationResult {
    const errors: IValidationError[] = [];
    // Validation...
    return { isValid: errors.length === 0, errors };
  }
}
```

**Étape 3:** Enregistrer le parser

```typescript
// features/my-feature/my-feature.routes.ts
export const myFeatureRoutes: Routes = [
  {
    path: '',
    providers: [
      provideParsers(createParserRegistration('my_type', MyDocumentParser, 'Description')),
    ],
    children: [
      /* ... */
    ],
  },
];
```

**Étape 4:** Utiliser le parser

```typescript
// features/my-feature/components/upload.component.ts
@Component({
  /* ... */
})
export class UploadComponent {
  readonly #pipelineFactory = inject(PipelineFactory);

  async onFileSelected(file: File): Promise<void> {
    const pipeline = this.#pipelineFactory.createPipeline<IMyDocument>('my_type');
    const result = await pipeline.process(file);

    console.log(result.data); // IMyDocument
    console.log(result.confidence); // 0.92
    console.log(result.warnings); // ["Uncertain text: ..."]
  }
}
```

### 13.2 Ajouter un nouvel Extractor

**Étape 1:** Créer l'extractor dans la lib

```typescript
// opti_saas_lib/src/shared/ocr/extractors/my.extractor.ts
export class MyExtractor extends BaseExtractor<MyType> {
  extract(text: string, locale: IOcrLocale): IExtractionResult<MyType> {
    // Logique d'extraction...
    const match = text.match(MY_PATTERN);
    if (match) {
      return this.success(/* ... */);
    }
    return this.failure();
  }
}
```

**Étape 2:** Exporter depuis l'index

```typescript
// opti_saas_lib/src/shared/ocr/extractors/index.ts
export * from './my.extractor';
```

**Étape 3:** Utiliser dans un parser

```typescript
readonly #myExtractor = new MyExtractor();

extractData(rawText: string): IData {
  return {
    myField: this.#myExtractor.extract(rawText, locale).value,
  };
}
```

### 13.3 Ajouter une nouvelle Locale

**Étape 1:** Créer le fichier locale

```typescript
// opti_saas_lib/src/shared/ocr/locales/es.locale.ts
export const ES_LOCALE: IOcrLocale = {
  code: 'es',
  months: ['enero', 'febrero', 'marzo' /* ... */],
  dateContext: {
    invoice: [/Fecha\s*(?:de\s*)?factura\s*[:\s]?\s*(.+)/i],
    due: [/Fecha\s*(?:de\s*)?vencimiento\s*[:\s]?\s*(.+)/i],
  },
  // ...
};
```

**Étape 2:** Mettre à jour le LocaleService

```typescript
getLocaleForText(text: string): IOcrLocale {
  if (this.#hasSpanishContent(text)) return ES_LOCALE;
  if (this.#hasArabicContent(text)) return AR_LOCALE;
  return FR_LOCALE;
}
```

---

## 14. Optimisations

### 14.1 Optimisations implémentées

| Optimisation             | Description                                  | Fichier                         |
| ------------------------ | -------------------------------------------- | ------------------------------- |
| **Worker Pool LRU**      | Réutilise les workers Tesseract par langue   | `tesseract.provider.ts`         |
| **Cache Regex**          | Compile les patterns une seule fois          | `date.extractor.ts`             |
| **Validation Config**    | Détecte les doublons de parsers au démarrage | `parser.providers.ts`           |
| **IDataExtractor**       | Interface publique sans réflexion            | `document-parser.interfaces.ts` |
| **Const + Derived Type** | `OCR_DOCUMENT_TYPES as const` pour itération | `ocr.models.ts`                 |
| **Warning Helper**       | Fonction centralisée pour détection warnings | `warning.helper.ts`             |

### 14.2 Bonnes pratiques performance

```typescript
// ✅ BON: Réutiliser les extractors
readonly #dateExtractor = new DateExtractor();

// ❌ MAUVAIS: Créer un extractor à chaque appel
extractData(text: string) {
  const dateExtractor = new DateExtractor(); // Coûteux!
}
```

```typescript
// ✅ BON: Utiliser le cache regex
const pattern = getTextDatePattern(locale); // Depuis cache

// ❌ MAUVAIS: Recréer le pattern
const pattern = new RegExp(`(\\d{1,2})\\s+(${locale.months.join('|')})...`);
```

---

## 15. Tests

### 15.1 Tests Extractor

```typescript
describe('DateExtractor', () => {
  const extractor = new DateExtractor();

  it('should extract date with context', () => {
    const text = 'Date facture: 15/01/2024';
    const result = extractor.extract(text, FR_LOCALE, 'invoice');

    expect(result.value).toEqual(new Date(2024, 0, 15));
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('should extract text date', () => {
    const text = '15 janvier 2024';
    const result = extractor.extract(text, FR_LOCALE, 'any');

    expect(result.value).toEqual(new Date(2024, 0, 15));
  });
});
```

### 15.2 Tests Parser

```typescript
describe('SupplierInvoiceParser', () => {
  let parser: SupplierInvoiceParser;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SupplierInvoiceParser],
    });
    parser = TestBed.inject(SupplierInvoiceParser);
  });

  it('should extract invoice data', () => {
    const rawText = `
      FACTURE N° 2024-001
      Date: 15/01/2024
      ICE: 001234567000089
      Total HT: 1000,00
      Total TTC: 1200,00
    `;

    const result = parser.extractData(rawText, []);

    expect(result.invoiceNumber).toBe('2024-001');
    expect(result.invoiceDate).toEqual(new Date(2024, 0, 15));
    expect(result.supplier.ice).toBe('001234567000089');
    expect(result.totals.totalHT).toBe(1000);
    expect(result.totals.totalTTC).toBe(1200);
  });
});
```

---

## 16. Évolutions futures

### 16.1 Parsing IA

L'architecture est prête pour intégrer des parsers IA :

```typescript
// pipeline.config.token.ts
documents: {
  invoice: {
    parserStrategy: 'ai',  // Utiliser parsing IA
    // ...
  },
}

// pipeline/parsers/ai-invoice.parser.ts (à implémenter)
@Injectable()
export class AiInvoiceParser implements IPipelineParser<ISupplierInvoice> {
  readonly #openAiService = inject(OpenAiService);

  async extractData(rawText: string, blocks: IOcrBlock[]): Promise<ISupplierInvoice> {
    const prompt = this.#buildPrompt(rawText);
    const response = await this.#openAiService.complete(prompt);
    return this.#parseResponse(response);
  }
}
```

### 16.2 Nouveaux providers planifiés

| Provider      | Priorité | Description                       |
| ------------- | -------- | --------------------------------- |
| OpenAI Vision | Haute    | Extraction + parsing en une étape |
| Google Vision | Moyenne  | Alternative cloud                 |
| Azure OCR     | Basse    | Alternative cloud                 |

### 16.3 Améliorations planifiées

| Amélioration        | Description                            |
| ------------------- | -------------------------------------- |
| Prétraitement image | Binarisation, correction contraste     |
| Cache résultats     | Éviter re-traitement même image        |
| Batch processing    | Traiter plusieurs images en parallèle  |
| Analytics           | Tracking performance et taux de succès |

---

## 17. Avancement de l'implémentation

> Dernière mise à jour : 2026-01-19

### 17.1 Core OCR (`core/ocr/`)

| Composant              | Fichier                                 | Statut  |
| ---------------------- | --------------------------------------- | ------- |
| Pipeline orchestrateur | `pipeline/ocr-pipeline.ts`              | ✅      |
| Pipeline factory       | `pipeline/pipeline.factory.ts`          | ✅      |
| Pipeline config token  | `pipeline/pipeline.config.token.ts`     | ✅      |
| Pipeline providers     | `pipeline/pipeline.providers.ts`        | ✅      |
| Tesseract provider     | `providers/tesseract.provider.ts`       | ✅      |
| Backend OCR provider   | `providers/backend-ocr.provider.ts`     | ✅      |
| Document parser base   | `document-parser.ts`                    | ✅      |
| Parser registry        | `parser-registry.ts`                    | ✅      |
| Parser providers       | `parser.providers.ts`                   | ✅      |
| OCR service            | `ocr.service.ts`                        | ✅      |
| OCR config             | `ocr.config.ts`                         | ✅      |
| Locale service         | `services/locale.service.ts`            | ✅      |
| AI Invoice parser      | `pipeline/parsers/ai-invoice.parser.ts` | 🔄 Stub |

### 17.2 Stock Entry Feature (`features/stock/stock-entry/`)

| Composant                   | Fichier                                           | Statut |
| --------------------------- | ------------------------------------------------- | ------ |
| Page principale             | `components/stock-entry/stock-entry.component.ts` | ✅     |
| Formulaire en-tête          | `components/stock-entry-form/`                    | ✅     |
| Tableau produits            | `components/stock-entry-table/`                   | ✅     |
| Ligne produit               | `components/stock-entry-row/`                     | ✅     |
| Actions groupées            | `components/stock-entry-actions/`                 | ✅     |
| Dialog OCR upload           | `components/ocr-upload-dialog/`                   | ✅     |
| Dialog recherche produit    | `components/product-search-dialog/`               | ✅     |
| Dialog répartition quantité | `components/split-quantity-dialog/`               | ✅     |
| Dialog conflit bulk action  | `components/bulk-action-conflict-dialog/`         | ✅     |
| Dialog création fournisseur | `components/supplier-quick-create-dialog/`        | ✅     |
| Parser facture fournisseur  | `parsers/supplier-invoice.parser.ts`              | ✅     |
| Store                       | `stock-entry.store.ts`                            | ✅     |
| Service                     | `services/stock-entry.service.ts`                 | ✅     |
| Models                      | `models/stock-entry.model.ts`                     | ✅     |
| Form models                 | `models/stock-entry-form.model.ts`                | ✅     |
| Routes                      | `stock-entry.routes.ts`                           | ✅     |

### 17.3 Extractors (`opti_saas_lib/`)

| Extractor           | Statut | Description                    |
| ------------------- | ------ | ------------------------------ |
| DateExtractor       | ⏳     | Extraction dates multi-format  |
| AmountExtractor     | ⏳     | Extraction montants et devises |
| IdentifierExtractor | ⏳     | ICE, IF, RC, CNSS...           |
| ContactExtractor    | ⏳     | Téléphone, email, adresse      |
| LineItemExtractor   | ⏳     | Lignes de facture              |

### 17.4 Légende

| Symbole | Signification             |
| ------- | ------------------------- |
| ✅      | Implémenté et fonctionnel |
| 🔄      | En cours / Stub           |
| ⏳      | Planifié (non implémenté) |
| ❌      | Bloqué / Problème         |

---

## Historique des modifications

| Version | Date       | Auteur | Description                                                                                       |
| ------- | ---------- | ------ | ------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-01-14 | Claude | Version initiale                                                                                  |
| 1.1     | 2026-01-14 | Claude | Ajout BackendOcrProvider et architecture backend NestJS                                           |
| 2.0     | 2026-01-18 | Claude | Refonte complète: Pipeline pattern, Extractors, Patterns, Locales, Worker Pool LRU, optimisations |
| 2.1     | 2026-01-19 | Claude | Ajout section 17 Avancement, fix clé i18n dupliquée `stock.entry.supplier`                        |
